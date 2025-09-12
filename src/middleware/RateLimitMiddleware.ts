// src/middleware/RateLimitMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    message?: string;
}

interface RateLimitTier {
    name: string;
    config: RateLimitConfig;
    priority: number;
}

export class AdvancedRateLimiter {
    private tiers: RateLimitTier[] = [];
    private systemLoadFactor: number = 1.0;

    constructor() {
        this.setupDefaultTiers();
        this.startSystemMonitoring();
    }

    /**
     * Setup default rate limiting tiers
     */
    private setupDefaultTiers(): void {
        // Tier 1: Global rate limit (highest priority)
        this.tiers.push({
            name: 'global',
            priority: 1,
            config: {
                windowMs: 60000, // 1 minute
                maxRequests: 10000, // 10k requests per minute globally
                keyGenerator: () => 'global',
                message: 'Global rate limit exceeded. System is under heavy load.'
            }
        });

        // Tier 2: Per-IP rate limit
        this.tiers.push({
            name: 'per-ip',
            priority: 2,
            config: {
                windowMs: 60000, // 1 minute
                maxRequests: 100, // 100 requests per minute per IP
                keyGenerator: (req) => `ip:${this.getClientIP(req)}`,
                message: 'Too many requests from your IP. Please try again later.'
            }
        });

        // Tier 3: Per-endpoint rate limit
        this.tiers.push({
            name: 'per-endpoint',
            priority: 3,
            config: {
                windowMs: 60000, // 1 minute
                maxRequests: 200, // 200 requests per minute per endpoint per IP
                keyGenerator: (req) => `endpoint:${req.route?.path || req.path}:${this.getClientIP(req)}`,
                message: 'Too many requests to this endpoint. Please slow down.'
            }
        });

        // Tier 4: Booking-specific rate limit (strictest)
        this.tiers.push({
            name: 'booking',
            priority: 4,
            config: {
                windowMs: 300000, // 5 minutes
                maxRequests: 10, // 10 booking attempts per 5 minutes per IP
                keyGenerator: (req) => `booking:${this.getClientIP(req)}`,
                message: 'Too many booking attempts. Please wait before trying again.'
            }
        });
    }

