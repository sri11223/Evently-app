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

    public async searchEvents(req: Request, res: Response): Promise<void> {
        try {
            const { 
                search,           // Search in name or venue
                venue,            // Filter by venue
                minPrice,         // Minimum price
                maxPrice,         // Maximum price
                hasSeats,         // Only events with available seats
                startDate,        // Events from this date
                endDate,          // Events until this date
                sortBy = 'date',  // Sort by: date, price, name, capacity
                order = 'asc'     // Order: asc or desc
            } = req.query;

            // Build dynamic SQL query
            let query = `
                SELECT 
                    id, name, venue, event_date,
                    total_capacity, available_seats, price,
                    created_at
                FROM events 
                WHERE status = 'active'
            `;
            
            const params: any[] = [];
            let paramIndex = 1;

            // Search filter (name or venue contains keyword)
            if (search) {
                query += ` AND (LOWER(name) LIKE $${paramIndex} OR LOWER(venue) LIKE $${paramIndex})`;
                params.push(`%${String(search).toLowerCase()}%`);
                paramIndex++;
            }

            // Venue filter
            if (venue) {
                query += ` AND LOWER(venue) LIKE $${paramIndex}`;
                params.push(`%${String(venue).toLowerCase()}%`);
                paramIndex++;
            }

            // Price range filter
            if (minPrice) {
                query += ` AND price >= $${paramIndex}`;
                params.push(Number(minPrice));
                paramIndex++;
            }
            if (maxPrice) {
                query += ` AND price <= $${paramIndex}`;
                params.push(Number(maxPrice));
                paramIndex++;
            }

            // Available seats filter
            if (hasSeats === 'true') {
                query += ` AND available_seats > 0`;
            }

            // Date range filter
            if (startDate) {
                query += ` AND event_date >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                query += ` AND event_date <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }

            // Sorting
            const validSortFields = ['date', 'price', 'name', 'capacity'];
            const sortField = validSortFields.includes(String(sortBy)) ? sortBy : 'date';
            const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
            
            const sortMapping: { [key: string]: string } = {
                'date': 'event_date',
                'price': 'price',
                'name': 'name',
                'capacity': 'total_capacity'
            };
            
            query += ` ORDER BY ${sortMapping[String(sortField)]} ${sortOrder}`;

            console.log('🔍 Search query:', query);
            console.log('📋 Parameters:', params);

            const result = await db.query(query, params);

            res.json({
                success: true,
                data: result.rows,
                count: result.rows.length,
                filters: {
                    search, venue, minPrice, maxPrice, hasSeats, 
                    startDate, endDate, sortBy, order
                }
            });

        } catch (error) {
            console.error('❌ Search events error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to search events'
            });
        }
    }

    public async createEvent(req: any, res: Response): Promise<void> {
        try {
            console.log('=== CREATE EVENT DEBUG ===');
            console.log('Request body:', req.body);
            console.log('User from JWT:', req.user);
            
            const { name, description, venue, event_date, total_capacity, price } = req.body;
            
            // Validation: Required fields
            if (!name || !venue || !event_date || !total_capacity || !price) {
                console.log('Validation failed - missing fields');
                res.status(400).json({
                    success: false,
                    error: 'name, venue, event_date, total_capacity, and price are required'
                });
                return;
            }

            // Validation: Capacity must be positive
            const capacity = parseInt(total_capacity);
            if (isNaN(capacity) || capacity <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'total_capacity must be a positive number'
                });
                return;
            }

            // Validation: Capacity limit
            if (capacity > 100000) {
                res.status(400).json({
                    success: false,
                    error: 'total_capacity cannot exceed 100,000'
                });
                return;
            }

            // Validation: Price must be positive
            const eventPrice = parseFloat(price);
            if (isNaN(eventPrice) || eventPrice < 0) {
                res.status(400).json({
                    success: false,
                    error: 'price must be a positive number or zero for free events'
                });
                return;
            }

            // Validation: Event date must be in the future
            const eventDate = new Date(event_date);
            const now = new Date();
            if (eventDate < now) {
                res.status(400).json({
                    success: false,
                    error: 'event_date must be in the future'
                });
                return;
            }

            // Validation: Event date cannot be more than 2 years in future
            const twoYearsFromNow = new Date();
            twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
            if (eventDate > twoYearsFromNow) {
                res.status(400).json({
                    success: false,
                    error: 'event_date cannot be more than 2 years in the future'
                });
                return;
            }

            // Validation: Name length
            if (name.length < 3 || name.length > 200) {
                res.status(400).json({
                    success: false,
                    error: 'event name must be between 3 and 200 characters'
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
            console.log('Parameters:', [name, description, venue, event_date, capacity, capacity, eventPrice, created_by]);
            
            const result = await db.query(query, [
                name.trim(), 
                description?.trim() || null,  // Allow null description
                venue.trim(), 
                event_date, 
                capacity, 
                capacity,  // available_seats = total_capacity initially
                eventPrice,
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
                
                // Validation: If updating capacity, ensure it's not less than already booked seats
                let newAvailableSeats = current.available_seats;
                if (total_capacity && total_capacity !== current.total_capacity) {
                    const bookedSeats = current.total_capacity - current.available_seats;
                    
                    // Check if new capacity is less than booked seats
                    if (total_capacity < bookedSeats) {
                        await client.query('ROLLBACK');
                        res.status(400).json({
                            success: false,
                            error: `Cannot reduce capacity to ${total_capacity}. Already ${bookedSeats} seats are booked. Minimum capacity must be ${bookedSeats}.`
                        });
                        client.release();
                        return;
                    }
                    
                    newAvailableSeats = total_capacity - bookedSeats;
                }
                
                // Validation: Price if provided
                if (price !== undefined) {
                    const eventPrice = parseFloat(price);
                    if (isNaN(eventPrice) || eventPrice < 0) {
                        await client.query('ROLLBACK');
                        res.status(400).json({
                            success: false,
                            error: 'price must be a positive number or zero'
                        });
                        client.release();
                        return;
                    }
                }
                
                // Validation: Event date if provided
                if (event_date) {
                    const eventDate = new Date(event_date);
                    const now = new Date();
                    if (eventDate < now) {
                        await client.query('ROLLBACK');
                        res.status(400).json({
                            success: false,
                            error: 'event_date must be in the future'
                        });
                        client.release();
                        return;
                    }
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
            
            // Check if event exists and is active
            const checkEvent = await db.query(`
                SELECT id, name, status 
                FROM events 
                WHERE id = $1
            `, [eventId]);
            
            if (checkEvent.rows.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'Event not found'
                });
                return;
            }
            
            const existingEvent = checkEvent.rows[0];
            
            if (existingEvent.status === 'cancelled') {
                res.status(400).json({
                    success: false,
                    error: 'Event is already cancelled'
                });
                return;
            }
            
            // Soft delete event (only if active)
            const result = await db.query(`
                UPDATE events 
                SET status = 'cancelled', updated_at = NOW() 
                WHERE id = $1 AND status = 'active'
                RETURNING name, id
            `, [eventId]);
            
            if (result.rows.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'Event not found or already cancelled'
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
