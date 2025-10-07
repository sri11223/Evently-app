// src/routes/notifications.ts
import { Router } from 'express';
import { notificationController } from '../controllers/NotificationController';
import { apiRateLimit } from '../middleware/RateLimitMiddleware';
import { authenticateRequired, requireAdminAuth } from '../middleware/AuthMiddleware';

const router = Router();

// Apply rate limiting
router.use(apiRateLimit);

// POST /api/v1/notifications/send - Send test notification (admin only)
router.post('/send', requireAdminAuth, notificationController.sendTestNotification.bind(notificationController));

// POST /api/v1/notifications/broadcast/:eventId - Broadcast to event (admin only)
router.post('/broadcast/:eventId', requireAdminAuth, notificationController.broadcastToEvent.bind(notificationController));

// GET /api/v1/notifications/user/:userId - Get user notifications (requires authentication)
router.get('/user/:userId', authenticateRequired, notificationController.getUserNotifications.bind(notificationController));

// GET /api/v1/notifications/stats - Get notification statistics (admin only)
router.get('/stats', requireAdminAuth, notificationController.getNotificationStats.bind(notificationController));

export default router;
