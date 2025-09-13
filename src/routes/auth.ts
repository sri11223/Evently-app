// src/routes/auth.ts
import express from 'express';
import { authController } from '../controllers/AuthController';
import { authenticateOptional, authenticateRequired, requireAdmin } from '../middleware/AuthMiddleware';

const router = express.Router();

// Public endpoints (no authentication required)
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));

// Protected endpoints (authentication required)
router.use(authenticateRequired); // Apply to all remaining routes

router.get('/profile', authController.getProfile.bind(authController));
router.post('/change-password', authController.changePassword.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.get('/validate', authController.validateToken.bind(authController));

// Admin-only endpoints
router.use('/admin', requireAdmin); // Apply admin requirement to admin routes

router.get('/admin/users', authController.listUsers.bind(authController));

export default router;