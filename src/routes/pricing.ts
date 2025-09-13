// src/routes/pricing.ts
import { Router } from 'express';
import { pricingController } from '../controllers/PricingController';
import { apiRateLimit } from '../middleware/RateLimitMiddleware';
import { authenticateOptional, requireAdmin } from '../middleware/AuthMiddleware';

const router = Router();

// Apply rate limiting to pricing routes
router.use(apiRateLimit);

// GET /api/v1/pricing/recommendations - All pricing recommendations (admin only)
router.get('/recommendations', requireAdmin, pricingController.getAllPricingRecommendations.bind(pricingController));

// GET /api/v1/pricing/event/:eventId - Pricing for specific event (public with optional auth for analytics)
router.get('/event/:eventId', authenticateOptional, pricingController.getEventPricing.bind(pricingController));

// POST /api/v1/pricing/event/:eventId/apply - Apply dynamic pricing (admin only)
router.post('/event/:eventId/apply', requireAdmin, pricingController.applyPricing.bind(pricingController));

export default router;
