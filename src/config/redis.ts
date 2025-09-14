// src/config/redis.ts
import Redis from 'ioredis';

interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db: number;
    retryDelayOnFailover: number;
    enableReadyCheck: boolean;
    maxRetriesPerRequest: number;
    lazyConnect: boolean;
}

class RedisManager {
    private client: Redis;
    private static instance: RedisManager;

    constructor() {
        // Use Railway REDIS_URL if available, otherwise fallback to individual config
        const redisUrl = process.env.REDIS_URL;
        
        if (redisUrl) {
            this.client = new Redis(redisUrl, {
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
            });
        } else {
            // Fallback to individual config for local development
            const config: RedisConfig = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0'),
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
            };
            this.client = new Redis(config);
        }

        this.client.on('connect', () => {
            console.log('✅ Redis connection established');
        });

        this.client.on('ready', () => {
            console.log('🚀 Redis ready for operations');
        });

        this.client.on('error', (err) => {
            console.error('❌ Redis connection error:', err.message);
        });

        this.client.on('close', () => {
            console.log('🔐 Redis connection closed');
        });
    }

    public static getInstance(): RedisManager {
        if (!RedisManager.instance) {
            RedisManager.instance = new RedisManager();
        }
        return RedisManager.instance;
    }

    public getClient(): Redis {
        return this.client;
    }

    public async testConnection(): Promise<boolean> {
        try {
            const pong = await this.client.ping();
            const info = await this.client.info('server');
            const redisVersion = info.match(/redis_version:([\d.]+)/)?.[3];
            
            console.log('✅ Redis connection successful');
            console.log('🏃 Redis response:', pong);
            console.log('📡 Redis version:', redisVersion);
            return true;
        } catch (error) {
            console.error('❌ Redis connection failed:', error);
            return false;
        }
    }

    public async close(): Promise<void> {
        await this.client.quit();
    }
}

export const redisManager = RedisManager.getInstance();
export const redis = redisManager.getClient();
