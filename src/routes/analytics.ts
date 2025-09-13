// src/routes/analytics.ts - NEW FILE
import { Router } from 'express';
import { analyticsController } from '../controllers/AnalyticsController';
import { advancedAnalyticsController } from '../controllers/AdvancedAnalyticsController';


const router = Router();

// GET /api/v1/analytics - Overall analytics
router.get('/', analyticsController.getOverallAnalytics.bind(analyticsController));

// GET /api/v1/analytics/events/:eventId - Event-specific analytics
router.get('/events/:eventId', analyticsController.getEventAnalytics.bind(analyticsController));

// Add this route
router.get('/database-status', analyticsController.getDatabaseStatus.bind(analyticsController));


router.get('/rate-limits', analyticsController.getRateLimitStats.bind(analyticsController));

router.get('/dashboard', advancedAnalyticsController.getDashboard.bind(advancedAnalyticsController));
router.get('/realtime', advancedAnalyticsController.getRealtimeMetrics.bind(advancedAnalyticsController));
router.get('/funnel', advancedAnalyticsController.getConversionFunnel.bind(advancedAnalyticsController));
router.get('/predictive', advancedAnalyticsController.getPredictiveAnalytics.bind(advancedAnalyticsController));

export default router;
