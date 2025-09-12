// src/config/database.ts
import { Pool } from 'pg';

interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
}

class DatabaseManager {
    private pool: Pool;
    private static instance: DatabaseManager;

    constructor() {
        const config: DatabaseConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'evently_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        this.pool = new Pool(config);
        
        // Handle pool errors
        this.pool.on('error', (err) => {
            console.error('🚨 Database pool error:', err);
        });

        // Handle pool connection
        this.pool.on('connect', () => {
            console.log('🔗 New database connection established');
        });
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    public getPool(): Pool {
        return this.pool;
    }

    public async testConnection(): Promise<boolean> {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW() as current_time, version() as db_version');
            client.release();
            
            console.log('✅ Database connection successful');
            console.log('📊 Database time:', result.rows[0].current_time);
            console.log('🗄️ PostgreSQL version:', result.rows[0].db_version.split(' ')[0]);
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            return false;
        }
    }

    public async query(text: string, params?: any[]): Promise<any> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } finally {
            client.release();
        }
    }

    public async close(): Promise<void> {
        await this.pool.end();
        console.log('🔐 Database connections closed');
    }
}

export const db = DatabaseManager.getInstance();
export const pool = db.getPool();
