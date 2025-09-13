// src/routes/waitlist.ts
import { Router } from 'express';
import { waitlistController } from '../controllers/WaitlistController';
import { apiRateLimit } from '../middleware/RateLimitMiddleware';

const router = Router();

// Apply rate limiting
router.use(apiRateLimit);

// POST /api/v1/waitlist/:eventId/join - Join waitlist
router.post('/:eventId/join', waitlistController.joinWaitlist.bind(waitlistController));

// DELETE /api/v1/waitlist/:eventId/user/:userId - Leave waitlist
router.delete('/:eventId/user/:userId', waitlistController.leaveWaitlist.bind(waitlistController));

// GET /api/v1/waitlist/:eventId/user/:userId - Get position
router.get('/:eventId/user/:userId', waitlistController.getWaitlistPosition.bind(waitlistController));

// GET /api/v1/waitlist/:eventId/stats - Get waitlist stats
router.get('/:eventId/stats', waitlistController.getWaitlistStats.bind(waitlistController));

// POST /api/v1/waitlist/:eventId/process - Admin: Process waitlist
router.post('/:eventId/process', waitlistController.processWaitlist.bind(waitlistController));

export default router;
