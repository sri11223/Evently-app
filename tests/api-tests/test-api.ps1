# Test API endpoints
Write-Host "=== EVENTLY API TESTING SCRIPT ===" -ForegroundColor Green

# Test 1: Health Check
Write-Host "`n1. Testing Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET
    Write-Host "✅ Health Check: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Register Regular User
Write-Host "`n2. Testing User Registration..." -ForegroundColor Yellow
try {
    $userReg = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" -Method POST -Body '{"name":"Test User","email":"testuser' + (Get-Random) + '@example.com","password":"password123","role":"user"}' -ContentType "application/json"
    Write-Host "✅ User Registration: Success" -ForegroundColor Green
} catch {
    Write-Host "⚠️ User Registration: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Test 3: Register Admin User
Write-Host "`n3. Testing Admin Registration..." -ForegroundColor Yellow
$adminEmail = "admin" + (Get-Random) + "@example.com"
try {
    $adminReg = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" -Method POST -Body ('{"name":"Test Admin","email":"' + $adminEmail + '","password":"adminpass123","role":"admin"}') -ContentType "application/json"
    Write-Host "✅ Admin Registration: Success" -ForegroundColor Green
    $adminToken = $adminReg.data.token
    Write-Host "Admin Token: $($adminToken.Substring(0, 30))..." -ForegroundColor Cyan
} catch {
    Write-Host "❌ Admin Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 4: Create Event (Admin Only)
Write-Host "`n4. Testing Event Creation (Admin)..." -ForegroundColor Yellow
try {
    $eventData = @{
        name = "Test API Event"
        venue = "API Test Venue"
        event_date = "2025-10-20T19:00:00.000Z"
        total_capacity = 100
        price = 35.00
    } | ConvertTo-Json

    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }

    $event = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/events" -Method POST -Body $eventData -Headers $headers
    Write-Host "✅ Event Creation: Success - Event ID: $($event.data.id)" -ForegroundColor Green
    $eventId = $event.data.id
} catch {
    Write-Host "❌ Event Creation Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Get All Events
Write-Host "`n5. Testing Get All Events..." -ForegroundColor Yellow
try {
    $events = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/events" -Method GET
    Write-Host "✅ Get Events: Found $($events.data.Count) events" -ForegroundColor Green
} catch {
    Write-Host "❌ Get Events Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Login and Book Event
Write-Host "`n6. Testing Event Booking..." -ForegroundColor Yellow
$userEmail = "bookinguser" + (Get-Random) + "@example.com"
try {
    # Register booking user
    $bookingUser = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" -Method POST -Body ('{"name":"Booking User","email":"' + $userEmail + '","password":"password123"}') -ContentType "application/json"
    $userToken = $bookingUser.data.token

    # Book event if we have an eventId
    if ($eventId) {
        $bookingHeaders = @{
            "Authorization" = "Bearer $userToken"
            "Content-Type" = "application/json"
        }
        
        $booking = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/bookings" -Method POST -Body ('{"eventId":"' + $eventId + '","quantity":2}') -Headers $bookingHeaders
        Write-Host "✅ Event Booking: Success - Booking ID: $($booking.data.id)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Skipping booking - no event ID available" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Event Booking Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== API TESTING COMPLETE ===" -ForegroundColor Green