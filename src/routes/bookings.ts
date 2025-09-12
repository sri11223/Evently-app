// src/routes/bookings.ts - COMPLETE FILE
import { Router } from 'express';
import { bookingController } from '../controllers/BookingController';

const router = Router();

// POST /api/v1/bookings - Book tickets
router.post('/', bookingController.bookTickets.bind(bookingController));

// PUT /api/v1/bookings/:bookingId/cancel - Cancel booking
router.put('/:bookingId/cancel', bookingController.cancelBooking.bind(bookingController));

// GET /api/v1/bookings/reference/:reference - Get booking by reference
router.get('/reference/:reference', bookingController.getBookingByReference.bind(bookingController));

// GET /api/v1/bookings/user/:userId - Get user bookings
router.get('/user/:userId', bookingController.getUserBookings.bind(bookingController));

export default router;
