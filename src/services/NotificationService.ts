// src/services/NotificationService.ts
import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { EventEmitter } from 'events';
import { redis } from '../config/redis';
import { emailService } from './EmailService';

// Update the NotificationPayload interface at the top of the file
export interface NotificationPayload {
    type: 'booking_confirmed' | 'waitlist_promoted' | 'seat_available' | 'event_reminder' | 'price_change' | 'booking_cancelled' | 'waitlist_joined' | 'waitlist_position_improved' | 'system_update' | 'event_update' | 'test';
    title: string;
    message: string;
    userId: string;
    eventId?: string;
    data?: any;
    channels: ('websocket' | 'email' | 'push' | 'sms')[];
    priority: 'low' | 'medium' | 'high' | 'urgent';
    timestamp: Date;
}


export interface NotificationStats {
    total_sent: number;
    delivered: number;
    failed: number;
    channels: {
        websocket: { sent: number; delivered: number };
        email: { sent: number; delivered: number };
        push: { sent: number; delivered: number };
        sms: { sent: number; delivered: number };
    };
    response_times: {
        avg_delivery_ms: number;
        websocket_ms: number;
        email_ms: number;
    };
}

export class NotificationService extends EventEmitter {
    private static instance: NotificationService;
    private io: SocketServer | null = null;
    private connectedUsers: Map<string, string[]> = new Map(); // userId -> socketIds
    private notificationStats!: NotificationStats;

    constructor() {
        super();
        this.initializeStats();
        this.setupEventListeners();
        console.log('🔔 Notification Service initialized');
    }

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Initialize WebSocket server
     */
    initializeWebSocket(httpServer: HttpServer): void {
        this.io = new SocketServer(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            path: '/notifications'
        });

        this.io.on('connection', (socket) => {
            console.log(`🔗 Client connected: ${socket.id}`);

            // User authentication
            socket.on('authenticate', (data: { userId: string, token?: string }) => {
                const { userId } = data;
                
                // Store user-socket mapping
                if (!this.connectedUsers.has(userId)) {
                    this.connectedUsers.set(userId, []);
                }
                this.connectedUsers.get(userId)!.push(socket.id);
                
                socket.userId = userId;
                socket.join(`user:${userId}`);
                
                console.log(`✅ User ${userId} authenticated on socket ${socket.id}`);
                
                // Send welcome notification
                socket.emit('notification', {
                    type: 'system',
                    title: 'Connected',
                    message: 'Real-time notifications enabled',
                    timestamp: new Date()
                });
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                if (socket.userId) {
                    const userSockets = this.connectedUsers.get(socket.userId);
                    if (userSockets) {
                        const index = userSockets.indexOf(socket.id);
                        if (index > -1) {
                            userSockets.splice(index, 1);
                        }
                        if (userSockets.length === 0) {
                            this.connectedUsers.delete(socket.userId);
                        }
                    }
                }
                console.log(`❌ Client disconnected: ${socket.id}`);
            });

            // Handle notification acknowledgment
            socket.on('notification_ack', (data: { notificationId: string, status: 'delivered' | 'read' }) => {
                this.handleNotificationAck(data.notificationId, data.status);
            });
        });

