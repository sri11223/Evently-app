// src/controllers/EventController.ts
import { Request, Response } from 'express';
import { db } from '../config/database';

export class EventController {
    
    public async getAllEvents(req: Request, res: Response): Promise<void> {
        try {
            const query = `
                SELECT 
                    id, name, description, venue, event_date,
                    total_capacity, available_seats, price, status,
                    created_at
                FROM events 
                WHERE status = 'active'
                ORDER BY event_date ASC
            `;
            
            const result = await db.query(query);
            const events = result.rows;
            
            console.log(`📅 Retrieved ${events.length} events`);
            
            res.json({
                success: true,
                data: events,
                count: events.length
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
            
            const query = `
                SELECT 
                    id, name, description, venue, event_date,
                    total_capacity, available_seats, price, status,
                    version, created_at
                FROM events 
                WHERE id = $1 AND status = 'active'
            `;
            
            const result = await db.query(query, [eventId]);
            
            if (result.rows.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'Event not found'
                });
                return;
            }

            const event = result.rows;
            
            res.json({
                success: true,
                data: event
            });

        } catch (error) {
            console.error('❌ Get event error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve event'
            });
        }
    }
}

export const eventController = new EventController();
