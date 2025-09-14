# Deploy to Render - Step by Step Guide

## Step 1: Prepare the Code (1 minute)
✅ Already done! Your code is ready in GitHub repo: https://github.com/sri11223/Evently-app

## Step 2: Go to Render (30 seconds)
1. Open browser and go to: https://render.com
2. Click "Get Started for Free" 
3. Sign up/Login with GitHub account

## Step 3: Create Web Service (2 minutes)
1. Click "New +" button
2. Select "Web Service"
3. Connect GitHub repository: `Evently-app`
4. Select the repository from the list

## Step 4: Configure Web Service (2 minutes)
```
Name: evently-booking-system
Environment: Node
Region: Oregon (US West) or closest to you
Branch: main
Root Directory: evently-booking-system

Build Command: npm install && npm run build
Start Command: npm start

Instance Type: Free ($0/month)
```

## Step 5: Add Environment Variables (1 minute)
Click "Advanced" and add these environment variables:
```
NODE_ENV = production
PORT = 10000
JWT_SECRET = evently-super-secret-jwt-key-2025-booking-system-secure-token-authentication-random-string-12345
```

## Step 6: Create PostgreSQL Database (1 minute)
1. After creating web service, go to Dashboard
2. Click "New +" → "PostgreSQL" 
3. Name: `evently-database`
4. Region: Same as web service
5. PostgreSQL Version: 15
6. Instance Type: Free ($0/month)

## Step 7: Connect Database to App (1 minute)
1. Go to your web service settings
2. Add environment variable:
```
DATABASE_URL = [Copy from PostgreSQL database "External Database URL"]
```

## Additional Environment Variables (Optional Redis):
If you want to add Redis caching (recommended):
1. Create Redis service: Click "New +" → "Redis"
2. Add environment variable:
```
REDIS_URL = [Copy from Redis "Internal Redis URL"]
```

## Complete Environment Variables List:
Copy and paste these exact values:

**Required:**
```
NODE_ENV = production
PORT = 10000  
JWT_SECRET = evently-super-secret-jwt-key-2025-booking-system-secure-token-authentication-random-string-12345
DATABASE_URL = [Copy from your PostgreSQL database]
```

**Optional (for better performance):**
```
REDIS_URL = [Copy from your Redis service]
```

## Step 8: Deploy! (2-3 minutes)
1. Click "Create Web Service"
2. Render will automatically:
   - Clone your repo
   - Install dependencies
   - Build the app
   - Start the server
   - Give you a live URL

## Your app will be live at:
`https://evently-booking-system-xxxx.onrender.com`

## Total time: ~5-7 minutes!

## After Deployment:
1. Test health endpoint: `https://your-app.onrender.com/health`
2. Test admin login
3. Test event creation
4. Test booking system

Need help with any step? Let me know!