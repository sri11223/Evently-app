import express from 'express';
import { DatabaseInitController } from '../controllers/DatabaseInitController';
import { Pool } from 'pg';

const router = express.Router();

// Get database pool from config
import { pool } from '../config/database';

const dbController = new DatabaseInitController(pool);

/**
 * @route POST /api/v1/database/init
 * @desc Initialize database tables and sample data
 * @access Public (for initial setup)
 */
router.post('/init', async (req, res) => {
    await dbController.initializeDatabase(req, res);
});

/**
 * @route GET /api/v1/database/status
 * @desc Get database connection status and table information
 * @access Public
 */
router.get('/status', async (req, res) => {
    await dbController.getDatabaseStatus(req, res);
});

/**
 * @route POST /api/v1/database/reset
 * @desc Reset database (drop and recreate all tables)
 * @access Public (for development)
 */
router.post('/reset', async (req, res) => {
    await dbController.resetDatabase(req, res);
});

export default router;