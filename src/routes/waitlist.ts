// src/routes/waitlist.ts
import { Router } from 'express';
import { waitlistController } from '../controllers/WaitlistController';
import { apiRateLimit } from '../middleware/RateLimitMiddleware';
import { authenticateRequired, requireAdmin } from '../middleware/AuthMiddleware';

const router = Router();

// Apply rate limiting
router.use(apiRateLimit);

// POST /api/v1/waitlist/:eventId/join - Join waitlist (requires authentication)
router.post('/:eventId/join', authenticateRequired, waitlistController.joinWaitlist.bind(waitlistController));

// DELETE /api/v1/waitlist/:eventId/user/:userId - Leave waitlist (requires authentication)
router.delete('/:eventId/user/:userId', authenticateRequired, waitlistController.leaveWaitlist.bind(waitlistController));

// GET /api/v1/waitlist/:eventId/user/:userId - Get position (requires authentication)
router.get('/:eventId/user/:userId', authenticateRequired, waitlistController.getWaitlistPosition.bind(waitlistController));

// GET /api/v1/waitlist/:eventId/stats - Get waitlist stats (admin only)
router.get('/:eventId/stats', requireAdmin, waitlistController.getWaitlistStats.bind(waitlistController));

// POST /api/v1/waitlist/:eventId/process - Admin: Process waitlist (admin only)
router.post('/:eventId/process', requireAdmin, waitlistController.processWaitlist.bind(waitlistController));

export default router;
