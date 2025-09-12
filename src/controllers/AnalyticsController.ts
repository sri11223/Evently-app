// src/controllers/AnalyticsController.ts - NEW FILE
import { Request, Response } from 'express';
import { db } from '../config/database';

export class AnalyticsController {
    
    public async getOverallAnalytics(req: Request, res: Response): Promise<void> {
        try {
            // Get overall stats
            const overallStats = await db.query(`
                SELECT 
                    COUNT(DISTINCT e.id) as total_events,
                    COUNT(DISTINCT b.id) as total_bookings,
                    COALESCE(SUM(b.total_amount), 0) as total_revenue,
                    COUNT(DISTINCT b.user_id) as unique_customers
                FROM events e
                LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
                WHERE e.status = 'active'
            `);
            
            // Get capacity utilization
            const capacityStats = await db.query(`
                SELECT 
                    AVG(CASE 
                        WHEN e.total_capacity > 0 
                        THEN ((e.total_capacity - e.available_seats) * 100.0 / e.total_capacity)
                        ELSE 0 
                    END) as avg_capacity_utilization
                FROM events e
                WHERE e.status = 'active'
            `);
            
            // Get most popular events
            const popularEvents = await db.query(`
                SELECT 
                    e.name,
                    e.venue,
                    COUNT(b.id) as booking_count,
                    COALESCE(SUM(b.quantity), 0) as total_tickets_sold,
                    COALESCE(SUM(b.total_amount), 0) as revenue
                FROM events e
                LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
                WHERE e.status = 'active'
                GROUP BY e.id, e.name, e.venue
                ORDER BY booking_count DESC
                LIMIT 5
            `);
            
            res.json({
                success: true,
                data: {
                    overview: overallStats.rows,
                    capacity_utilization: Math.round(capacityStats.rows.avg_capacity_utilization || 0),
                    popular_events: popularEvents.rows
                }
            });
            
        } catch (error) {
            console.error('❌ Analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve analytics'
            });
        }
    }
    
    public async getEventAnalytics(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            
            // Get event details with booking stats
            const eventStats = await db.query(`
                SELECT 
                    e.name,
                    e.venue,
                    e.total_capacity,
                    e.available_seats,
                    e.price,
                    COUNT(b.id) as total_bookings,
                    COALESCE(SUM(b.quantity), 0) as tickets_sold,
                    COALESCE(SUM(b.total_amount), 0) as revenue,
                    CASE 
                        WHEN e.total_capacity > 0 
                        THEN ((e.total_capacity - e.available_seats) * 100.0 / e.total_capacity)
                        ELSE 0 
                    END as capacity_utilization
                FROM events e
                LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
                WHERE e.id = $1
                GROUP BY e.id, e.name, e.venue, e.total_capacity, e.available_seats, e.price
            `, [eventId]);
            
            if (eventStats.rows.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'Event not found'
                });
                return;
            }
            
            // Get booking timeline
            const bookingTimeline = await db.query(`
                SELECT 
                    DATE(created_at) as booking_date,
                    COUNT(*) as bookings_count,
                    SUM(quantity) as tickets_sold,
                    SUM(total_amount) as daily_revenue
                FROM bookings
                WHERE event_id = $1 AND status = 'confirmed'
                GROUP BY DATE(created_at)
                ORDER BY booking_date
            `, [eventId]);
            
            res.json({
                success: true,
                data: {
                    event_stats: eventStats.rows,
                    booking_timeline: bookingTimeline.rows
                }
            });
            
        } catch (error) {
            console.error('❌ Event analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve event analytics'
            });
        }
    }
}

export const analyticsController = new AnalyticsController();
