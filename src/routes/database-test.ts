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
 * @route POST /api/v1/db-test/fix-users
 * @desc Fix users table by adding missing is_active column
 * @access Public (for debugging purposes)
 */
router.post('/fix-users', databaseTestController.fixUsersTable.bind(databaseTestController));

export default router;