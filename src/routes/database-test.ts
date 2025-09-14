// src/routes/database-test.ts
import { Router } from 'express';
import { databaseTestController } from '../controllers/DatabaseTestController';

const router = Router();

/**
 * @route GET /api/v1/db-test/connection
 * @desc Test database connection and show tables
 * @access Public (for demo purposes)
 */
router.get('/connection', databaseTestController.testConnection.bind(databaseTestController));

/**
 * @route POST /api/v1/db-test/initialize
 * @desc Initialize database with tables and sample data
 * @access Public (for demo purposes)
 */
router.post('/initialize', databaseTestController.initializeData.bind(databaseTestController));

/**
 * @route GET /api/v1/db-test/events-schema
 * @desc Describe events table structure and show sample data
 * @access Public (for debugging purposes)
 */
router.get('/events-schema', databaseTestController.describeEventsTable.bind(databaseTestController));

/**
 * @route GET /api/v1/db-test/events-direct
 * @desc Query events directly without cache for debugging
 * @access Public (for debugging purposes)
 */
router.get('/events-direct', databaseTestController.testEventQuery.bind(databaseTestController));

export default router;