// src/routes/analytics.ts - NEW FILE
import { Router } from 'express';
import { analyticsController } from '../controllers/AnalyticsController';
import { advancedAnalyticsController } from '../controllers/AdvancedAnalyticsController';
import { requireAdminAuth } from '../middleware/AuthMiddleware';

const router = Router();

// All analytics routes require admin authentication
router.use(requireAdminAuth);

// GET /api/v1/analytics - Overall analytics
router.get('/', analyticsController.getOverallAnalytics.bind(analyticsController));

// GET /api/v1/analytics/events/:eventId - Event-specific analytics
router.get('/events/:eventId', analyticsController.getEventAnalytics.bind(analyticsController));

// Database and system status
router.get('/database-status', analyticsController.getDatabaseStatus.bind(analyticsController));
router.get('/rate-limits', analyticsController.getRateLimitStats.bind(analyticsController));

// Advanced analytics dashboards
router.get('/dashboard', advancedAnalyticsController.getDashboard.bind(advancedAnalyticsController));
router.get('/realtime', advancedAnalyticsController.getRealtimeMetrics.bind(advancedAnalyticsController));
router.get('/funnel', advancedAnalyticsController.getConversionFunnel.bind(advancedAnalyticsController));
router.get('/predictive', advancedAnalyticsController.getPredictiveAnalytics.bind(advancedAnalyticsController));

export default router;
