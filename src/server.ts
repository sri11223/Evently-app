// src/server.ts
import 'dotenv/config';
import app from './app';
import { db } from './config/database';
import { redis } from './config/redis';

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        console.log('🚀 Starting Evently Booking System...');
        
        // Test database connection
        console.log('📊 Testing database connection...');
        await db.testConnection();
        
        // Test Redis connection
        console.log('📡 Testing Redis connection...');
        await redis.ping();
        console.log('✅ Redis connection successful');
        
        // Start server
        app.listen(PORT, () => {
            console.log('🎉 Evently Booking System Started Successfully!');
            console.log(`📊 Server running on port ${PORT}`);
            console.log(`🌐 Health check: http://localhost:${PORT}/health`);
            console.log(`🔗 API endpoint: http://localhost:${PORT}/api/v1`);
            console.log('📝 Environment:', process.env.NODE_ENV || 'development');
            console.log('🐳 Database: PostgreSQL + Redis (Docker)');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('📤 SIGTERM received. Shutting down gracefully...');
    await db.close();
    await redis.quit();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('📤 SIGINT received. Shutting down gracefully...');
    await db.close();
    await redis.quit();
    process.exit(0);
});

startServer();
