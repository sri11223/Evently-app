// src/routes/cache.ts - VERIFY THIS FILE EXISTS
import { Router } from 'express';
import { cacheController } from '../controllers/CacheController';

const router = Router();

// GET /api/v1/cache/stats - Cache statistics
router.get('/stats', cacheController.getCacheStats.bind(cacheController));

// GET /api/v1/cache/metrics - Real-time metrics  
router.get('/metrics', cacheController.getCacheMetrics.bind(cacheController));

// POST /api/v1/cache/warm - Warm cache
router.post('/warm', cacheController.warmCache.bind(cacheController));

// POST /api/v1/cache/invalidate - Invalidate cache
router.post('/invalidate', cacheController.invalidateCache.bind(cacheController));

export default router;
