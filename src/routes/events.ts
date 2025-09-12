// src/routes/events.ts - COMPLETE FILE
import { Router } from 'express';
import { eventController } from '../controllers/EventController';

const router = Router();

// GET /api/v1/events - Get all events
router.get('/', eventController.getAllEvents.bind(eventController));

// GET /api/v1/events/:eventId - Get event by ID
router.get('/:eventId', eventController.getEventById.bind(eventController));

// POST /api/v1/events - Create new event
router.post('/', eventController.createEvent.bind(eventController));

// PUT /api/v1/events/:eventId - Update event
router.put('/:eventId', eventController.updateEvent.bind(eventController));

// DELETE /api/v1/events/:eventId - Delete/Cancel event
router.delete('/:eventId', eventController.deleteEvent.bind(eventController));

export default router;
