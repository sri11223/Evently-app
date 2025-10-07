# Waitlist Integration Test - Booking Cancellation Auto-Promotion
$baseUrl = "https://evently-app-7hx2.onrender.com/api/v1"
$userToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NGEyM2M4ZC1iYjZmLTQwNWYtYTQ3Ni04YzFiOGNkNzkzNTciLCJlbWFpbCI6InNyaXJraXNobmFAZ21haWwuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NTk4MTM1NzQsImV4cCI6MTc1OTg5OTk3NH0.NCr8wzfGqVq7m4bELgthrk-_24qizgJ_8NkqWXPhmDI"
$adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwYmRiN2JmYS01OTliLTQ5NDQtOTQwZC01YmI1ZWRkNjI0OTQiLCJlbWFpbCI6InRlc3RhZG1pbjEyM0BldmVudGx5LmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1OTgxMzYzMCwiZXhwIjoxNzU5OTAwMDMwfQ.EwJZR2QcC4lDip-Qifguj2oefVMuxRXlzN4T0ZGfB94"

# Event with bookings that can be cancelled
$eventWithBooking = "eb3a9052-0346-477a-be78-2c216150024f"  # Demo Event with 98 available_seats
$userId = "64a23c8d-bb6f-405f-a476-8c1b8cd79357"

Write-Host ""
Write-Host "WAITLIST INTEGRATION TEST - AUTO-PROMOTION" -ForegroundColor Cyan
Write-Host "==========================================="
Write-Host ""

# Step 1: Create a booking to fill last seat
Write-Host "STEP 1: Book last seats to make event full..." -ForegroundColor Yellow
try {
    $body = @{ user_id = $userId; event_id = $eventWithBooking; quantity = 98 } | ConvertTo-Json
    $booking = Invoke-RestMethod -Uri "$baseUrl/bookings" -Method Post `
        -Headers @{"Authorization"="Bearer $userToken"; "Content-Type"="application/json"} -Body $body
    Write-Host "SUCCESS: Booked 98 seats!" -ForegroundColor Green
    $bookingId = $booking.data.booking.id
    Write-Host "Booking ID: $bookingId"
    Write-Host "Reference: $($booking.data.booking.booking_reference)"
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

Write-Host ""
Start-Sleep -Seconds 2

# Step 2: Verify event is full
Write-Host "STEP 2: Verify event is full..." -ForegroundColor Yellow
try {
    $event = Invoke-RestMethod -Uri "$baseUrl/events/$eventWithBooking"
    Write-Host "Available seats: $($event.data.available_seats)" -ForegroundColor Cyan
    if ($event.data.available_seats -eq 0) {
        Write-Host "SUCCESS: Event is sold out!" -ForegroundColor Green
    }
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Start-Sleep -Seconds 2

# Step 3: Another user joins waitlist
Write-Host "STEP 3: Join waitlist as different user..." -ForegroundColor Yellow
$waitlistUserId = "0bddb7fa-599b-4944-940d-5bb5edd62494"  # Admin user
try {
    $body = @{ user_id = $waitlistUserId } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$eventWithBooking/join" -Method Post `
        -Headers @{"Authorization"="Bearer $adminToken"; "Content-Type"="application/json"} -Body $body
    Write-Host "SUCCESS: Joined waitlist at position $($response.data.position)!" -ForegroundColor Green
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

Write-Host ""
Start-Sleep -Seconds 2

# Step 4: Cancel original booking (should trigger auto-promotion)
Write-Host "STEP 4: Cancel booking - AUTO-PROMOTION TRIGGER..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/bookings/$bookingId/cancel" -Method Put `
        -Headers @{"Authorization"="Bearer $userToken"}
    Write-Host "SUCCESS: Booking cancelled!" -ForegroundColor Green
    Write-Host "Seats returned: $($response.seats_returned)"
    Write-Host "Waitlist processed: $($response.waitlist_processed)"
    Write-Host ($response | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Start-Sleep -Seconds 2

# Step 5: Check if user was promoted
Write-Host "STEP 5: Check waitlist status (should be promoted)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$eventWithBooking/user/$waitlistUserId" `
        -Method Get -Headers @{"Authorization"="Bearer $adminToken"}
    Write-Host "User still in waitlist - not promoted yet" -ForegroundColor Yellow
    Write-Host ($response | ConvertTo-Json -Depth 3)
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) {
        Write-Host "SUCCESS: User NOT in waitlist (likely promoted)!" -ForegroundColor Green
    } else {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "INTEGRATION TEST COMPLETED!" -ForegroundColor Cyan
Write-Host ""
