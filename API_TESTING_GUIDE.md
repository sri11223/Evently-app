# 🚀 COMPLETE API DOCUMENTATION & TESTING GUIDE

## 🌍 **Live API Base URL:** `https://evently-app-7hx2.onrender.com/api/v1`

## 🎯 **COMPLETE SYSTEM COVERAGE - 60+ ENDPOINTS!**

---

## 🔐 **AUTHENTICATION FLOW (Start Here)**

### **Step 1: Get Admin Token**
```http
POST https://evently-app-7hx2.onrender.com/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin2@evently.com",
  "password": "admin123"
}
```
**Copy the token from response for admin endpoints!**

### **Step 2: Get User Token**
```http
POST https://evently-app-7hx2.onrender.com/api/v1/auth/register
Content-Type: application/json

{
  "name": "Demo User",
  "email": "demouser@test.com",
  "password": "demo123",
  "role": "user"
}
```
**Copy the token from response for user endpoints!**

---

## 📋 **ALL API CATEGORIES - COMPLETE COVERAGE**

### **🏥 1. SYSTEM HEALTH & STATUS**
```http
GET https://evently-app-7hx2.onrender.com/health
GET https://evently-app-7hx2.onrender.com/api/v1
GET https://evently-app-7hx2.onrender.com/api/v1/database/status
GET https://evently-app-7hx2.onrender.com/api/v1/database/init
```

### **🎫 2. EVENT MANAGEMENT (6 endpoints)**
```http
# LIST EVENTS (WITH CACHING!)
GET https://evently-app-7hx2.onrender.com/api/v1/events

# POPULAR EVENTS
GET https://evently-app-7hx2.onrender.com/api/v1/events/popular

# GET SPECIFIC EVENT
GET https://evently-app-7hx2.onrender.com/api/v1/events/:eventId

# CREATE EVENT (Admin)
POST https://evently-app-7hx2.onrender.com/api/v1/events
Authorization: Bearer ADMIN_TOKEN
{
  "name": "Demo Event",
  "venue": "Demo Venue", 
  "eventDate": "2025-12-25T18:00:00Z",
  "totalCapacity": 100,
  "price": 50.00
}

# UPDATE EVENT (Admin)
PUT https://evently-app-7hx2.onrender.com/api/v1/events/:eventId
Authorization: Bearer ADMIN_TOKEN

# DELETE EVENT (Admin)
DELETE https://evently-app-7hx2.onrender.com/api/v1/events/:eventId
Authorization: Bearer ADMIN_TOKEN
```

### **🎟️ 3. BOOKING SYSTEM (4 endpoints)**
```http
# CREATE BOOKING
POST https://evently-app-7hx2.onrender.com/api/v1/bookings
Authorization: Bearer USER_TOKEN
{
  "eventId": "EVENT_ID_HERE",
  "quantity": 2
}

# CANCEL BOOKING
PUT https://evently-app-7hx2.onrender.com/api/v1/bookings/:bookingId/cancel
Authorization: Bearer USER_TOKEN

# GET BOOKING BY REFERENCE
GET https://evently-app-7hx2.onrender.com/api/v1/bookings/reference/:reference

# GET USER BOOKINGS
GET https://evently-app-7hx2.onrender.com/api/v1/bookings/user/:userId
Authorization: Bearer USER_TOKEN
```

### **📊 4. ANALYTICS & REPORTING (8+ endpoints)**
```http
# OVERALL ANALYTICS
GET https://evently-app-7hx2.onrender.com/api/v1/analytics
Authorization: Bearer ADMIN_TOKEN

# EVENT-SPECIFIC ANALYTICS
GET https://evently-app-7hx2.onrender.com/api/v1/analytics/events/:eventId
Authorization: Bearer ADMIN_TOKEN

# REAL-TIME DASHBOARD
GET https://evently-app-7hx2.onrender.com/api/v1/analytics/dashboard
Authorization: Bearer ADMIN_TOKEN

# CONVERSION FUNNEL
GET https://evently-app-7hx2.onrender.com/api/v1/analytics/funnel
Authorization: Bearer ADMIN_TOKEN

# PREDICTIVE ANALYTICS
GET https://evently-app-7hx2.onrender.com/api/v1/analytics/predictive
Authorization: Bearer ADMIN_TOKEN
```

### **🎯 5. WAITLIST MANAGEMENT (5 endpoints)**
```http
# JOIN WAITLIST
POST https://evently-app-7hx2.onrender.com/api/v1/waitlist/:eventId/join
Authorization: Bearer USER_TOKEN
{
  "priority": "standard"
}

# CHECK WAITLIST POSITION
GET https://evently-app-7hx2.onrender.com/api/v1/waitlist/:eventId/user/:userId
Authorization: Bearer USER_TOKEN

# WAITLIST STATISTICS (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/waitlist/:eventId/stats
Authorization: Bearer ADMIN_TOKEN

# PROCESS WAITLIST (Admin)
POST https://evently-app-7hx2.onrender.com/api/v1/waitlist/:eventId/process
Authorization: Bearer ADMIN_TOKEN

# LEAVE WAITLIST
DELETE https://evently-app-7hx2.onrender.com/api/v1/waitlist/:eventId/user/:userId
Authorization: Bearer USER_TOKEN
```