    /**
     * Create rate limiting middleware
     */
    createMiddleware(tierNames: string[] = ['global', 'per-ip', 'per-endpoint']): (req: Request, res: Response, next: NextFunction) => Promise<void> {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const applicableTiers = this.tiers
                    .filter(tier => tierNames.includes(tier.name))
                    .sort((a, b) => a.priority - b.priority);

                for (const tier of applicableTiers) {
                    const isAllowed = await this.checkRateLimit(req, tier);
                    if (!isAllowed) {
                        const remaining = await this.getRemainingRequests(req, tier);
                        const resetTime = await this.getResetTime(req, tier);
                        
                        console.warn(`🚨 Rate limit exceeded - ${tier.name}: ${req.method} ${req.path} from ${this.getClientIP(req)}`);
                        
                        res.status(429).json({
                            success: false,
                            error: tier.config.message,
                            rate_limit: {
                                tier: tier.name,
                                limit: Math.floor(tier.config.maxRequests * this.systemLoadFactor),
                                remaining: 0,
                                reset_time: resetTime,
                                retry_after: Math.ceil(tier.config.windowMs / 1000)
                            }
                        });
                        return;
                    }
                }

                // Add rate limit headers for successful requests
                const primaryTier = applicableTiers[0];
                if (primaryTier) {
                    const remaining = await this.getRemainingRequests(req, primaryTier);
                    const resetTime = await this.getResetTime(req, primaryTier);
                    
                    res.setHeader('X-RateLimit-Limit', Math.floor(primaryTier.config.maxRequests * this.systemLoadFactor));
                    res.setHeader('X-RateLimit-Remaining', remaining);
                    res.setHeader('X-RateLimit-Reset', resetTime);
                }

                next();

            } catch (error) {
                console.error('Rate limiting error:', error);
                // Fail open - allow request if rate limiter fails
                next();
            }
        };
    }

    /**
     * Check if request is within rate limit
     */
    private async checkRateLimit(req: Request, tier: RateLimitTier): Promise<boolean> {
        const key = tier.config.keyGenerator(req);
        const fullKey = `ratelimit:${tier.name}:${key}`;
        const now = Date.now();
        const window = tier.config.windowMs;
        const maxRequests = Math.floor(tier.config.maxRequests * this.systemLoadFactor);

        // Use sliding window with Redis sorted sets
        const pipeline = redis.multi();
        
        // Remove expired entries
        pipeline.zremrangebyscore(fullKey, 0, now - window);
        
        // Count current requests in window
        pipeline.zcard(fullKey);
        
        // Add current request
        pipeline.zadd(fullKey, now, `${now}-${Math.random()}`);
        
        // Set expiry
        pipeline.expire(fullKey, Math.ceil(window / 1000));
        
        const results = await pipeline.exec();
        
        if (!results) {
            throw new Error('Redis pipeline failed');
        }
        
        const currentCount = (results[1][1] as number) || 0;
        
        return currentCount < maxRequests;
    }

    /**
     * Get remaining requests for a tier
     */
    private async getRemainingRequests(req: Request, tier: RateLimitTier): Promise<number> {
        const key = tier.config.keyGenerator(req);
        const fullKey = `ratelimit:${tier.name}:${key}`;
        const maxRequests = Math.floor(tier.config.maxRequests * this.systemLoadFactor);
        
        const currentCount = await redis.zcard(fullKey);
        return Math.max(0, maxRequests - currentCount);
    }

    /**
     * Get reset time for rate limit window
     */
    private async getResetTime(req: Request, tier: RateLimitTier): Promise<number> {
        return Math.floor((Date.now() + tier.config.windowMs) / 1000);
    }

    /**
     * Monitor system load and adjust rate limits
     */
    private startSystemMonitoring(): void {
        setInterval(async () => {
            try {
                // Simple system load monitoring
                const memInfo = await redis.info('memory');
                const keyspaceInfo = await redis.info('keyspace');
                
                // Parse memory usage
                const memoryUsed = this.parseMemoryUsage(memInfo);
                
                // Adjust system load factor based on memory usage
                if (memoryUsed > 80) {
                    this.systemLoadFactor = 0.5; // Reduce limits by 50%
                    console.warn('🚨 High memory usage detected - reducing rate limits');
                } else if (memoryUsed > 60) {
                    this.systemLoadFactor = 0.75; // Reduce limits by 25%
                } else {
                    this.systemLoadFactor = 1.0; // Normal limits
                }
                
            } catch (error) {
                console.error('System monitoring error:', error);
                // Reset to conservative limits on error
                this.systemLoadFactor = 0.8;
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Get client IP address
     */
    private getClientIP(req: Request): string {
        return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               (req.connection as any)?.socket?.remoteAddress ||
               '127.0.0.1';
    }

    /**
     * Parse memory usage from Redis info
     */
    private parseMemoryUsage(memInfo: string): number {
        const usedMemoryMatch = memInfo.match(/used_memory:(\d+)/);
        const maxMemoryMatch = memInfo.match(/maxmemory:(\d+)/);
        
        if (usedMemoryMatch && maxMemoryMatch) {
            const used = parseInt(usedMemoryMatch[1]);
            const max = parseInt(maxMemoryMatch[1]);
            return (used / max) * 100;
        }
        
        return 0; // Default if can't parse
    }

    /**
     * Get rate limiting statistics
     */
    async getStats(): Promise<any> {
        const stats = {
            system_load_factor: this.systemLoadFactor,
            tiers: [] as any[]
        };

        for (const tier of this.tiers) {
            const tierStats = {
                name: tier.name,
                max_requests: Math.floor(tier.config.maxRequests * this.systemLoadFactor),
                window_ms: tier.config.windowMs,
                priority: tier.priority
            };
            
            stats.tiers.push(tierStats);
        }

        return stats;
    }

    /**
     * Reset rate limits for specific key (admin function)
     */
    async resetLimits(key: string): Promise<number> {
        const pattern = `ratelimit:*:${key}`;
        const keys = await redis.keys(pattern);
        
        if (keys.length > 0) {
            return await redis.del(...keys);
        }
        
        return 0;
    }
}

// Singleton instance
export const rateLimiter = new AdvancedRateLimiter();

// Predefined middleware exports
export const globalRateLimit = rateLimiter.createMiddleware(['global', 'per-ip']);
export const apiRateLimit = rateLimiter.createMiddleware(['global', 'per-ip', 'per-endpoint']);
export const bookingRateLimit = rateLimiter.createMiddleware(['global', 'per-ip', 'per-endpoint', 'booking']);
