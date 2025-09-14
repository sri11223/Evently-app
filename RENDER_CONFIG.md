# Render Environment Variables - Copy & Paste Ready

## Render Web Service Configuration:
```
Name: evently-booking-system
Environment: Node
Region: Oregon (US West) 
Branch: main
Root Directory: evently-booking-system
Build Command: npm install && npm run build
Start Command: npm start
Instance Type: Free
```

## Environment Variables - Copy These Exact Values:

### Required Variables (Copy & Paste):
```
NODE_ENV = production
PORT = 10000
JWT_SECRET = evently-super-secret-jwt-key-2025-booking-system-secure-token-authentication-random-string-12345
```

### Database Connection (Get from Render PostgreSQL):
```
DATABASE_URL = [Copy "External Database URL" from your PostgreSQL service]
```

### Optional Redis (Get from Render Redis):  
```
REDIS_URL = [Copy "Internal Redis URL" from your Redis service]
```

## Database Setup Commands (Run after deployment):
1. Go to your PostgreSQL service in Render
2. Open "Shell" tab
3. Run this command to create tables:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    total_capacity INTEGER NOT NULL,
    available_seats INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    event_id UUID REFERENCES events(id) NOT NULL,
    quantity INTEGER NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Test URLs (After Deployment):
- Health Check: `https://your-app.onrender.com/health`
- Events API: `https://your-app.onrender.com/api/v1/events`
- Admin Login: POST to `https://your-app.onrender.com/api/v1/auth/login`

Ready to deploy! 🚀