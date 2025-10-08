# 🛡️ Security & Reliability Analysis - Production-Ready Backend

## 🔐 **SECURITY ARCHITECTURE**

### 🚨 **Threat Model & Attack Vectors**

| Attack Vector | Risk Level | Mitigation Strategy | Implementation Status |
|---------------|------------|-------------------|----------------------|
| **SQL Injection** | Critical | Parameterized queries | ✅ Implemented |
| **XSS Attacks** | High | Input sanitization | ✅ Implemented |
| **CSRF Attacks** | High | CSRF tokens + SameSite | ✅ Implemented |
| **DDoS/Rate Limiting** | High | Multi-tier rate limiting | ✅ Implemented |
| **Data Breaches** | Critical | Encryption + Access control | ✅ Implemented |
| **JWT Token Theft** | Medium | Secure cookies + expiration | ✅ Implemented |
| **API Abuse** | Medium | API keys + monitoring | 🟡 Partial |
| **Insider Threats** | Medium | Audit logging + RBAC | ✅ Implemented |

---

## 🔒 **AUTHENTICATION & AUTHORIZATION**

### 🎯 **JWT Security Implementation**

```typescript
// Secure JWT configuration
const jwtConfig = {
    secret: process.env.JWT_SECRET,  // 256-bit random key
    algorithm: 'HS256',              // HMAC SHA-256
    expiresIn: '24h',               // Token expiration
    issuer: 'evently-api',          // Token issuer
    audience: 'evently-clients'      // Intended audience
};

// Token payload structure (minimal PII)
interface JWTPayload {
    user_id: string;        // UUID only
    role: 'user' | 'admin'; // Role-based access
    iat: number;            // Issued at
    exp: number;            // Expires at
    jti: string;            // JWT ID for revocation
}

// Secure token generation
const generateToken = (user: User): string => {
    const payload: JWTPayload = {
        user_id: user.id,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        jti: randomUUID() // Unique token ID
    };
    
    return jwt.sign(payload, jwtConfig.secret, {
        algorithm: jwtConfig.algorithm,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience
    });
};
```

### 🔐 **Role-Based Access Control (RBAC)**

```typescript
// Permission matrix
const permissions = {
    user: [
        'booking:create',
        'booking:read:own',
        'booking:cancel:own',
        'event:read',
        'waitlist:join',
        'notification:read:own'
    ],
    
    admin: [
        'event:create',
        'event:update',
        'event:delete',
        'booking:read:all',
        'booking:cancel:any',
        'analytics:read',
        'user:manage',
        'notification:send:all'
    ]
};

// Authorization middleware
const requirePermission = (permission: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const userRole = req.user?.role;
        const userPermissions = permissions[userRole] || [];
        
        if (!userPermissions.includes(permission)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: permission,
                user_role: userRole
            });
        }
        
        next();
    };
};

// Usage in routes
app.delete('/api/v1/events/:id', 
    authMiddleware,
    requirePermission('event:delete'),
    eventController.deleteEvent
);
```

---

## 🛡️ **INPUT VALIDATION & SANITIZATION**

### ✅ **Comprehensive Input Validation**

```typescript
import Joi from 'joi';
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

// Booking request validation schema
const bookingSchema = Joi.object({
    event_id: Joi.string().uuid().required(),
    quantity: Joi.number().integer().min(1).max(10).required(),
    user_id: Joi.string().uuid().required()
});

// SQL injection prevention
const safeQuery = async (query: string, params: any[]) => {
    // Always use parameterized queries
    return await pool.query(query, params);
};

// XSS prevention
const sanitizeInput = (input: string): string => {
    // Remove HTML tags and encode special characters
    return DOMPurify.sanitize(validator.escape(input));
};

// Validation middleware
const validateRequest = (schema: Joi.Schema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error, value } = schema.validate(req.body);
        
        if (error) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message
                }))
            });
        }
        
        req.body = value; // Use validated/sanitized data
        next();
    };
};
```

### 🚫 **Rate Limiting Implementation**

```typescript
// Multi-tier rate limiting strategy
const rateLimiters = {
    // Global rate limit
    global: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10000,               // 10K requests per window
        message: 'Too many requests from this IP',
        standardHeaders: true,
        legacyHeaders: false
    }),
    
    // API endpoint specific
    booking: rateLimit({
        windowMs: 60 * 1000,      // 1 minute
        max: 5,                   // 5 booking attempts per minute
        message: 'Too many booking attempts',
        keyGenerator: (req) => req.user?.id || req.ip
    }),
    
    // Authentication attempts
    auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5,                   // 5 failed attempts
        skipSuccessfulRequests: true,
        message: 'Too many login attempts'
    })
};

// Redis-based distributed rate limiting
class DistributedRateLimit {
    private redis: Redis;
    
    async checkLimit(key: string, limit: number, window: number): Promise<boolean> {
        const current = await this.redis.incr(key);
        
        if (current === 1) {
            await this.redis.expire(key, window);
        }
        
        return current <= limit;
    }
}
```

