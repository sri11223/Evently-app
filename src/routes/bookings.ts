// src/routes/bookings.ts
import { Router } from 'express';
import { bookingController } from '../controllers/BookingController';

const router = Router();

router.post('/', bookingController.bookTickets.bind(bookingController));

export default router;
