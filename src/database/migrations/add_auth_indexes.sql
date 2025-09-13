-- src/database/migrations/add_auth_indexes.sql
-- Additional indexes for authentication performance

-- Index for email lookup (login)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Index for active users
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Composite index for active users by role
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);

-- Index for user creation date (for admin analytics)
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Update sample users with proper bcrypt hashes
-- Note: These are hashed versions of 'password123' for testing
UPDATE users SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiGtCNl5B4V.' 
WHERE email = 'admin@evently.com';

UPDATE users SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiGtCNl5B4V.' 
WHERE email = 'user@evently.com';