---

## 🔍 **DATA PROTECTION & PRIVACY**

### 🗄️ **Database Security**

```sql
-- Row Level Security (RLS)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own bookings
CREATE POLICY user_bookings_policy ON bookings
    FOR ALL TO application_user
    USING (user_id = current_setting('app.user_id')::uuid);

-- Admins can see all bookings
CREATE POLICY admin_bookings_policy ON bookings
    FOR ALL TO application_admin
    USING (true);

-- Encrypt sensitive data at rest
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Store encrypted email addresses
ALTER TABLE users ADD COLUMN email_encrypted BYTEA;

-- Encryption function
CREATE OR REPLACE FUNCTION encrypt_email(email TEXT) 
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(email, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql;

-- Audit trail table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    user_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit trigger
CREATE OR REPLACE FUNCTION audit_trigger() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        table_name, operation, user_id, 
        old_values, new_values, 
        ip_address, user_agent
    ) VALUES (
        TG_TABLE_NAME, TG_OP, 
        COALESCE(NEW.user_id, OLD.user_id),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) END,
        inet_client_addr(),
        current_setting('app.user_agent', true)
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

### 🔐 **GDPR Compliance**

```typescript
// Data subject rights implementation
class GDPRCompliance {
    // Right to access personal data
    async getPersonalData(userId: string): Promise<PersonalDataExport> {
        const userData = await pool.query(`
            SELECT u.id, u.email, u.name, u.created_at,
                   json_agg(DISTINCT b.*) as bookings,
                   json_agg(DISTINCT w.*) as waitlists,
                   json_agg(DISTINCT n.*) as notifications
            FROM users u
            LEFT JOIN bookings b ON u.id = b.user_id
            LEFT JOIN waitlists w ON u.id = w.user_id
            LEFT JOIN notifications n ON u.id = n.user_id
            WHERE u.id = $1
            GROUP BY u.id
        `, [userId]);
        
        return userData.rows[0];
    }
    
    // Right to rectification
    async updatePersonalData(userId: string, updates: UserUpdates): Promise<void> {
        const sanitizedUpdates = this.sanitizeUpdates(updates);
        
        await pool.query(`
            UPDATE users 
            SET ${Object.keys(sanitizedUpdates).map((key, i) => `${key} = $${i + 2}`).join(', ')},
                updated_at = NOW()
            WHERE id = $1
        `, [userId, ...Object.values(sanitizedUpdates)]);
        
        // Log the change
        await this.logDataChange(userId, 'RECTIFICATION', updates);
    }
    
    // Right to erasure (Right to be forgotten)
    async deletePersonalData(userId: string): Promise<void> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Soft delete to maintain referential integrity
            await client.query(`
                UPDATE users 
                SET email = 'deleted-user-' || id || '@deleted.local',
                    name = 'Deleted User',
                    password_hash = 'DELETED',
                    is_active = false,
                    deleted_at = NOW()
                WHERE id = $1
            `, [userId]);
            
            // Anonymize bookings (keep for business records)
            await client.query(`
                UPDATE bookings 
                SET user_id = '00000000-0000-0000-0000-000000000000'
                WHERE user_id = $1
            `, [userId]);
            
            await client.query('COMMIT');
            
            await this.logDataChange(userId, 'ERASURE', { reason: 'User request' });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}
```

---

## 🔧 **RELIABILITY & FAULT TOLERANCE**

### ⚡ **Circuit Breaker Pattern**

```typescript
// Circuit breaker for external services
class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    constructor(
        private threshold = 5,        // Failure threshold
        private timeout = 60000,      // Recovery timeout (1 min)
        private monitoringPeriod = 10000 // Monitoring period (10 sec)
    ) {}
    
    async call<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    private onSuccess(): void {
        this.failures = 0;
        this.state = 'CLOSED';
    }
    
    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();
        
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
        }
    }
}

// Usage with email service
const emailCircuitBreaker = new CircuitBreaker(3, 30000);

const sendEmailWithFallback = async (emailData: EmailData) => {
    try {
        return await emailCircuitBreaker.call(() => 
            emailService.send(emailData)
        );
    } catch (error) {
        // Fallback: Store in database for retry
        await storeFailedEmail(emailData);
        console.warn('Email service unavailable, stored for retry');
    }
};
```

### 🔄 **Graceful Degradation**

```typescript
// Service availability monitoring
class ServiceHealth {
    private services = new Map<string, boolean>();
    
    // Health check endpoints
    async checkDatabaseHealth(): Promise<boolean> {
        try {
            await pool.query('SELECT 1');
            this.services.set('database', true);
            return true;
        } catch (error) {
            this.services.set('database', false);
            return false;
        }
    }
    
    async checkRedisHealth(): Promise<boolean> {
        try {
            await redis.ping();
            this.services.set('redis', true);
            return true;
        } catch (error) {
            this.services.set('redis', false);
            return false;
        }
    }
    
