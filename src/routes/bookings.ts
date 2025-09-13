// src/routes/bookings.ts - COMPLETE FILE
import { Router } from 'express';
import { bookingController } from '../controllers/BookingController';
import { bookingRateLimit } from '../middleware/RateLimitMiddleware';
import { authenticateRequired, authenticateOptional } from '../middleware/AuthMiddleware';

const router = Router();

// POST /api/v1/bookings - Book tickets (requires authentication)
router.post('/', bookingRateLimit, authenticateRequired, bookingController.bookTickets.bind(bookingController));

// PUT /api/v1/bookings/:bookingId/cancel - Cancel booking (requires authentication)
router.put('/:bookingId/cancel', authenticateRequired, bookingController.cancelBooking.bind(bookingController));

// GET /api/v1/bookings/reference/:reference - Get booking by reference (public with optional auth)
router.get('/reference/:reference', authenticateOptional, bookingController.getBookingByReference.bind(bookingController));

// GET /api/v1/bookings/user/:userId - Get user bookings (requires authentication)
router.get('/user/:userId', authenticateRequired, bookingController.getUserBookings.bind(bookingController));

export default router;
