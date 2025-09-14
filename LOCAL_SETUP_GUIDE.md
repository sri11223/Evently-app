# Local Development Setup Guide

## Option 1: Docker Setup (Recommended)

### Prerequisites
- Docker Desktop installed and running

### Steps
```bash
# 1. Clone repository
git clone https://github.com/sri11223/Evently-app.git
cd Evently-app/evently-booking-system

# 2. Install dependencies
npm install

# 3. Copy environment file (already configured for Docker)
cp .env.example .env

# 4. Start Docker containers
docker-compose up -d

# 5. Verify containers are running
docker-compose ps

# 6. Start application
npm run dev
```

## Option 2: Local PostgreSQL & Redis Setup

### Prerequisites
- PostgreSQL 15+ installed locally
- Redis 7+ installed locally
- Node.js 18+ installed

### Steps
```bash
# 1. Clone and install
git clone https://github.com/sri11223/Evently-app.git
cd Evently-app/evently-booking-system
npm install

# 2. Setup local database
createdb evently_db
psql evently_db < src/database/schema.sql

# 3. Configure environment for local services
cp .env.example .env.local
```

### .env.local configuration:
```bash
NODE_ENV=development
PORT=3000

# Local PostgreSQL (default port)
DATABASE_URL=postgresql://postgres:password@localhost:5432/evently_db

# Local Redis (default port) 
REDIS_URL=redis://localhost:6379

JWT_SECRET=your-development-secret-key
```

```bash
# 4. Use local environment
cp .env.local .env

# 5. Start local services
# PostgreSQL: brew services start postgresql (Mac) or service postgresql start (Linux)
# Redis: brew services start redis (Mac) or service redis start (Linux)

# 6. Start application
npm run dev
```

## Option 3: Cloud Development (No local setup)

Use the live system for testing:
- **API Base URL**: https://evently-app-7hx2.onrender.com
- **Test with**: ./system-demo.ps1 script
- **Documentation**: API_TESTING_GUIDE.md

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running on correct port
- Check DATABASE_URL in .env matches your setup
- Verify database exists and schema is loaded

### Redis Connection Issues  
- Ensure Redis is running on correct port
- Check REDIS_URL in .env matches your setup
- For local Redis, remove password from URL

### Port Issues
- Docker: Uses ports 5433 (PostgreSQL) and 6380 (Redis)  
- Local: Uses default ports 5432 (PostgreSQL) and 6379 (Redis)

### Quick Health Check
```bash
# Test API endpoint
curl http://localhost:3000/health

# Should return: {"status":"OK","database":"connected","cache":"active"}
```