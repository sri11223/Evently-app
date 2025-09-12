// src/routes/pricing.ts
import { Router } from 'express';
import { pricingController } from '../controllers/PricingController';
import { apiRateLimit } from '../middleware/RateLimitMiddleware';

const router = Router();

// Apply rate limiting to pricing routes
router.use(apiRateLimit);

// GET /api/v1/pricing/recommendations - All pricing recommendations
router.get('/recommendations', pricingController.getAllPricingRecommendations.bind(pricingController));

// GET /api/v1/pricing/event/:eventId - Pricing for specific event
router.get('/event/:eventId', pricingController.getEventPricing.bind(pricingController));

// POST /api/v1/pricing/event/:eventId/apply - Apply dynamic pricing
router.post('/event/:eventId/apply', pricingController.applyPricing.bind(pricingController));

export default router;
