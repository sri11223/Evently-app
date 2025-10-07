// Debug routes for troubleshooting email issues
import { Router } from 'express';
import { EmailDebugController } from '../controllers/EmailDebugController';

const router = Router();

/**
 * GET /api/v1/debug/email
 * Debug email configuration on Render
 * Temporary route for troubleshooting SendGrid timeout issues
 */
router.get('/email', EmailDebugController.debugEmailConfig);

export default router;