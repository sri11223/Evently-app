// src/middleware/AuthMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';

// Extend Request interface to include user
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
}

interface JwtPayload {
    userId: string;
    email: string;
    role: string;
}

export class AuthMiddleware {
    private static readonly JWT_SECRET = process.env.JWT_SECRET || 'evently-super-secret-key-change-in-production';
    private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

    /**
     * Generate JWT token for user
     */
    public static generateToken(userId: string, email: string, role: string): string {
        return jwt.sign(
            { userId, email, role } as object,
            AuthMiddleware.JWT_SECRET,
            { expiresIn: AuthMiddleware.JWT_EXPIRES_IN } as jwt.SignOptions
        );
    }

    /**
     * Verify JWT token
     */
    public static verifyToken(token: string): JwtPayload {
        return jwt.verify(token, AuthMiddleware.JWT_SECRET) as JwtPayload;
    }

    /**
     * Authentication middleware - validates JWT token
     * Makes authentication OPTIONAL by default
     */
    public static async authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const authHeader = req.headers.authorization;
            
            // If no auth header, continue without authentication (optional auth)
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                console.log('📝 No authentication provided - continuing as anonymous user');
                return next();
            }

            const token = authHeader.substring(7); // Remove 'Bearer ' prefix
            
            try {
                const decoded = AuthMiddleware.verifyToken(token);
                console.log('🔍 Decoded token:', decoded);
                
                // Get user from database
                const result = await db.query(
                    'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
                    [decoded.userId]
                );
                
                if (result.rows.length === 0) {
                    console.log('❌ User not found in database');
                    res.status(401).json({
                        success: false,
                        error: 'User not found'
                    });
                    return;
                }
                
                if (!result.rows[0].is_active) {
                    console.log('❌ User account is deactivated');
                    res.status(403).json({
                        success: false,
                        error: 'Account is deactivated'
                    });
                    return;
                }

                // Attach user to request
                req.user = result.rows[0];
                console.log(`✅ Authenticated user: ${result.rows[0].email} (${result.rows[0].role})`);
                
                next();
            } catch (tokenError) {
                console.log('❌ Invalid token:', tokenError);
                res.status(401).json({
                    success: false,
                    error: 'Invalid authentication token'
                });
                return;
            }
            
        } catch (error) {
            console.error('❌ Authentication error:', error);
            res.status(500).json({
                success: false,
                error: 'Authentication service error'
            });
        }
    }

    /**
     * Required authentication middleware
     */
    public static async requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const authHeader = req.headers.authorization;
            
            // Authentication is required
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                console.log('❌ No authentication token provided');
                res.status(401).json({
                    success: false,
                    error: 'Authentication token required',
                    hint: 'Include Authorization: Bearer <token> header'
                });
                return;
            }

            const token = authHeader.substring(7); // Remove 'Bearer ' prefix
            
            try {
                const decoded = AuthMiddleware.verifyToken(token);
                console.log('🔍 Decoded token for required auth:', decoded);
                
                // Get user from database
                const result = await db.query(
                    'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
                    [decoded.userId]
                );
                
                if (result.rows.length === 0) {
                    console.log('❌ User not found in database');
                    res.status(401).json({
                        success: false,
                        error: 'User not found'
                    });
                    return;
                }
                
                if (!result.rows[0].is_active) {
                    console.log('❌ User account is deactivated');
                    res.status(403).json({
                        success: false,
                        error: 'Account is deactivated'
                    });
                    return;
                }

                // Attach user to request
                req.user = result.rows[0];
                console.log(`✅ Required auth successful: ${result.rows[0].email} (${result.rows[0].role})`);
                
                next();
                
            } catch (tokenError) {
                console.log('❌ Invalid token for required auth:', tokenError);
                res.status(401).json({
                    success: false,
                    error: 'Invalid authentication token'
                });
                return;
            }
            
        } catch (error) {
            console.error('❌ Required authentication error:', error);
            res.status(500).json({
                success: false,
                error: 'Authentication service error'
            });
        }
    }

    /**
     * Admin-only middleware - requires admin role
     */
    public static async requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            // Check if user has admin role (user should already be authenticated)
            if (!req.user || req.user.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Admin access required. Current role: ' + (req.user?.role || 'none'),
                    hint: 'Contact administrator to upgrade your account'
                });
                return;
            }

            console.log(`👑 Admin access granted to: ${req.user.email}`);
            next();
            
        } catch (error) {
            console.error('❌ Admin authorization error:', error);
            res.status(500).json({
                success: false,
                error: 'Authorization service error'
            });
        }
    }

    /**
     * Combined admin authentication middleware - authenticates and requires admin role
     */
    public static async requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const authHeader = req.headers.authorization;
            
            // Authentication is required for admin access
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                console.log('❌ No authentication token provided for admin endpoint');
                res.status(401).json({
                    success: false,
                    error: 'Admin authentication token required',
                    hint: 'Include Authorization: Bearer <token> header with admin credentials'
                });
                return;
            }

            const token = authHeader.substring(7); // Remove 'Bearer ' prefix
            
            try {
                const decoded = AuthMiddleware.verifyToken(token);
                console.log('🔍 Decoded admin token:', decoded);
                
                // Get user from database
                const result = await db.query(
                    'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
                    [decoded.userId]
                );
                
                if (result.rows.length === 0) {
                    console.log('❌ Admin user not found in database');
                    res.status(401).json({
                        success: false,
                        error: 'User not found'
                    });
                    return;
                }
                
                if (!result.rows[0].is_active) {
                    console.log('❌ Admin user account is deactivated');
                    res.status(403).json({
                        success: false,
                        error: 'Account is deactivated'
                    });
                    return;
                }

                // Check admin role
                if (result.rows[0].role !== 'admin') {
                    console.log(`❌ User ${result.rows[0].email} is not admin (role: ${result.rows[0].role})`);
                    res.status(403).json({
                        success: false,
                        error: 'Admin access required',
                        currentRole: result.rows[0].role,
                        hint: 'Contact administrator to upgrade your account'
                    });
                    return;
                }

                // Attach user to request
                req.user = result.rows[0];
                console.log(`👑 Admin authentication successful: ${result.rows[0].email}`);
                
                next();
                
            } catch (tokenError) {
                console.log('❌ Invalid admin token:', tokenError);
                res.status(401).json({
                    success: false,
                    error: 'Invalid authentication token'
                });
                return;
            }
            
        } catch (error) {
            console.error('❌ Admin authentication error:', error);
            res.status(500).json({
                success: false,
                error: 'Authentication service error'
            });
        }
    }

    /**
     * Middleware to add user context if available (for analytics)
     */
    public static async addUserContext(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        // This middleware just adds user context without requiring authentication
        // Useful for tracking authenticated vs anonymous usage
        
        try {
            await AuthMiddleware.authenticate(req, res, (error?: any) => {
                if (error) {
                    console.log('⚠️ User context error, continuing as anonymous:', error.message);
                }
                
                // Add analytics context
                (req as any).userContext = {
                    isAuthenticated: !!req.user,
                    userId: req.user?.id || 'anonymous',
                    userRole: req.user?.role || 'anonymous',
                    timestamp: new Date()
                };
                
                next();
            });
        } catch (error) {
            console.log('⚠️ User context middleware error, continuing:', error);
            next();
        }
    }
}

export const { authenticate, requireAuth, requireAdmin, requireAdminAuth, addUserContext } = AuthMiddleware;

// Named convenience exports for different authentication modes
export const authenticateOptional = AuthMiddleware.authenticate;
export const authenticateRequired = AuthMiddleware.requireAuth;
export const authenticateAdmin = AuthMiddleware.requireAdminAuth;