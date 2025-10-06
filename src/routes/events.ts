// src/routes/events.ts - COMPLETE FILE
import { Router } from 'express';
import { eventController } from '../controllers/EventController';
import { apiRateLimit } from '../middleware/RateLimitMiddleware';
import { authenticateOptional, authenticateRequired, requireAdmin } from '../middleware/AuthMiddleware';

const router = Router();

router.use(apiRateLimit);

// Public routes (no authentication required)
router.get('/popular', eventController.getPopularEvents.bind(eventController));
router.get('/search', authenticateOptional, eventController.searchEvents.bind(eventController));
router.get('/', authenticateOptional, eventController.getAllEvents.bind(eventController));
router.get('/:eventId', authenticateOptional, eventController.getEventById.bind(eventController));

// Admin-only routes (require admin authentication)
router.post('/', authenticateRequired, requireAdmin, eventController.createEvent.bind(eventController));
router.put('/:eventId', authenticateRequired, requireAdmin, eventController.updateEvent.bind(eventController));
router.delete('/:eventId', authenticateRequired, requireAdmin, eventController.deleteEvent.bind(eventController));

// Add this route


export default router;
