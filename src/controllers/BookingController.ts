// src/controllers/BookingController.ts - COMPLETE FILE
import { Request, Response } from 'express';
import { bookingService } from '../services/BookingService';
import { db } from '../config/database';
import { pool } from '../config/database';
import { eventCache } from '../cache/EventCache';

export class BookingController {

    public async bookTickets(req: Request, res: Response): Promise<void> {
        try {
            const { user_id, event_id, quantity } = req.body;

            if (!user_id || !event_id || !quantity || quantity <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'user_id, event_id, and quantity (> 0) are required'
                });
                return;
            }

            const result = await bookingService.bookTickets({
                user_id,
                event_id,
                quantity: parseInt(quantity)
            });

            res.status(201).json(result);

        } catch (error: any) {
            console.error('❌ Booking error:', error);
            res.status(409).json({
                success: false,
                error: error.message
            });
        }
    }

    public async cancelBooking(req: Request, res: Response): Promise<void> {
        try {
            const { bookingId } = req.params;
            
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                // Get booking details
                const bookingQuery = `
                    SELECT b.*, e.name as event_name 
                    FROM bookings b 
                    JOIN events e ON b.event_id = e.id 
                    WHERE b.id = $1 AND b.status = 'confirmed'
                    FOR UPDATE
                `;
                
                const bookingResult = await client.query(bookingQuery, [bookingId]);
                
                if (bookingResult.rows.length === 0) {
                    res.status(404).json({
                        success: false,
                        error: 'Booking not found or already cancelled'
                    });
                    return;
                }
                
                const booking = bookingResult.rows[0];
                
                // Update booking status
                await client.query(`
                    UPDATE bookings 
                    SET status = 'cancelled', updated_at = NOW() 
                    WHERE id = $1
                `, [bookingId]);
                
                // Return seats to event capacity
                await client.query(`
                    UPDATE events 
                    SET available_seats = available_seats + $1, updated_at = NOW() 
                    WHERE id = $2
                `, [booking.quantity, booking.event_id]);
                
                await client.query('COMMIT');
                
                // Invalidate event cache after cancelling booking
                await eventCache.invalidateEvent(booking.event_id);
                
                console.log(`✅ Booking cancelled: ${bookingId}, ${booking.quantity} seats returned`);
                
                res.json({
                    success: true,
                    message: 'Booking cancelled successfully',
                    booking_reference: booking.booking_reference,
                    refunded_amount: booking.total_amount,
                    seats_returned: booking.quantity
                });
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error('❌ Cancel booking error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cancel booking'
            });
        }
    }

    public async getUserBookings(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;
            
            const query = `
                SELECT 
                    b.id, b.quantity, b.total_amount, b.status, 
                    b.booking_reference, b.created_at,
                    e.name as event_name, e.venue, e.event_date
                FROM bookings b
                JOIN events e ON b.event_id = e.id
                WHERE b.user_id = $1
                ORDER BY b.created_at DESC
            `;
            
            const result = await db.query(query, [userId]);
            
            res.json({
                success: true,
                data: result.rows,
                count: result.rows.length
            });
            
        } catch (error) {
            console.error('❌ Get user bookings error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve bookings'
            });
        }
    }

    public async getBookingByReference(req: Request, res: Response): Promise<void> {
        try {
            const { reference } = req.params;
            
            const query = `
                SELECT 
                    b.*, 
                    e.name as event_name, 
                    e.venue, 
                    e.event_date,
                    u.name as user_name,
                    u.email as user_email
                FROM bookings b
                JOIN events e ON b.event_id = e.id
                JOIN users u ON b.user_id = u.id
                WHERE b.booking_reference = $1
            `;
            
            const result = await db.query(query, [reference]);
            
            if (result.rows.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'Booking not found'
                });
                return;
            }

            res.json({
                success: true,
                data: result.rows
            });

        } catch (error) {
            console.error('❌ Get booking error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve booking'
            });
        }
    }
}

export const bookingController = new BookingController();
