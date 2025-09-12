// src/routes/analytics.ts - NEW FILE
import { Router } from 'express';
import { analyticsController } from '../controllers/AnalyticsController';

const router = Router();

// GET /api/v1/analytics - Overall analytics
router.get('/', analyticsController.getOverallAnalytics.bind(analyticsController));

// GET /api/v1/analytics/events/:eventId - Event-specific analytics
router.get('/events/:eventId', analyticsController.getEventAnalytics.bind(analyticsController));

export default router;
