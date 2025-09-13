// src/controllers/NotificationController.ts
import { Request, Response } from 'express';
import { notificationService } from '../services/NotificationService';

export class NotificationController {

    /**
     * Send test notification
     */
   /**
 * Send test notification
 */
public async sendTestNotification(req: Request, res: Response): Promise<void> {
    try {
        const { user_id, type = 'event_update', title, message } = req.body;

        if (!user_id || !title || !message) {
            res.status(400).json({
                success: false,
                error: 'user_id, title, and message are required'
            });
            return;
        }

        // Allow more notification types for testing
        const validTypes = [
            'booking_confirmed', 'waitlist_promoted', 'waitlist_joined', 
            'seat_available', 'event_reminder', 'price_change', 'booking_cancelled',
            'waitlist_position_improved', 'system_update', 'event_update', 'test'
        ];

        if (!validTypes.includes(type)) {
            res.status(400).json({
                success: false,
                error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}`
            });
            return;
        }

        const success = await notificationService.sendNotification({
            type: type as any,
            title,
            message,
            userId: user_id,
            data: req.body.data || {},
            channels: ['websocket', 'email'],
            priority: req.body.priority || 'medium',
            timestamp: new Date()
        });

        res.json({
            success,
            message: success ? 'Notification sent successfully' : 'Failed to send notification',
            notification_type: type,
            channels_used: ['websocket', 'email']
        });

    } catch (error) {
        console.error('❌ Send test notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send notification'
        });
    }
}


    /**
     * Broadcast notification to event
     */
  /**
 * Broadcast notification to event
 */
public async broadcastToEvent(req: Request, res: Response): Promise<void> {
    try {
        const { eventId } = req.params;
        const { type = 'event_update', title, message, priority = 'medium' } = req.body;

        if (!title || !message) {
            res.status(400).json({
                success: false,
                error: 'title and message are required'
            });
            return;
        }

        // Allow more notification types for broadcasting
        const validTypes = [
            'booking_confirmed', 'waitlist_promoted', 'waitlist_joined', 
            'seat_available', 'event_reminder', 'price_change', 'booking_cancelled',
            'waitlist_position_improved', 'system_update', 'event_update', 'test'
        ];

        if (!validTypes.includes(type)) {
            res.status(400).json({
                success: false,
                error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}`
            });
            return;
        }

        const sent = await notificationService.broadcastToEvent(eventId, {
            type: type as any,
            title,
            message,
            channels: ['websocket', 'email'],
            priority: priority as any,
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: `Broadcast sent to ${sent} users`,
            users_notified: sent,
            notification_type: type,
            event_id: eventId
        });

    } catch (error) {
        console.error('❌ Broadcast notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to broadcast notification'
        });
    }
}


    /**
     * Get user's notification history
     */
    public async getUserNotifications(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;
            const limit = parseInt(req.query.limit as string) || 20;

            const notifications = await notificationService.getUserNotifications(userId, limit);

            res.json({
                success: true,
                data: notifications,
                count: notifications.length
            });

        } catch (error) {
            console.error('❌ Get user notifications error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve notifications'
            });
        }
    }

    /**
     * Get notification statistics
     */
    public async getNotificationStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = notificationService.getNotificationStats();
            const connectionStats = notificationService.getConnectionStats();

            res.json({
                success: true,
                data: {
                    delivery_stats: stats,
                    connection_stats: connectionStats,
                    performance: {
                        avg_delivery_time: `${stats.response_times.avg_delivery_ms.toFixed(2)}ms`,
                        success_rate: stats.total_sent > 0 ? 
                            `${((stats.delivered / stats.total_sent) * 100).toFixed(2)}%` : '0%',
                        connected_users: connectionStats.connected_users
                    }
                },
                timestamp: new Date()
            });

        } catch (error) {
            console.error('❌ Get notification stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve notification statistics'
            });
        }
    }
}

export const notificationController = new NotificationController();
