// src/config/database.ts - ENHANCED WITH READ-WRITE SEPARATION
import { Pool } from 'pg';
import { shardManager } from '../database/ShardManager';
import { replicationManager, OperationType } from '../database/ReplicationManager';

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
            port: parseInt(process.env.DB_PORT || '5433'),
            database: process.env.DB_NAME || 'evently_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        this.pool = new Pool(config);
        
        this.pool.on('error', (err) => {
            console.error('🚨 Database pool error:', err);
        });

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

    // Legacy method - now uses replication manager
    public async query(text: string, params?: any[]): Promise<any> {
        // Determine operation type
        const operationType = this.determineOperationType(text);
        return replicationManager.query(text, params, operationType);
    }

    // READ operations - routed to replicas
    public async queryRead(text: string, params?: any[], requiresConsistency: boolean = false): Promise<any> {
        return replicationManager.query(text, params, OperationType.READ, requiresConsistency);
    }

    // WRITE operations - always routed to master
    public async queryWrite(text: string, params?: any[]): Promise<any> {
        return replicationManager.query(text, params, OperationType.WRITE);
    }

    // Transaction support - always on master
    public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
        return replicationManager.transaction(callback);
    }

    // Sharded methods with read-write separation
    public async queryByOrganizer(organizerId: string, text: string, params?: any[], isWrite: boolean = false): Promise<any> {
        if (isWrite) {
            return shardManager.queryByOrganizer(organizerId, text, params);
        }
        
        // For reads, we can still use sharding but with replica routing
        const shardId = shardManager.getShardForOrganizer(organizerId);
        return replicationManager.query(text, params, OperationType.READ);
    }

    public async queryByEvent(eventId: string, text: string, params?: any[], isWrite: boolean = false): Promise<any> {
        if (isWrite) {
            return shardManager.queryByEvent(eventId, text, params);
        }
        
        return replicationManager.query(text, params, OperationType.READ);
    }

    public async fanOutQuery(text: string, params?: any[]): Promise<any[]> {
        // Fan-out queries are always reads
        return shardManager.fanOutQuery(text, params);
    }

    private determineOperationType(sql: string): OperationType {
        const normalizedSql = sql.trim().toLowerCase();
        
        if (normalizedSql.startsWith('select') || 
            normalizedSql.startsWith('show') || 
            normalizedSql.startsWith('explain')) {
            return OperationType.READ;
        }
        
        return OperationType.WRITE;
    }

    public async testConnection(): Promise<boolean> {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW() as current_time, version() as db_version');
            client.release();
            
            console.log('✅ Database connection successful');
            console.log('📊 Database time:', result.rows[0].current_time);
            console.log('🗄️ PostgreSQL version:', result.rows[0].db_version.split(' ')[0]);

            // Test shard manager
            const shardStats = await shardManager.getShardStats();
            console.log('🔀 Shard Statistics:', shardStats);

            // Test replication manager
            const replicationStatus = replicationManager.getReplicationStatus();
            console.log('🔄 Replication Status:', {
                master: replicationStatus.master.status,
                healthy_replicas: replicationStatus.replicas.filter((r: { status: string; }) => r.status === 'healthy').length,
                total_replicas: replicationStatus.replicas.length
            });
            
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            return false;
        }
    }

    public async close(): Promise<void> {
        await this.pool.end();
        await shardManager.close();
        await replicationManager.close();
        console.log('🔐 Database connections closed');
    }
}

export const db = DatabaseManager.getInstance();
export const pool = db.getPool();
export { shardManager, replicationManager };
