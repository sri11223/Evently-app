// src/controllers/AuthController.ts
import { Response } from 'express';
import { AuthService, RegisterRequest, LoginRequest } from '../services/AuthService';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';

export class AuthController {
    
    /**
     * POST /api/v1/auth/register
     * Register a new user
     */
    public async register(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const registerData: RegisterRequest = {
                email: req.body.email,
                name: req.body.name,
                password: req.body.password,
                role: req.body.role || 'user'
            };
            
            const result = await AuthService.register(registerData);
            
            if (result.success) {
                res.status(201).json({
                    success: true,
                    message: 'User registered successfully',
                    data: result
                });
            } else {
                const statusCode = result.code === 'EMAIL_EXISTS' ? 409 : 400;
                res.status(statusCode).json(result);
            }
            
        } catch (error) {
            console.error('❌ Register controller error:', error);
            res.status(500).json({
                success: false,
                error: 'Registration service unavailable'
            });
        }
    }
    
    /**
     * POST /api/v1/auth/login
     * User login
     */
    public async login(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const loginData: LoginRequest = {
                email: req.body.email,
                password: req.body.password
            };
            
            const result = await AuthService.login(loginData);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Login successful',
                    data: result
                });
            } else {
                const statusCode = result.code === 'ACCOUNT_DEACTIVATED' ? 403 : 401;
                res.status(statusCode).json(result);
            }
            
        } catch (error) {
            console.error('❌ Login controller error:', error);
            res.status(500).json({
                success: false,
                error: 'Authentication service unavailable'
            });
        }
    }
    
    /**
     * GET /api/v1/auth/profile
     * Get user profile (requires authentication)
     */
    public async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }
            
            const result = await AuthService.getProfile(req.user.id);
            
            if (result.success) {
                res.json(result);
            } else {
                const statusCode = result.code === 'USER_NOT_FOUND' ? 404 : 500;
                res.status(statusCode).json(result);
            }
            
        } catch (error) {
            console.error('❌ Get profile controller error:', error);
            res.status(500).json({
                success: false,
                error: 'Profile service unavailable'
            });
        }
    }
    
    /**
     * POST /api/v1/auth/change-password
     * Change user password (requires authentication)
     */
    public async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }
            
            const { currentPassword, newPassword } = req.body;
            
            if (!currentPassword || !newPassword) {
                res.status(400).json({
                    success: false,
                    error: 'Current password and new password are required'
                });
                return;
            }
            
            const result = await AuthService.changePassword(
                req.user.id, 
                currentPassword, 
                newPassword
            );
            
            if (result.success) {
                res.json(result);
            } else {
                const statusCode = result.code === 'INVALID_CURRENT_PASSWORD' ? 400 : 500;
                res.status(statusCode).json(result);
            }
            
        } catch (error) {
            console.error('❌ Change password controller error:', error);
            res.status(500).json({
                success: false,
                error: 'Password change service unavailable'
            });
        }
    }
    
    /**
     * POST /api/v1/auth/logout
     * User logout (token-based, so just acknowledgment)
     */
    public async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            // With JWT, logout is mainly client-side (remove token)
            // But we can log the event for analytics
            
            const userId = req.user?.id || 'anonymous';
            console.log(`👋 User logged out: ${userId}`);
            
            res.json({
                success: true,
                message: 'Logged out successfully',
                hint: 'Remove the JWT token from your client storage'
            });
            
        } catch (error) {
            console.error('❌ Logout controller error:', error);
            res.status(500).json({
                success: false,
                error: 'Logout service unavailable'
            });
        }
    }
    
    /**
     * GET /api/v1/auth/validate
     * Validate current token
     */
    public async validateToken(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid or expired token',
                    valid: false
                });
                return;
            }
            
            res.json({
                success: true,
                message: 'Token is valid',
                valid: true,
                user: {
                    id: req.user.id,
                    email: req.user.email,
                    name: req.user.name,
                    role: req.user.role
                }
            });
            
        } catch (error) {
            console.error('❌ Validate token controller error:', error);
            res.status(500).json({
                success: false,
                error: 'Token validation service unavailable'
            });
        }
    }
    
    /**
     * GET /api/v1/auth/admin/users
     * List all users (admin only)
     */
    public async listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            // This endpoint requires admin role (handled by requireAdmin middleware)
            
            const page = parseInt(req.query.page as string) || 1;
            const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
            const offset = (page - 1) * limit;
            
            const usersQuery = `
                SELECT 
                    u.id, u.email, u.name, u.role, u.is_active, u.created_at,
                    COUNT(DISTINCT b.id) as total_bookings,
                    COALESCE(SUM(b.total_amount), 0) as total_spent
                FROM users u
                LEFT JOIN bookings b ON u.id = b.user_id AND b.status = 'confirmed'
                GROUP BY u.id, u.email, u.name, u.role, u.is_active, u.created_at
                ORDER BY u.created_at DESC
                LIMIT $1 OFFSET $2
            `;
            
            const countQuery = 'SELECT COUNT(*) as total FROM users';
            
            const [usersResult, countResult] = await Promise.all([
                require('../config/database').db.query(usersQuery, [limit, offset]),
                require('../config/database').db.query(countQuery)
            ]);
            
            const users = usersResult.rows.map((user: any) => ({
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                isActive: user.is_active,
                memberSince: user.created_at,
                stats: {
                    totalBookings: parseInt(user.total_bookings),
                    totalSpent: parseFloat(user.total_spent)
                }
            }));
            
            res.json({
                success: true,
                data: users,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0].total),
                    pages: Math.ceil(countResult.rows[0].total / limit)
                }
            });
            
        } catch (error) {
            console.error('❌ List users controller error:', error);
            res.status(500).json({
                success: false,
                error: 'User listing service unavailable'
            });
        }
    }
}

export const authController = new AuthController();