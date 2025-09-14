// src/services/AuthService.ts
import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { randomUUID } from 'crypto';

export interface RegisterRequest {
    email: string;
    name: string;
    password: string;
    role?: 'user' | 'admin';
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface AuthResponse {
    success: true;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
    token: string;
    expiresIn: string;
}

export interface AuthError {
    success: false;
    error: string;
    code?: string;
}

export class AuthService {
    private static readonly SALT_ROUNDS = 12;
    
    /**
     * Register a new user
     */
    public static async register(data: RegisterRequest): Promise<AuthResponse | AuthError> {
        try {
            const { email, name, password, role = 'user' } = data;
            
            // Validate input
            if (!email || !name || !password) {
                return {
                    success: false,
                    error: 'Email, name, and password are required',
                    code: 'MISSING_FIELDS'
                };
            }
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return {
                    success: false,
                    error: 'Invalid email format',
                    code: 'INVALID_EMAIL'
                };
            }
            
            // Password validation
            if (password.length < 8) {
                return {
                    success: false,
                    error: 'Password must be at least 8 characters long',
                    code: 'WEAK_PASSWORD'
                };
            }
            
            // Check if user already exists
            const existingUser = await db.query(
                'SELECT id FROM users WHERE email = $1',
                [email.toLowerCase()]
            );
            
            if (existingUser.rows.length > 0) {
                return {
                    success: false,
                    error: 'User with this email already exists',
                    code: 'EMAIL_EXISTS'
                };
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, AuthService.SALT_ROUNDS);
            
            // Create user
            const userId = randomUUID();
            const createUserQuery = `
                INSERT INTO users (id, email, name, password_hash, role, is_active)
                VALUES ($1, $2, $3, $4, $5, true)
                RETURNING id, email, name, role, created_at
            `;
            
            const result = await db.query(createUserQuery, [
                userId,
                email.toLowerCase(),
                name.trim(),
                hashedPassword,
                role
            ]);
            
            const user = result.rows[0];
            
            // Generate JWT token
            const token = AuthMiddleware.generateToken(user.id, user.email, user.role);
            
            console.log(`✅ New user registered: ${user.email} (${user.role})`);
            
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                token,
                expiresIn: '24h'
            };
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            return {
                success: false,
                error: 'Registration failed due to server error',
                code: 'SERVER_ERROR'
            };
        }
    }
    
    /**
     * Login user
     */
    public static async login(data: LoginRequest): Promise<AuthResponse | AuthError> {
        try {
            const { email, password } = data;
            
            // Validate input
            if (!email || !password) {
                return {
                    success: false,
                    error: 'Email and password are required',
                    code: 'MISSING_CREDENTIALS'
                };
            }
            
            // Get user from database
            const userQuery = `
                SELECT id, email, name, password_hash, role, is_active
                FROM users 
                WHERE email = $1
            `;
            
            const result = await db.query(userQuery, [email.toLowerCase()]);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                };
            }
            
            const user = result.rows[0];
            
            // Check if user is active
            if (!user.is_active) {
                return {
                    success: false,
                    error: 'Account has been deactivated. Contact support.',
                    code: 'ACCOUNT_DEACTIVATED'
                };
            }
            
            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            
            if (!isPasswordValid) {
                return {
                    success: false,
                    error: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                };
            }
            
            // Generate JWT token
            const token = AuthMiddleware.generateToken(user.id, user.email, user.role);
            
            console.log(`✅ User logged in: ${user.email} (${user.role})`);
            
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                token,
                expiresIn: '24h'
            };
            
        } catch (error) {
            console.error('❌ Login error:', error);
            return {
                success: false,
                error: 'Login failed due to server error',
                code: 'SERVER_ERROR'
            };
        }
    }
    
    /**
     * Get user profile
     */
    public static async getProfile(userId: string): Promise<any> {
        try {
            const userQuery = `
                SELECT 
                    u.id, u.email, u.name, u.role, u.is_active, u.created_at,
                    COUNT(DISTINCT b.id) as total_bookings,
                    COALESCE(SUM(b.total_amount), 0) as total_spent,
                    COUNT(DISTINCT w.id) as waitlist_entries
                FROM users u
                LEFT JOIN bookings b ON u.id = b.user_id AND b.status = 'confirmed'
                LEFT JOIN waitlist w ON u.id = w.user_id AND w.status = 'waiting'
                WHERE u.id = $1
                GROUP BY u.id, u.email, u.name, u.role, u.is_active, u.created_at
            `;
            
            const result = await db.query(userQuery, [userId]);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                };
            }
            
            const user = result.rows[0];
            
            return {
                success: true,
                data: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isActive: user.is_active,
                    memberSince: user.created_at,
                    stats: {
                        totalBookings: parseInt(user.total_bookings),
                        totalSpent: parseFloat(user.total_spent),
                        waitlistEntries: parseInt(user.waitlist_entries)
                    }
                }
            };
            
        } catch (error) {
            console.error('❌ Get profile error:', error);
            return {
                success: false,
                error: 'Failed to retrieve user profile',
                code: 'SERVER_ERROR'
            };
        }
    }
    
    /**
     * Change user password
     */
    public static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<any> {
        try {
            // Validate new password
            if (newPassword.length < 8) {
                return {
                    success: false,
                    error: 'New password must be at least 8 characters long',
                    code: 'WEAK_PASSWORD'
                };
            }
            
            // Get current password hash
            const userQuery = 'SELECT password_hash FROM users WHERE id = $1';
            const result = await db.query(userQuery, [userId]);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                };
            }
            
            // Verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
            
            if (!isCurrentPasswordValid) {
                return {
                    success: false,
                    error: 'Current password is incorrect',
                    code: 'INVALID_CURRENT_PASSWORD'
                };
            }
            
            // Hash new password
            const hashedNewPassword = await bcrypt.hash(newPassword, AuthService.SALT_ROUNDS);
            
            // Update password
            await db.query(
                'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
                [hashedNewPassword, userId]
            );
            
            console.log(`✅ Password changed for user: ${userId}`);
            
            return {
                success: true,
                message: 'Password changed successfully'
            };
            
        } catch (error) {
            console.error('❌ Change password error:', error);
            return {
                success: false,
                error: 'Failed to change password',
                code: 'SERVER_ERROR'
            };
        }
    }
}