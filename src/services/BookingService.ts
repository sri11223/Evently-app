// src/services/BookingService.ts
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { BookingRequest, Event, Booking } from '../types';
import { randomUUID } from 'crypto';
import { eventCache } from '../cache/EventCache';


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
    const lockKey = `booking_lock:${event_id}`;
    const lockValue = `${user_id}:${Date.now()}`;

    console.log(`🎫 Processing booking: User ${user_id}, Event ${event_id}, Quantity ${quantity}`);

    // Step 1: Acquire Redis lock
    const lockAcquired = await redis.set(lockKey, lockValue, 'PX', 30000, 'NX');
    if (lockAcquired !== 'OK') {
        throw new Error('Event is being booked by another user. Please try again.');
    }

    try {
        // Step 2: Execute booking in transaction
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            console.log('🔒 Transaction started');

            // Get event with lock
            const eventQuery = `
                SELECT id, name, total_capacity, available_seats, price, version
                FROM events 
                WHERE id = $1 AND status = 'active'
                FOR UPDATE
            `;
            const eventResult = await client.query(eventQuery, [event_id]);
            
            if (eventResult.rows.length === 0) {
                throw new Error('Event not found or inactive');
            }

            // Fix: Access the first row of the result
            const event = eventResult.rows[0];
            console.log(`📊 Event: ${event.name}, Available: ${event.available_seats}`);

            // Check availability
            if (event.available_seats < quantity) {
                throw new Error(`Only ${event.available_seats} seats available`);
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
