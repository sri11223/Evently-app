// src/controllers/EventController.ts - COMPLETE FILE
import { Request, Response } from 'express';
import { db } from '../config/database';
import { pool } from '../config/database';
import { eventCache } from '../cache/EventCache';


export class EventController {
    
    public async getAllEvents(req: Request, res: Response): Promise<void> {
        try {
            const events = await eventCache.getAllEvents();
            
            console.log(`📅 Retrieved ${events.length} events (cached)`);
            
            res.json({
                success: true,
                data: events,
                count: events.length,
                cached: true
            });
    
        } catch (error) {
            console.error('❌ Get events error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve events'
            });
        }
    }

    public async getEventById(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            
            const event = await eventCache.getEventById(eventId);
            
            if (!event) {
                res.status(404).json({
                    success: false,
                    error: 'Event not found'
                });
                return;
            }
            
            res.json({
                success: true,
                data: event,
                cached: true
            });
    
        } catch (error) {
            console.error('❌ Get event error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve event'
            });
        }
    }

    public async createEvent(req: any, res: Response): Promise<void> {
        try {
            console.log('=== CREATE EVENT DEBUG ===');
            console.log('Request body:', req.body);
            console.log('User from JWT:', req.user);
            
            const { name, description, venue, event_date, total_capacity, price } = req.body;
            
            if (!name || !venue || !event_date || !total_capacity || !price) {
                console.log('Validation failed - missing fields');
                res.status(400).json({
                    success: false,
                    error: 'name, venue, event_date, total_capacity, and price are required'
                });
                return;
            }
            
            // Get created_by from JWT token (admin user ID)
            const created_by = req.user?.name || null;
            
            // Include description and created_by fields
            const query = `
                INSERT INTO events (
                    name, description, venue, event_date, 
                    total_capacity, available_seats, price, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
            
            console.log('SQL Query:', query);
            console.log('Parameters:', [name, description, venue, event_date, total_capacity, total_capacity, price, created_by]);
            
            const result = await db.query(query, [
                name, 
                description || null,  // Allow null description
                venue, 
                event_date, 
                total_capacity, 
                total_capacity,  // available_seats = total_capacity initially
                price,
                created_by
            ]);

            const event = result.rows[0];
            
            // Clear cache after creating new event
            await eventCache.invalidateEvent(event.id);
            
            console.log(`✅ Event created: ${event.name} (${event.id}) by user: ${created_by}`);
            
            res.status(201).json({
                success: true,
                data: { event },
                message: 'Event created successfully'
            });

        } catch (error) {
            console.error('❌ Create event error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create event'
            });
        }
    }

    public async updateEvent(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const { name, description, venue, event_date, total_capacity, price } = req.body;
            
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                // Get current event data
                const currentEvent = await client.query(`
                    SELECT available_seats, total_capacity 
                    FROM events 
                    WHERE id = $1 
                    FOR UPDATE
                `, [eventId]);
                
                if (currentEvent.rows.length === 0) {
                    res.status(404).json({
                        success: false,
                        error: 'Event not found'
                    });
                    return;
                }
                
                const current = currentEvent.rows[0];
                
                // Calculate new available seats if capacity changed
                let newAvailableSeats = current.available_seats;
                if (total_capacity && total_capacity !== current.total_capacity) {
                    const bookedSeats = current.total_capacity - current.available_seats;
                    newAvailableSeats = Math.max(0, total_capacity - bookedSeats);
                }
                
                // Update event
                const updateQuery = `
                    UPDATE events 
                    SET 
                        name = COALESCE($1, name),
                        description = COALESCE($2, description),
                        venue = COALESCE($3, venue),
                        event_date = COALESCE($4, event_date),
                        total_capacity = COALESCE($5, total_capacity),
                        available_seats = $6,
                        price = COALESCE($7, price),
                        updated_at = NOW()
                    WHERE id = $8
                    RETURNING *
                `;
                
                const result = await client.query(updateQuery, [
                    name, description, venue, event_date, 
                    total_capacity, newAvailableSeats, price, eventId
                ]);
                
                await client.query('COMMIT');
                
                // Clear cache after updating event
                await eventCache.invalidateEvent(eventId);
                
                res.json({
                    success: true,
                    data: result.rows,
                    message: 'Event updated successfully'
                });
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error('❌ Update event error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update event'
            });
        }
    }

    public async deleteEvent(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            
            // Check if event has bookings
            const bookingCheck = await db.query(`
                SELECT COUNT(*) as booking_count 
                FROM bookings 
                WHERE event_id = $1 AND status = 'confirmed'
            `, [eventId]);
            
            const bookingCount = parseInt(bookingCheck.rows.booking_count);
            
            if (bookingCount > 0) {
                res.status(400).json({
                    success: false,
                    error: `Cannot delete event with ${bookingCount} confirmed bookings. Cancel bookings first.`
                });
                return;
            }
            
            // Get admin user info from JWT (cast to any to access user property)
            const deletedBy = (req as any).user?.id || null;
            const deletedByName = (req as any).user?.name || 'Unknown';
            
            // Soft delete event
            const result = await db.query(`
                UPDATE events 
                SET status = 'cancelled', updated_at = NOW() 
                WHERE id = $1 
                RETURNING name, id
            `, [eventId]);
            
            if (result.rows.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'Event not found'
                });
                return;
            }
            
            const event = result.rows[0];
            
            // Clear cache after deletion (invalidates all event caches)
            await eventCache.invalidateEvent(eventId);
            
            res.json({
                success: true,
                message: `Event "${event.name}" cancelled successfully by ${deletedByName}`,
                data: {
                    event_id: event.id,
                    event_name: event.name,
                    deleted_by_user_id: deletedBy,
                    deleted_by_name: deletedByName,
                    status: 'cancelled'
                }
            });
            
        } catch (error) {
            console.error('❌ Delete event error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete event'
            });
        }
    }

    public async getPopularEvents(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 5;
            const events = await eventCache.getPopularEvents(limit);
            
            res.json({
                success: true,
                data: events,
                count: events.length,
                cached: true
            });
    
        } catch (error) {
            console.error('❌ Get popular events error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve popular events'
            });
        }
    }
}

export const eventController = new EventController();
