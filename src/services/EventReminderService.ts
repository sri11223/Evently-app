// src/services/EventReminderService.ts
import { db } from '../config/database';
import { notificationService } from './NotificationService';

export class EventReminderService {
    private static instance: EventReminderService;
    private reminderInterval: NodeJS.Timeout | null = null;

    static getInstance(): EventReminderService {
        if (!EventReminderService.instance) {
            EventReminderService.instance = new EventReminderService();
        }
        return EventReminderService.instance;
    }

    /**
     * Start the reminder system
     */
    startReminderSystem(): void {
        // Send reminders every hour
        this.reminderInterval = setInterval(async () => {
            await this.sendEventReminders();
        }, 60 * 60 * 1000); // Every hour

        console.log('📅 Event reminder system started');
    }

    /**
     * Send event reminders for upcoming events
     */
    async sendEventReminders(): Promise<void> {
        try {
            // Get events happening in the next 24 hours that haven't been reminded
            const upcomingEvents = await db.queryRead(`
                SELECT DISTINCT 
                    e.id, e.name, e.venue, e.event_date,
                    b.user_id, b.quantity, b.booking_reference
                FROM events e
                JOIN bookings b ON e.id = b.event_id
                WHERE e.event_date > NOW() 
                AND e.event_date <= NOW() + INTERVAL '24 hours'
                AND b.status = 'confirmed'
                AND e.status = 'active'
            `);

            let remindersSent = 0;

            for (const event of upcomingEvents.rows) {
                const hoursUntil = Math.ceil(
                    (new Date(event.event_date).getTime() - Date.now()) / (1000 * 60 * 60)
                );
                
                const success = await notificationService.sendNotification({
                    type: 'event_reminder',
                    title: `📅 Event Reminder: ${event.name}`,
                    message: `Your event "${event.name}" at ${event.venue} starts in ${hoursUntil} hours. Don't forget to attend! Booking: ${event.booking_reference}`,
                    userId: event.user_id,
                    eventId: event.id,
                    data: {
                        eventName: event.name,
                        venue: event.venue,
                        eventDate: event.event_date,
                        hoursUntil,
                        quantity: event.quantity,
                        bookingReference: event.booking_reference
                    },
                    channels: ['websocket', 'email', 'push'],
                    priority: 'medium',
                    timestamp: new Date()
                });

                if (success) remindersSent++;
            }
            
            if (remindersSent > 0) {
                console.log(`📅 Event reminders sent to ${remindersSent} users`);
            }
            
        } catch (error) {
            console.error('❌ Event reminder error:', error);
        }
    }

    /**
     * Send immediate event reminder for specific booking
     */
    async sendImmediateReminder(bookingId: string): Promise<boolean> {
        try {
            const bookingResult = await db.queryRead(`
                SELECT 
                    b.user_id, b.quantity, b.booking_reference,
                    e.id as event_id, e.name, e.venue, e.event_date
                FROM bookings b
                JOIN events e ON b.event_id = e.id
                WHERE b.id = $1 AND b.status = 'confirmed'
            `, [bookingId]);

            if (bookingResult.rows.length === 0) {
                return false;
            }

            const booking = bookingResult.rows[0];
            const hoursUntil = Math.ceil(
                (new Date(booking.event_date).getTime() - Date.now()) / (1000 * 60 * 60)
            );

            return await notificationService.sendNotification({
                type: 'event_reminder',
                title: `📅 Event Reminder: ${booking.name}`,
                message: `Your event "${booking.name}" at ${booking.venue} starts in ${hoursUntil} hours. Booking: ${booking.booking_reference}`,
                userId: booking.user_id,
                eventId: booking.event_id,
                data: {
                    eventName: booking.name,
                    venue: booking.venue,
                    eventDate: booking.event_date,
                    hoursUntil,
                    quantity: booking.quantity,
                    bookingReference: booking.booking_reference
                },
                channels: ['websocket', 'email', 'push'],
                priority: 'high',
                timestamp: new Date()
            });

        } catch (error) {
            console.error('❌ Immediate reminder error:', error);
            return false;
        }
    }

    /**
     * Stop the reminder system
     */
    stopReminderSystem(): void {
        if (this.reminderInterval) {
            clearInterval(this.reminderInterval);
            this.reminderInterval = null;
            console.log('📅 Event reminder system stopped');
        }
    }
}

export const eventReminderService = EventReminderService.getInstance();
