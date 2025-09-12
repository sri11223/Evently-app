// src/routes/loadtest.ts
import { Router } from 'express';
import { loadTestController } from '../controllers/LoadTestController';

const router = Router();

// POST /api/v1/load-test/start - Start load test
router.post('/start', loadTestController.startLoadTest.bind(loadTestController));

// GET /api/v1/load-test/status/:testId - Get test status
router.get('/status/:testId', loadTestController.getLoadTestStatus.bind(loadTestController));

// GET /api/v1/load-test/benchmarks - Get performance benchmarks
router.get('/benchmarks', loadTestController.getPerformanceBenchmarks.bind(loadTestController));

export default router;
