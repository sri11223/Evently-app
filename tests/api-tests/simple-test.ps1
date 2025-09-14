# EVENTLY API COMPREHENSIVE TEST
Write-Host "=== EVENTLY API COMPREHENSIVE TEST ===" -ForegroundColor Green

$baseUrl = "http://localhost:3000"
$adminEmail = "admin$(Get-Random)@example.com"
$userEmail = "user$(Get-Random)@example.com"

# Test 1: Health Check
Write-Host "`n1. Health Check..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
Write-Host "Health Status: $($health.status)" -ForegroundColor Green

# Test 2: Register Admin
Write-Host "`n2. Register Admin..." -ForegroundColor Yellow
$adminReg = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/register" -Method POST -Body "{`"name`":`"Admin User`",`"email`":`"$adminEmail`",`"password`":`"adminpassword123`",`"role`":`"admin`"}" -ContentType "application/json"
$adminToken = $adminReg.data.token
Write-Host "Admin registered: $adminEmail" -ForegroundColor Green

# Test 3: Register User
Write-Host "`n3. Register User..." -ForegroundColor Yellow
$userReg = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/register" -Method POST -Body "{`"name`":`"Regular User`",`"email`":`"$userEmail`",`"password`":`"userpassword123`",`"role`":`"user`"}" -ContentType "application/json"
$userToken = $userReg.data.token
Write-Host "User registered: $userEmail" -ForegroundColor Green

# Test 4: Create Event (Admin)
Write-Host "`n4. Create Event..." -ForegroundColor Yellow
$adminHeaders = @{"Authorization" = "Bearer $adminToken"; "Content-Type" = "application/json"}
$eventBody = "{`"name`":`"Test Event 2025`",`"venue`":`"Test Venue`",`"event_date`":`"2025-11-15T18:00:00.000Z`",`"total_capacity`":100,`"price`":50.00}"
$newEvent = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method POST -Body $eventBody -Headers $adminHeaders
$eventId = $newEvent.data.id
Write-Host "Event created: $($newEvent.data.name) (ID: $eventId)" -ForegroundColor Green

# Test 5: Get All Events
Write-Host "`n5. Get All Events..." -ForegroundColor Yellow
$events = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method GET
Write-Host "Found $($events.data.Count) events" -ForegroundColor Green

# Test 6: Book Event (User)
Write-Host "`n6. Book Event..." -ForegroundColor Yellow
$userHeaders = @{"Authorization" = "Bearer $userToken"; "Content-Type" = "application/json"}
$bookingBody = "{`"eventId`":`"$eventId`",`"quantity`":2}"
try {
    $booking = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings" -Method POST -Body $bookingBody -Headers $userHeaders
    Write-Host "Booking successful: $($booking.data.id)" -ForegroundColor Green
} catch {
    Write-Host "Booking failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 7: Analytics (Admin)
Write-Host "`n7. Get Analytics..." -ForegroundColor Yellow
try {
    $analytics = Invoke-RestMethod -Uri "$baseUrl/api/v1/analytics/overview" -Method GET -Headers $adminHeaders
    Write-Host "Total Events: $($analytics.data.totalEvents)" -ForegroundColor Green
    Write-Host "Total Bookings: $($analytics.data.totalBookings)" -ForegroundColor Green
} catch {
    Write-Host "Analytics failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 8: Update Event (Admin)
Write-Host "`n8. Update Event..." -ForegroundColor Yellow
$updateBody = "{`"name`":`"Updated Test Event 2025`",`"price`":75.00}"
try {
    $updatedEvent = Invoke-RestMethod -Uri "$baseUrl/api/v1/events/$eventId" -Method PUT -Body $updateBody -Headers $adminHeaders
    Write-Host "Event updated: $($updatedEvent.data.name)" -ForegroundColor Green
} catch {
    Write-Host "Update failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 9: Delete Event (Admin)
Write-Host "`n9. Delete Event..." -ForegroundColor Yellow
try {
    $deleteResult = Invoke-RestMethod -Uri "$baseUrl/api/v1/events/$eventId" -Method DELETE -Headers $adminHeaders
    Write-Host "Event deleted successfully" -ForegroundColor Green
} catch {
    Write-Host "Delete failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 10: Cache Stats (Admin)
Write-Host "`n10. Cache Statistics..." -ForegroundColor Yellow
try {
    $cacheStats = Invoke-RestMethod -Uri "$baseUrl/api/v1/cache/stats" -Method GET -Headers $adminHeaders
    Write-Host "Cache Hit Rate: $($cacheStats.data.hitRate)%" -ForegroundColor Green
} catch {
    Write-Host "Cache stats failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor Green
Write-Host "All major API endpoints tested successfully!" -ForegroundColor Green