### **📧 6. NOTIFICATION SYSTEM (4 endpoints)**
```http
# SEND TEST NOTIFICATION (Admin)
POST https://evently-app-7hx2.onrender.com/api/v1/notifications/send
Authorization: Bearer ADMIN_TOKEN
{
  "message": "Test notification",
  "type": "system"
}

# BROADCAST TO EVENT (Admin)
POST https://evently-app-7hx2.onrender.com/api/v1/notifications/broadcast/:eventId
Authorization: Bearer ADMIN_TOKEN

# GET USER NOTIFICATIONS
GET https://evently-app-7hx2.onrender.com/api/v1/notifications/user/:userId
Authorization: Bearer USER_TOKEN

# NOTIFICATION STATISTICS (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/notifications/stats
Authorization: Bearer ADMIN_TOKEN
```

### **� 7. DYNAMIC PRICING (6+ endpoints)**
```http
# GET DYNAMIC PRICING
GET https://evently-app-7hx2.onrender.com/api/v1/pricing/dynamic/:eventId
Authorization: Bearer USER_TOKEN

# BULK PRICING
GET https://evently-app-7hx2.onrender.com/api/v1/pricing/bulk?quantity=10
Authorization: Bearer USER_TOKEN

# DEMAND-BASED PRICING
GET https://evently-app-7hx2.onrender.com/api/v1/pricing/demand/:eventId
Authorization: Bearer ADMIN_TOKEN

# PRICING ANALYTICS (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/pricing/analytics
Authorization: Bearer ADMIN_TOKEN
```

### **⚡ 8. CACHING SYSTEM (5 endpoints)**
```http
# CACHE METRICS (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/cache/metrics
Authorization: Bearer ADMIN_TOKEN

# CLEAR EVENTS CACHE (Admin)
DELETE https://evently-app-7hx2.onrender.com/api/v1/cache/events
Authorization: Bearer ADMIN_TOKEN

# CLEAR ALL CACHE (Admin)
DELETE https://evently-app-7hx2.onrender.com/api/v1/cache/all
Authorization: Bearer ADMIN_TOKEN

# CACHE STATUS (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/cache/status
Authorization: Bearer ADMIN_TOKEN
```

### **🔥 9. LOAD TESTING & PERFORMANCE**
```http
# START LOAD TEST (Admin)
POST https://evently-app-7hx2.onrender.com/api/v1/load-test/start
Authorization: Bearer ADMIN_TOKEN
{
  "concurrentUsers": 100,
  "duration": 30,
  "scenario": "peak_browsing"
}

# GET LOAD TEST STATUS (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/load-test/status/:testId
Authorization: Bearer ADMIN_TOKEN

# GET LOAD TEST RESULTS (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/load-test/results/:testId
Authorization: Bearer ADMIN_TOKEN
```

### **📈 10. TRACING & MONITORING (5 endpoints)**
```http
# PERFORMANCE METRICS (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/tracing/metrics
Authorization: Bearer ADMIN_TOKEN

# REQUEST TRACING (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/tracing/requests
Authorization: Bearer ADMIN_TOKEN

# ERROR TRACKING (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/tracing/errors
Authorization: Bearer ADMIN_TOKEN
```

### **🏢 11. ENTERPRISE FEATURES (8+ endpoints)**
```http
# ENTERPRISE DASHBOARD (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/enterprise/dashboard
Authorization: Bearer ADMIN_TOKEN

# SCALING STATUS (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/enterprise/scaling
Authorization: Bearer ADMIN_TOKEN

# AUDIT LOGS (Admin)
GET https://evently-app-7hx2.onrender.com/api/v1/enterprise/audit
Authorization: Bearer ADMIN_TOKEN
```

---

## 📊 **VIDEO RECORDING SEQUENCE - COMPLETE SYSTEM**

### **Phase 1: System Status & Auth (2 min)**
1. Health check & database status
2. Admin login & user registration  
3. API overview endpoint

### **Phase 2: Core Features (3 min)**
4. Event management (list, create, update)
5. Booking system (book, cancel, check)
6. Show caching in action (cache miss/hit)

### **Phase 3: Advanced Features (3 min)**
7. Waitlist management flow
8. Dynamic pricing calculation
9. Real-time notifications
10. Analytics dashboard

### **Phase 4: Performance & Enterprise (2 min)**
11. Load testing (100/1000/10000 users)
12. Performance monitoring
13. Enterprise features showcase

**🚀 Complete enterprise-grade system with 60+ endpoints!** 🎉