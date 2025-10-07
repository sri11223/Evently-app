# Waitlist System Full Testing Script
# Tests waitlist integration with events and bookings

$baseUrl = "https://evently-app-7hx2.onrender.com/api/v1"
$userToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NGEyM2M4ZC1iYjZmLTQwNWYtYTQ3Ni04YzFiOGNkNzkzNTciLCJlbWFpbCI6InNyaXJraXNobmFAZ21haWwuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NTk4MTM1NzQsImV4cCI6MTc1OTg5OTk3NH0.NCr8wzfGqVq7m4bELgthrk-_24qizgJ_8NkqWXPhmDI"
$adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwYmRiN2JmYS01OTliLTQ5NDQtOTQwZC01YmI1ZWRkNjI0OTQiLCJlbWFpbCI6InRlc3RhZG1pbjEyM0BldmVudGx5LmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1OTgxMzYzMCwiZXhwIjoxNzU5OTAwMDMwfQ.EwJZR2QcC4lDip-Qifguj2oefVMuxRXlzN4T0ZGfB94"

# Event with 0 available seats (sold out)
$soldOutEventId = "5e4c14a5-d397-4b7d-aa51-831f17993719"
$userId = "64a23c8d-bb6f-405f-a476-8c1b8cd79357"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🎯 WAITLIST SYSTEM COMPREHENSIVE TEST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Try to book sold-out event (should fail)
Write-Host "📋 TEST 1: Try booking sold-out event..." -ForegroundColor Yellow
try {
    $bookingBody = @{
        user_id = $userId
        event_id = $soldOutEventId
        quantity = 1
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/bookings" -Method Post `
        -Headers @{"Authorization"="Bearer $userToken"; "Content-Type"="application/json"} `
        -Body $bookingBody -ErrorAction Stop
    
    Write-Host "❌ UNEXPECTED: Booking succeeded when event is sold out!" -ForegroundColor Red
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "✅ PASS: Booking correctly rejected - event sold out" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Got error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Start-Sleep -Seconds 2

# Test 2: Join waitlist for sold-out event
Write-Host "`n📋 TEST 2: Join waitlist for sold-out event..." -ForegroundColor Yellow
try {
    $waitlistBody = @{
        user_id = $userId
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/join" -Method Post `
        -Headers @{"Authorization"="Bearer $userToken"; "Content-Type"="application/json"} `
        -Body $waitlistBody
    
    Write-Host "✅ PASS: Successfully joined waitlist!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "❌ FAIL: Failed to join waitlist" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host ($_.ErrorDetails.Message | ConvertFrom-Json | ConvertTo-Json -Depth 5)
    }
}

Start-Sleep -Seconds 2

# Test 3: Check waitlist position
Write-Host "`n📋 TEST 3: Check waitlist position..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/user/$userId" -Method Get `
        -Headers @{"Authorization"="Bearer $userToken"}
    
    Write-Host "✅ PASS: Retrieved waitlist position!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "❌ FAIL: Failed to get waitlist position" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Test 4: Get waitlist stats (admin)
Write-Host "`n📋 TEST 4: Get waitlist statistics (ADMIN)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/stats" -Method Get `
        -Headers @{"Authorization"="Bearer $adminToken"}
    
    Write-Host "✅ PASS: Retrieved waitlist stats!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ FAIL: Failed to get waitlist stats - Status: $statusCode" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host ($_.ErrorDetails.Message | ConvertFrom-Json | ConvertTo-Json -Depth 5)
    }
}

Start-Sleep -Seconds 2

# Test 5: Try joining waitlist again (should fail - duplicate)
Write-Host "`n📋 TEST 5: Try joining waitlist again (duplicate check)..." -ForegroundColor Yellow
try {
    $waitlistBody = @{
        user_id = $userId
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/join" -Method Post `
        -Headers @{"Authorization"="Bearer $userToken"; "Content-Type"="application/json"} `
        -Body $waitlistBody -ErrorAction Stop
    
    Write-Host "❌ FAIL: Should not allow duplicate waitlist entry!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "✅ PASS: Correctly rejected duplicate waitlist entry" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Got error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Start-Sleep -Seconds 2

# Test 6: Process waitlist (admin) - simulate seat becoming available
Write-Host "`n📋 TEST 6: Process waitlist promotions (ADMIN)..." -ForegroundColor Yellow
try {
    $processBody = @{
        available_seats = 1
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/process" -Method Post `
        -Headers @{"Authorization"="Bearer $adminToken"; "Content-Type"="application/json"} `
        -Body $processBody
    
    Write-Host "✅ PASS: Waitlist processed successfully!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ FAIL: Failed to process waitlist - Status: $statusCode" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host ($_.ErrorDetails.Message | ConvertFrom-Json | ConvertTo-Json -Depth 5)
    }
}

Start-Sleep -Seconds 2

# Test 7: Leave waitlist
Write-Host "`n📋 TEST 7: Leave waitlist..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/user/$userId" -Method Delete `
        -Headers @{"Authorization"="Bearer $userToken"}
    
    Write-Host "✅ PASS: Successfully left waitlist!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "❌ FAIL: Failed to leave waitlist" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WAITLIST TESTS COMPLETED!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