        console.log('🌐 WebSocket server initialized on /notifications');
    }

    /**
     * Send notification to user
     */
    async sendNotification(notification: NotificationPayload): Promise<boolean> {
        const startTime = Date.now();
        let success = false;

        try {
            // Send via requested channels
            const promises = notification.channels.map(channel => 
                this.sendViaChannel(channel, notification)
            );

            const results = await Promise.allSettled(promises);
            success = results.some(result => result.status === 'fulfilled' && result.value);

            // Update stats
            this.updateNotificationStats(notification, success, Date.now() - startTime);

            // Store notification in Redis for history
            await this.storeNotification(notification);

            console.log(`📨 Notification sent to user ${notification.userId}: ${notification.title}`);
            
            // Emit event for analytics
            this.emit('notification:sent', { notification, success, duration: Date.now() - startTime });

            return success;

        } catch (error) {
            console.error('❌ Notification send error:', error);
            this.updateNotificationStats(notification, false, Date.now() - startTime);
            return false;
        }
    }

    /**
     * Send bulk notifications
     */
    async sendBulkNotifications(notifications: NotificationPayload[]): Promise<{ sent: number; failed: number }> {
        const promises = notifications.map(notification => 
            this.sendNotification(notification).catch(() => false)
        );

        const results = await Promise.allSettled(promises);
        const sent = results.filter(result => 
            result.status === 'fulfilled' && result.value === true
        ).length;

        return {
            sent,
            failed: notifications.length - sent
        };
    }

    /**
     * Send notification to all users in an event
     */
    async broadcastToEvent(eventId: string, notification: Omit<NotificationPayload, 'userId'>): Promise<number> {
        try {
            // Get all users who have bookings or are on waitlist for this event
            const { db } = await import('../config/database');
            
            const usersResult = await db.queryRead(`
                SELECT DISTINCT user_id 
                FROM (
                    SELECT user_id FROM bookings WHERE event_id = $1 AND status = 'confirmed'
                    UNION
                    SELECT user_id FROM waitlists WHERE event_id = $1 AND status = 'active'
                ) users
            `, [eventId]);

            const userIds = usersResult.rows.map((row: { user_id: any; }) => row.user_id);
            
            if (userIds.length === 0) return 0;

            // Create notifications for all users
            const notifications: NotificationPayload[] = userIds.map((userId: any) => ({
                ...notification,
                userId,
                eventId,
                timestamp: new Date()
            }));

            const result = await this.sendBulkNotifications(notifications);
            
            console.log(`📢 Broadcast to event ${eventId}: ${result.sent} sent, ${result.failed} failed`);
            
            return result.sent;

        } catch (error) {
            console.error('❌ Broadcast error:', error);
            return 0;
        }
    }

    /**
     * Get notification statistics
     */
    getNotificationStats(): NotificationStats {
        return { ...this.notificationStats };
    }

    /**
     * Get user's notification history
     */
    async getUserNotifications(userId: string, limit: number = 20): Promise<NotificationPayload[]> {
        try {
            const notifications = await redis.lrange(`notifications:user:${userId}`, 0, limit - 1);
            return notifications.map(n => JSON.parse(n));
        } catch (error) {
            console.error('❌ Get user notifications error:', error);
            return [];
        }
    }

    /**
     * Get connected users count
     */
    getConnectedUsersCount(): number {
        return this.connectedUsers.size;
    }

    /**
     * Get real-time connection status
     */
    getConnectionStats(): any {
        return {
            connected_users: this.connectedUsers.size,
            total_connections: Array.from(this.connectedUsers.values()).reduce((sum, sockets) => sum + sockets.length, 0),
            active_rooms: this.io?.sockets.adapter.rooms.size || 0
        };
    }

    // Private methods
    private async sendViaChannel(channel: string, notification: NotificationPayload): Promise<boolean> {
        const startTime = Date.now();

        try {
            switch (channel) {
                case 'websocket':
                    return await this.sendWebSocketNotification(notification);
                
                case 'email':
                    return await this.sendEmailNotification(notification);
                
                case 'push':
                    return await this.sendPushNotification(notification);
                
                case 'sms':
                    return await this.sendSMSNotification(notification);
                
                default:
                    console.warn(`Unknown notification channel: ${channel}`);
                    return false;
            }
        } catch (error) {
            console.error(`❌ ${channel} notification error:`, error);
            return false;
        }
    }

    private async sendWebSocketNotification(notification: NotificationPayload): Promise<boolean> {
        if (!this.io) return false;

        const userSockets = this.connectedUsers.get(notification.userId);
        if (!userSockets || userSockets.length === 0) {
            return false; // User not connected
        }

        // Send to all user's connected devices
        this.io.to(`user:${notification.userId}`).emit('notification', {
            id: `${Date.now()}-${Math.random()}`,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            priority: notification.priority,
            timestamp: notification.timestamp
        });

        return true;
    }

    private async sendEmailNotification(notification: NotificationPayload): Promise<boolean> {
        try {
            // Get user details for email
            const { db } = await import('../config/database');
            const userResult = await db.query('SELECT email, name FROM users WHERE id = $1', [notification.userId]);
            
            if (!userResult.rows[0]) {
                console.error(`User ${notification.userId} not found for email notification`);
                return false;
            }

            const user = userResult.rows[0];
            
            // Send email using EmailService
            const success = await emailService.sendNotification({
                to: user.email,
                userName: user.name,
                title: notification.title,
                message: notification.message,
                type: notification.type
            });
            
            if (success) {
                console.log(`📧 Email sent to ${user.email}: ${notification.title}`);
            }
            
            return success;
        } catch (error) {
            console.error('Email notification error:', error);
            return false;
        }
    }

    private async sendPushNotification(notification: NotificationPayload): Promise<boolean> {
        // Simulate push notification (in production, integrate with FCM, APNs)
        await new Promise(resolve => setTimeout(resolve, 30)); // Simulate API call
        
        console.log(`📱 Push sent to user ${notification.userId}: ${notification.title}`);
        return Math.random() > 0.05; // 95% success rate simulation
    }

    private async sendSMSNotification(notification: NotificationPayload): Promise<boolean> {
        // Simulate SMS sending (in production, integrate with Twilio, AWS SNS)
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call
        
        console.log(`📱 SMS sent to user ${notification.userId}: ${notification.title}`);
        return Math.random() > 0.02; // 98% success rate simulation
    }

    private async storeNotification(notification: NotificationPayload): Promise<void> {
        try {
            const key = `notifications:user:${notification.userId}`;
            await redis.lpush(key, JSON.stringify(notification));
            await redis.ltrim(key, 0, 99); // Keep last 100 notifications
            await redis.expire(key, 30 * 24 * 60 * 60); // 30 days expiry
        } catch (error) {
            console.error('❌ Store notification error:', error);
        }
    }

    private initializeStats(): void {
        this.notificationStats = {
            total_sent: 0,
            delivered: 0,
            failed: 0,
            channels: {
                websocket: { sent: 0, delivered: 0 },
                email: { sent: 0, delivered: 0 },
                push: { sent: 0, delivered: 0 },
                sms: { sent: 0, delivered: 0 }
            },
            response_times: {
                avg_delivery_ms: 0,
                websocket_ms: 0,
                email_ms: 0
            }
        };
    }

    private updateNotificationStats(notification: NotificationPayload, success: boolean, duration: number): void {
        this.notificationStats.total_sent++;
        
        if (success) {
            this.notificationStats.delivered++;
        } else {
            this.notificationStats.failed++;
        }

        // Update channel stats
        notification.channels.forEach(channel => {
            if (this.notificationStats.channels[channel as keyof typeof this.notificationStats.channels]) {
                this.notificationStats.channels[channel as keyof typeof this.notificationStats.channels].sent++;
                if (success) {
                    this.notificationStats.channels[channel as keyof typeof this.notificationStats.channels].delivered++;
                }
            }
        });

        // Update response times (simple average)
        const currentAvg = this.notificationStats.response_times.avg_delivery_ms;
        const count = this.notificationStats.total_sent;
        this.notificationStats.response_times.avg_delivery_ms = 
            ((currentAvg * (count - 1)) + duration) / count;
    }

    private handleNotificationAck(notificationId: string, status: string): void {
        // Handle delivery confirmations
        console.log(`✅ Notification ${notificationId} ${status}`);
    }

    private setupEventListeners(): void {
        // Listen for waitlist events
        process.on('waitlist:promoted', (data) => {
            this.sendNotification({
                type: 'waitlist_promoted',
                title: 'Great news! You got off the waitlist!',
                message: `A spot opened up for your event. You have 10 minutes to book your ticket.`,
                userId: data.userId,
                eventId: data.eventId,
                data: { promotionId: data.promotionId, windowMinutes: 10 },
                channels: ['websocket', 'email', 'push'],
                priority: 'urgent',
                timestamp: new Date()
            });
        });

        // Listen for booking events  
        process.on('booking:confirmed', (data) => {
            this.sendNotification({
                type: 'booking_confirmed',
                title: 'Booking Confirmed!',
                message: `Your booking for ${data.eventName} has been confirmed. Reference: ${data.bookingReference}`,
                userId: data.userId,
                eventId: data.eventId,
                data: { bookingId: data.bookingId, reference: data.bookingReference },
                channels: ['websocket', 'email'],
                priority: 'high',
                timestamp: new Date()
            });
        });
    }
}

// Extend Socket type for TypeScript
declare module 'socket.io' {
    interface Socket {
        userId?: string;
    }
}

export const notificationService = NotificationService.getInstance();