    // Graceful degradation logic
    async getEventList(useCache = true): Promise<Event[]> {
        const redisAvailable = this.services.get('redis');
        
        if (useCache && redisAvailable) {
            try {
                const cached = await redis.get('events:active');
                if (cached) return JSON.parse(cached);
            } catch (error) {
                console.warn('Redis unavailable, falling back to database');
            }
        }
        
        // Fallback to database
        const events = await pool.query(`
            SELECT * FROM events 
            WHERE status = 'active' 
            ORDER BY event_date ASC
        `);
        
        // Try to cache if Redis is available
        if (redisAvailable) {
            try {
                await redis.setex('events:active', 300, JSON.stringify(events.rows));
            } catch (error) {
                // Ignore cache errors
            }
        }
        
        return events.rows;
    }
}
```

### 📊 **Error Handling & Monitoring**

```typescript
// Centralized error handling
class ErrorHandler {
    static handle(error: Error, req: Request, res: Response): void {
        const errorId = randomUUID();
        
        // Log error with context
        console.error({
            errorId,
            message: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method,
            userId: req.user?.id,
            correlationId: req.correlationId,
            timestamp: new Date().toISOString()
        });
        
        // Store error for analysis
        this.storeError(errorId, error, req);
        
        // Return appropriate response
        if (error instanceof ValidationError) {
            res.status(400).json({
                error: 'Validation failed',
                errorId,
                details: error.details
            });
        } else if (error instanceof AuthenticationError) {
            res.status(401).json({
                error: 'Authentication required',
                errorId
            });
        } else {
            // Generic server error
            res.status(500).json({
                error: 'Internal server error',
                errorId,
                message: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    
    private static async storeError(errorId: string, error: Error, req: Request): Promise<void> {
        try {
            await pool.query(`
                INSERT INTO error_log (
                    id, message, stack, url, method, 
                    user_id, correlation_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [
                errorId, error.message, error.stack,
                req.url, req.method, req.user?.id,
                req.correlationId
            ]);
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
    }
}
```

---

## 🚨 **SECURITY MONITORING & ALERTING**

### 📊 **Security Metrics Dashboard**

```typescript
// Security event tracking
const securityEvents = {
    // Authentication events
    login_attempts: {
        success: 0,
        failed: 0,
        blocked: 0
    },
    
    // Authorization events
    permission_denied: 0,
    admin_actions: 0,
    
    // API security
    rate_limit_exceeded: 0,
    suspicious_requests: 0,
    
    // Data access
    sensitive_data_access: 0,
    bulk_data_exports: 0
};

// Real-time security monitoring
class SecurityMonitor {
    private suspiciousIPs = new Set<string>();
    
    async trackSecurityEvent(event: SecurityEvent): Promise<void> {
        // Store event
        await pool.query(`
            INSERT INTO security_events (
                type, user_id, ip_address, user_agent,
                details, created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [event.type, event.userId, event.ip, event.userAgent, event.details]);
        
        // Check for suspicious patterns
        await this.analyzeThreatPatterns(event);
    }
    
    private async analyzeThreatPatterns(event: SecurityEvent): Promise<void> {
        // Multiple failed logins
        if (event.type === 'LOGIN_FAILED') {
            const recentFailures = await this.getRecentFailures(event.ip, 15); // 15 min window
            
            if (recentFailures >= 5) {
                await this.blockIP(event.ip, 3600); // Block for 1 hour
                await this.sendSecurityAlert('BRUTE_FORCE_DETECTED', event);
            }
        }
        
        // Rapid API requests
        if (event.type === 'API_REQUEST') {
            const requestCount = await this.getRequestCount(event.ip, 60); // 1 min window
            
            if (requestCount > 1000) {
                await this.sendSecurityAlert('POSSIBLE_DDoS', event);
            }
        }
    }
}
```

---

## 🎯 **INTERVIEW TALKING POINTS: Security**

### **"How do you prevent SQL injection?"**
*"I use parameterized queries exclusively, validate all inputs with Joi schemas, and implement database-level constraints. The application never constructs SQL strings with user input."*

### **"Explain your authentication strategy"**
*"JWT tokens with role-based access control, secure token storage, 24-hour expiration, and proper logout handling. I also implement rate limiting for authentication attempts and audit all access."*

### **"How do you handle sensitive data?"**
*"Encryption at rest using pgcrypto, minimal PII in tokens, secure transmission with HTTPS, audit logging for all data access, and GDPR compliance with data subject rights."*

### **"What's your approach to system reliability?"**
*"Circuit breakers for external services, graceful degradation when components fail, comprehensive error handling with correlation IDs, and monitoring for early problem detection."*

### **"How do you monitor security threats?"**
*"Real-time security event tracking, pattern analysis for suspicious behavior, automated IP blocking for brute force attempts, and alerting for security incidents with detailed logging."*

This demonstrates **enterprise-grade security practices**! 🛡️