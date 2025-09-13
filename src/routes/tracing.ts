// src/routes/tracing.ts
import { Router } from 'express';
import { tracingController } from '../controllers/TracingController';
import { requireAdminAuth } from '../middleware/AuthMiddleware';

const router = Router();

// All tracing routes require admin authentication
router.use(requireAdminAuth);

// GET /api/v1/tracing/stats - Tracing statistics
router.get('/stats', tracingController.getTracingStats.bind(tracingController));

// GET /api/v1/tracing/traces - Recent traces
router.get('/traces', tracingController.getRecentTraces.bind(tracingController));

// GET /api/v1/tracing/search - Search traces
router.get('/search', tracingController.searchTraces.bind(tracingController));

// GET /api/v1/tracing/trace/:traceId - Specific trace
router.get('/trace/:traceId', tracingController.getTrace.bind(tracingController));

export default router;
