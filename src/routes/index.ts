// src/routes/index.ts
import { Router } from 'express';
import eventRoutes from './events';
import bookingRoutes from './bookings';

const router = Router();

router.use('/events', eventRoutes);
router.use('/bookings', bookingRoutes);

router.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'Evently Booking API',
        version: '1.0.0',
        endpoints: [
            'GET /api/v1/events - Get all events',
            'GET /api/v1/events/:id - Get event by ID',
            'POST /api/v1/bookings - Book tickets'
        ]
    });
});

export default router;
