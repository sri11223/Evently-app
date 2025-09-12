// src/routes/index.ts - COMPLETE FILE
import { Router } from 'express';
import eventRoutes from './events';
import bookingRoutes from './bookings';
import analyticsRoutes from './analytics';

const router = Router();

// Mount routes
router.use('/events', eventRoutes);
router.use('/bookings', bookingRoutes);
router.use('/analytics', analyticsRoutes);

// API Info endpoint
router.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'Evently Booking API',
        version: '1.0.0',
        endpoints: {
            events: '/api/v1/events',
            bookings: '/api/v1/bookings',
            analytics: '/api/v1/analytics',
            health: '/health'
        },
        features: [
            'Event management (CRUD)',
            'Concurrent booking with distributed locking',
            'Booking cancellation and history',
            'Real-time analytics dashboard',
            'Optimistic locking for data consistency',
            'Redis caching for performance'
        ]
    });
});

export default router;
