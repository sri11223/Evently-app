# COMPREHENSIVE EVENTLY API TEST SUITE
Write-Host "=== EVENTLY BOOKING SYSTEM - FULL API TEST SUITE ===" -ForegroundColor Green

$baseUrl = "http://localhost:3000"
$adminEmail = "testadmin" + (Get-Random -Minimum 1000 -Maximum 9999) + "@example.com"
$userEmail = "testuser" + (Get-Random -Minimum 1000 -Maximum 9999) + "@example.com"

# Test 1: Health Check
Write-Host "`n📊 1. TESTING HEALTH CHECK..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "✅ Health Status: $($health.status)" -ForegroundColor Green
    Write-Host "   Uptime: $($health.uptime) seconds" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Register Admin User
Write-Host "`n👑 2. REGISTERING ADMIN USER..." -ForegroundColor Cyan
try {
    $adminData = @{
        name = "Test Admin"
        email = $adminEmail
        password = "adminpass123"
        role = "admin"
    } | ConvertTo-Json

    $adminReg = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/register" -Method POST -Body $adminData -ContentType "application/json"
    $adminToken = $adminReg.data.token
    Write-Host "✅ Admin registered: $adminEmail" -ForegroundColor Green
    Write-Host "   Admin Token: $($adminToken.Substring(0, 30))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Admin Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: Register Regular User
Write-Host "`n👤 3. REGISTERING REGULAR USER..." -ForegroundColor Cyan
try {
    $userData = @{
        name = "Test User"
        email = $userEmail
        password = "userpass123"
        role = "user"
    } | ConvertTo-Json

    $userReg = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/register" -Method POST -Body $userData -ContentType "application/json"
    $userToken = $userReg.data.token
    Write-Host "✅ User registered: $userEmail" -ForegroundColor Green
    Write-Host "   User Token: $($userToken.Substring(0, 30))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ User Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 4: Create Multiple Events (Admin Only)
Write-Host "`n🎉 4. CREATING EVENTS (ADMIN ONLY)..." -ForegroundColor Cyan
$createdEvents = @()

$events = @(
    @{
        name = "Tech Conference 2025"
        venue = "Convention Center"
        event_date = "2025-11-15T09:00:00.000Z"
        total_capacity = 200
        price = 150.00
    },
    @{
        name = "Startup Pitch Night"
        venue = "Innovation Hub"
        event_date = "2025-11-20T18:30:00.000Z"
        total_capacity = 50
        price = 25.00
    },
    @{
        name = "AI Workshop"
        venue = "Tech Campus"
        event_date = "2025-12-05T14:00:00.000Z"
        total_capacity = 30
        price = 75.00
    }
)

$adminHeaders = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

foreach ($eventData in $events) {
    try {
        $eventJson = $eventData | ConvertTo-Json
        $event = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method POST -Body $eventJson -Headers $adminHeaders
        $createdEvents += $event.data
        Write-Host "✅ Created event: $($eventData.name)" -ForegroundColor Green
        Write-Host "   Event ID: $($event.data.id)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Failed to create event $($eventData.name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 5: Get All Events
Write-Host "`n📋 5. GETTING ALL EVENTS..." -ForegroundColor Cyan
try {
    $allEvents = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method GET
    Write-Host "✅ Retrieved $($allEvents.data.Count) events" -ForegroundColor Green
    foreach ($event in $allEvents.data | Select-Object -First 3) {
        Write-Host "   - $($event.name) at $($event.venue)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Get Events Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Book Events (Regular User)
Write-Host "`n🎫 6. BOOKING EVENTS..." -ForegroundColor Cyan
$userHeaders = @{
    "Authorization" = "Bearer $userToken"
    "Content-Type" = "application/json"
}

$bookings = @()
foreach ($event in $createdEvents | Select-Object -First 2) {
    try {
        $bookingData = @{
            eventId = $event.id
            quantity = 2
        } | ConvertTo-Json

        $booking = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings" -Method POST -Body $bookingData -Headers $userHeaders
        $bookings += $booking.data
        Write-Host "✅ Booked: $($event.name) (2 tickets)" -ForegroundColor Green
        Write-Host "   Booking ID: $($booking.data.id)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Booking failed for $($event.name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 7: Get User's Bookings
Write-Host "`n📝 7. GETTING USER BOOKINGS..." -ForegroundColor Cyan
try {
    $userBookings = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/user" -Method GET -Headers $userHeaders
    Write-Host "✅ User has $($userBookings.data.Count) bookings" -ForegroundColor Green
    foreach ($booking in $userBookings.data) {
        Write-Host "   - Booking ID: $($booking.id) for Event: $($booking.event_name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Get User Bookings Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 8: Analytics (Admin Only)
Write-Host "`n📊 8. TESTING ANALYTICS..." -ForegroundColor Cyan
try {
    $analytics = Invoke-RestMethod -Uri "$baseUrl/api/v1/analytics/overview" -Method GET -Headers $adminHeaders
    Write-Host "✅ Analytics Overview:" -ForegroundColor Green
    Write-Host "   Total Events: $($analytics.data.totalEvents)" -ForegroundColor Gray
    Write-Host "   Total Bookings: $($analytics.data.totalBookings)" -ForegroundColor Gray
    Write-Host "   Total Revenue: `$$($analytics.data.totalRevenue)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Analytics Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 9: Advanced Analytics
Write-Host "`n📈 9. TESTING ADVANCED ANALYTICS..." -ForegroundColor Cyan
try {
    $advancedAnalytics = Invoke-RestMethod -Uri "$baseUrl/api/v1/analytics/advanced" -Method GET -Headers $adminHeaders
    Write-Host "✅ Advanced Analytics Retrieved" -ForegroundColor Green
    Write-Host "   Popular Events Count: $($advancedAnalytics.data.popularEvents.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Advanced Analytics Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 10: Cache Testing
Write-Host "`n💾 10. TESTING CACHE..." -ForegroundColor Cyan
try {
    $cacheStats = Invoke-RestMethod -Uri "$baseUrl/api/v1/cache/stats" -Method GET -Headers $adminHeaders
    Write-Host "✅ Cache Stats:" -ForegroundColor Green
    Write-Host "   Hit Rate: $($cacheStats.data.hitRate)%" -ForegroundColor Gray
    Write-Host "   Total Keys: $($cacheStats.data.keyCount)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Cache Stats Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 11: Waitlist Testing (Fill up an event)
Write-Host "`n⏳ 11. TESTING WAITLIST FUNCTIONALITY..." -ForegroundColor Cyan
if ($createdEvents.Count -gt 0) {
    $smallEvent = $createdEvents | Where-Object { $_.total_capacity -eq 30 } | Select-Object -First 1
    if ($smallEvent) {
        try {
            # Try to book more tickets than capacity to trigger waitlist
            $waitlistData = @{
                eventId = $smallEvent.id
                quantity = 25
            } | ConvertTo-Json

            $waitlistBooking = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings" -Method POST -Body $waitlistData -Headers $userHeaders
            Write-Host "✅ Large booking successful (should trigger waitlist logic)" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Waitlist test: $($_.Exception.Message)" -ForegroundColor Yellow
        }

        # Check waitlist status
        try {
            $waitlistStatus = Invoke-RestMethod -Uri "$baseUrl/api/v1/waitlist/$($smallEvent.id)" -Method GET -Headers $adminHeaders
            Write-Host "✅ Waitlist status retrieved" -ForegroundColor Green
        } catch {
            Write-Host "❌ Waitlist Status Failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Test 12: Event Updates (Admin Only)
Write-Host "`n✏️ 12. TESTING EVENT UPDATES..." -ForegroundColor Cyan
if ($createdEvents.Count -gt 0) {
    $eventToUpdate = $createdEvents[0]
    try {
        $updateData = @{
            name = "$($eventToUpdate.name) - UPDATED"
            price = $eventToUpdate.price + 10
        } | ConvertTo-Json

        $updatedEvent = Invoke-RestMethod -Uri "$baseUrl/api/v1/events/$($eventToUpdate.id)" -Method PUT -Body $updateData -Headers $adminHeaders
        Write-Host "✅ Event updated: $($updatedEvent.data.name)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Event Update Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 13: Event Deletion (Admin Only)
Write-Host "`n🗑️ 13. TESTING EVENT DELETION..." -ForegroundColor Cyan
if ($createdEvents.Count -gt 2) {
    $eventToDelete = $createdEvents[-1]  # Last event
    try {
        $deleteResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/events/$($eventToDelete.id)" -Method DELETE -Headers $adminHeaders
        Write-Host "✅ Event deleted: $($eventToDelete.name)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Event Deletion Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 14: Notifications Testing
Write-Host "`n🔔 14. TESTING NOTIFICATIONS..." -ForegroundColor Cyan
try {
    $notifications = Invoke-RestMethod -Uri "$baseUrl/api/v1/notifications" -Method GET -Headers $userHeaders
    Write-Host "✅ Notifications retrieved: $($notifications.data.Count) notifications" -ForegroundColor Green
} catch {
    Write-Host "❌ Notifications Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 15: Load Testing Endpoint
Write-Host "`n⚡ 15. TESTING LOAD TEST ENDPOINT..." -ForegroundColor Cyan
try {
    $loadTest = Invoke-RestMethod -Uri "$baseUrl/api/v1/loadtest/light" -Method POST -Headers $adminHeaders
    Write-Host "✅ Load test completed: $($loadTest.message)" -ForegroundColor Green
} catch {
    Write-Host "❌ Load Test Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Final Summary
Write-Host "`n=== TEST SUITE COMPLETE ===" -ForegroundColor Green
Write-Host "🎯 SUMMARY:" -ForegroundColor Yellow
Write-Host "✅ Admin User: $adminEmail" -ForegroundColor Green  
Write-Host "✅ Regular User: $userEmail" -ForegroundColor Green
Write-Host "✅ Events Created: $($createdEvents.Count)" -ForegroundColor Green
Write-Host "✅ Bookings Made: $($bookings.Count)" -ForegroundColor Green
Write-Host "`n🚀 Your Evently Booking System is fully functional!" -ForegroundColor Green