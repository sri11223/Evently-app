// src/routes/index.ts - ADD CACHE ROUTES
import { Router } from 'express';
import eventRoutes from './events';
import bookingRoutes from './bookings';
import analyticsRoutes from './analytics';
import cacheRoutes from './cache';

const router = Router();

// Mount routes
router.use('/events', eventRoutes);
router.use('/bookings', bookingRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/cache', cacheRoutes);

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
            cache: '/api/v1/cache',
            health: '/health'
        },
        features: [
            'Event management (CRUD)',
            'Concurrent booking with distributed locking',
            'Database sharding with 4 shards',
            'Master-replica replication',
            'Multi-layer intelligent caching',
            'Real-time cache analytics',
            'Optimistic locking for data consistency',
            'Advanced performance monitoring'
        ]
    });
});

export default router;
