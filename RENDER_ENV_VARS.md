# RENDER DEPLOYMENT - ALL ENVIRONMENT VARIABLES

## Copy & Paste These Exact Values in Render:

### Environment Variables (Add in Web Service Settings):

**Key:** NODE_ENV  
**Value:** production

**Key:** PORT  
**Value:** 10000

**Key:** JWT_SECRET  
**Value:** evently-super-secret-jwt-key-2025-booking-system-secure-token-authentication-random-string-12345

**Key:** DATABASE_URL  
**Value:** [Copy from your PostgreSQL database "External Database URL"]

**Key:** REDIS_URL (Optional)  
**Value:** [Copy from your Redis service "Internal Redis URL"]

---

## Web Service Configuration:

**Name:** evently-booking-system  
**Environment:** Node  
**Branch:** main  
**Root Directory:** evently-booking-system  
**Build Command:** npm install && npm run build  
**Start Command:** npm start  
**Instance Type:** Free  

---

## Quick Steps:
1. Go to render.com → Sign up with GitHub
2. New + → Web Service → Connect "Evently-app" repo
3. Add the 4 environment variables above
4. Create PostgreSQL database → Copy DATABASE_URL
5. Deploy!

**Your app URL:** https://evently-booking-system-xxxx.onrender.com

**Test:** https://your-app.onrender.com/health