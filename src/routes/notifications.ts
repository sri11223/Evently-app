// src/routes/notifications.ts
import { Router } from 'express';
import { notificationController } from '../controllers/NotificationController';
import { apiRateLimit } from '../middleware/RateLimitMiddleware';

const router = Router();

// Apply rate limiting
router.use(apiRateLimit);

// POST /api/v1/notifications/send - Send test notification
router.post('/send', notificationController.sendTestNotification.bind(notificationController));

// POST /api/v1/notifications/broadcast/:eventId - Broadcast to event
router.post('/broadcast/:eventId', notificationController.broadcastToEvent.bind(notificationController));

// GET /api/v1/notifications/user/:userId - Get user notifications
router.get('/user/:userId', notificationController.getUserNotifications.bind(notificationController));

// GET /api/v1/notifications/stats - Get notification statistics
router.get('/stats', notificationController.getNotificationStats.bind(notificationController));

export default router;
