// src/routes/events.ts
import { Router } from 'express';
import { eventController } from '../controllers/EventController';

const router = Router();

router.get('/', eventController.getAllEvents.bind(eventController));
router.get('/:eventId', eventController.getEventById.bind(eventController));

export default router;
