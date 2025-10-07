// src/services/BookingService.ts
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { BookingRequest, Event, Booking } from '../types';
import { randomUUID } from 'crypto';
import { eventCache } from '../cache/EventCache';
import { emailService } from './EmailService';


export class BookingService {
    private static instance: BookingService;

    public static getInstance(): BookingService {
        if (!BookingService.instance) {
            BookingService.instance = new BookingService();
        }
        return BookingService.instance;
    }

   // src/services/BookingService.ts - Fix the event handling part
public async bookTickets(request: BookingRequest): Promise<any> {
    const { user_id, event_id, quantity } = request;
    
    // Use user+event lock to prevent same user double-booking, not event-wide lock
    const lockKey = `booking_lock:${user_id}:${event_id}`;
    const lockValue = `${Date.now()}`;

    console.log(`🎫 Processing booking: User ${user_id}, Event ${event_id}, Quantity ${quantity}`);

    // Step 1: Acquire Redis lock (per user+event to prevent double-booking by same user)
    const lockAcquired = await redis.set(lockKey, lockValue, 'PX', 30000, 'NX');
    if (lockAcquired !== 'OK') {
        throw new Error('You have a booking in progress for this event. Please wait or refresh.');
    }

    try {
        // Step 2: Execute booking in transaction
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            console.log('🔒 Transaction started');

            // Validate user exists and get email
            const userCheck = await client.query('SELECT id, email, name FROM users WHERE id = $1', [user_id]);
            if (userCheck.rows.length === 0) {
                throw new Error('User not found. Please register or login first.');
            }

            // Get event with lock
            const eventQuery = `
                SELECT id, name, total_capacity, available_seats, price, version, event_date
                FROM events 
                WHERE id = $1 AND status = 'active'
                FOR UPDATE
            `;
            const eventResult = await client.query(eventQuery, [event_id]);
            
            if (eventResult.rows.length === 0) {
                throw new Error('Event not found or has been cancelled');
            }

            // Fix: Access the first row of the result
            const event = eventResult.rows[0];
            console.log(`📊 Event: ${event.name}, Available: ${event.available_seats}`);

            // Check if event date has passed
            const eventDate = new Date(event.event_date);
            const now = new Date();
            if (eventDate < now) {
                throw new Error(`Cannot book tickets for past event "${event.name}"`);
            }

            // Check for duplicate booking (same user, same event, confirmed status)
            const duplicateCheck = await client.query(`
                SELECT COUNT(*) as count 
                FROM bookings 
                WHERE user_id = $1 AND event_id = $2 AND status = 'confirmed'
            `, [user_id, event_id]);
            
            const existingBookings = parseInt(duplicateCheck.rows[0].count);
            if (existingBookings > 0) {
                throw new Error(`You already have a confirmed booking for "${event.name}". Cancel existing booking to book again.`);
            }

            // Check availability
            if (event.available_seats === 0) {
                throw new Error(`Event "${event.name}" is fully booked. Join the waitlist to get notified when seats become available.`);
            }

            if (event.available_seats < quantity) {
                throw new Error(`Only ${event.available_seats} seat(s) available for "${event.name}". Please reduce quantity or join waitlist.`);
            }

            // Update event capacity
            const newAvailableSeats = event.available_seats - quantity;
            const updateQuery = `
                UPDATE events 
                SET available_seats = $1, version = version + 1, updated_at = NOW()
                WHERE id = $2 AND version = $3
            `;
            
            const updateResult = await client.query(updateQuery, [
                newAvailableSeats, event_id, event.version
            ]);

            if (updateResult.rowCount === 0) {
                throw new Error('Event was modified by another transaction');
            }

            console.log(`📉 Seats updated: ${event.available_seats} → ${newAvailableSeats}`);

            // Create booking
            const bookingId = randomUUID();
            const bookingReference = this.generateBookingReference();
            const totalAmount = event.price * quantity;

            const bookingQuery = `
                INSERT INTO bookings (
                    id, user_id, event_id, quantity, total_amount, 
                    booking_reference, status
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
                RETURNING *
            `;

            const bookingResult = await client.query(bookingQuery, [
                bookingId, user_id, event_id, quantity, 
                totalAmount, bookingReference
            ]);

            await client.query('COMMIT');
            console.log('✅ Transaction committed');

            // Invalidate event cache after booking
            await eventCache.invalidateEvent(event_id);
            console.log('🗑️ Event cache invalidated');

            const booking = bookingResult.rows[0];

            // Send confirmation email (non-blocking)
            emailService.sendBookingConfirmation({
                to: userCheck.rows[0].email || 'user@example.com',
                userName: userCheck.rows[0].name || 'Valued Customer',
                eventName: event.name,
                eventDate: event.event_date,
                venue: event.venue,
                quantity,
                totalPrice: totalAmount,
                reference: bookingReference
            }).catch(err => console.error('📧 Email send failed:', err));

            return {
                success: true,
                booking,
                message: 'Booking confirmed successfully',
                booking_reference: bookingReference
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.log('🔄 Transaction rolled back');
            throw error;
        } finally {
            client.release();
        }

    } finally {
        // Release lock
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[2] then
                return redis.call("del", KEYS[2])
            else
                return 0
            end
        `;
        await redis.eval(script, 1, lockKey, lockValue);
        console.log('🔓 Lock released');
    }
}


    private generateBookingReference(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `EVT${timestamp}${random}`;
    }
}

export const bookingService = BookingService.getInstance();
