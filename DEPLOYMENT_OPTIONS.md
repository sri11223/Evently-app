# Evently Booking System

## Quick Deploy Options

### 1. Render (Fastest - 5 minutes)
1. Go to https://render.com
2. Connect your GitHub repo: https://github.com/sri11223/Evently-app
3. Create Web Service:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Add PostgreSQL database
   - Add Redis addon

### 2. Railway (Current - Issues)
- Database connection timeouts
- Intermittent connectivity

### 3. Heroku (15 minutes)
1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli#download-and-install
2. Commands:
```bash
heroku create evently-booking-app
heroku addons:create heroku-postgresql:essential-0
heroku addons:create heroku-redis:mini
git push heroku main
```

### 4. Vercel + PlanetScale (10 minutes)
- Frontend: Vercel
- Database: PlanetScale MySQL
- No server needed - serverless functions

## Fastest Solution: Render
- No CLI installation required
- Built-in PostgreSQL + Redis
- Auto-deploy from GitHub
- 5 minutes to live

## Database Schema
All required files are ready:
- `schema.sql` - Main database structure
- `waitlist_schema.sql` - Waitlist functionality
- `reset-database.sql` - Complete setup