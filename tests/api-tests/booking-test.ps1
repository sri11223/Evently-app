# BOOKING SYSTEM ENDPOINTS TEST
Write-Host "=== BOOKING SYSTEM ENDPOINTS TEST ===" -ForegroundColor Green

$baseUrl = "http://localhost:3000"
$adminEmail = "bookingadmin$(Get-Random)@example.com"
$userEmail = "bookinguser$(Get-Random)@example.com"

# Step 1: Setup - Register Admin and User
Write-Host "`n1. Setting up Admin and User accounts..." -ForegroundColor Yellow

# Register Admin
try {
    $adminReg = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/register" -Method POST -Body "{`"name`":`"Booking Admin`",`"email`":`"$adminEmail`",`"password`":`"adminpassword123`",`"role`":`"admin`"}" -ContentType "application/json"
    $adminToken = $adminReg.data.token
    Write-Host "✅ Admin registered: $adminEmail" -ForegroundColor Green
} catch {
    Write-Host "❌ Admin Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Register User
try {
    $userReg = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/register" -Method POST -Body "{`"name`":`"Booking User`",`"email`":`"$userEmail`",`"password`":`"userpassword123`",`"role`":`"user`"}" -ContentType "application/json"
    $userToken = $userReg.data.token
    $userId = $userReg.data.user.id
    Write-Host "✅ User registered: $userEmail" -ForegroundColor Green
    Write-Host "   User ID: $userId" -ForegroundColor Gray
} catch {
    Write-Host "❌ User Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$adminHeaders = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

$userHeaders = @{
    "Authorization" = "Bearer $userToken"  
    "Content-Type" = "application/json"
}

# Step 2: Create a test event for booking
Write-Host "`n2. Creating test event for booking..." -ForegroundColor Yellow
try {
    $eventData = @{
        name = "Booking Test Event"
        venue = "Test Venue for Booking"
        event_date = "2025-12-30T19:00:00Z"
        total_capacity = 50
        price = 25.00
    } | ConvertTo-Json

    $testEvent = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method POST -Body $eventData -Headers $adminHeaders
    $eventId = $testEvent.data.event.id
    Write-Host "✅ Test event created: $($testEvent.data.event.name)" -ForegroundColor Green
    Write-Host "   Event ID: $eventId" -ForegroundColor Gray
} catch {
    Write-Host "❌ Test event creation failed: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get an existing event instead
    try {
        $events = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method GET
        if ($events.data.Count -gt 0) {
            $eventId = $events.data[0].id
            Write-Host "✅ Using existing event: $($events.data[0].name)" -ForegroundColor Green
            Write-Host "   Event ID: $eventId" -ForegroundColor Gray
        }
    } catch {
        Write-Host "❌ Cannot get existing events either" -ForegroundColor Red
        exit 1
    }
}

# Step 3: Test CREATE BOOKING
Write-Host "`n3. Testing CREATE BOOKING..." -ForegroundColor Yellow
try {
    $bookingData = @{
        user_id = $userId
        event_id = $eventId
        quantity = 2
    } | ConvertTo-Json

    Write-Host "   Booking data: $bookingData" -ForegroundColor Gray
    $booking = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings" -Method POST -Body $bookingData -Headers $userHeaders
    Write-Host "   Full booking response: $($booking | ConvertTo-Json -Depth 4)" -ForegroundColor Gray
    
    # Try different paths to get the booking data
    if ($booking.data.booking) {
        $bookingId = $booking.data.booking.id
        $bookingReference = $booking.data.booking.reference_number
        $quantity = $booking.data.booking.quantity
    } elseif ($booking.data.id) {
        $bookingId = $booking.data.id
        $bookingReference = $booking.data.reference_number
        $quantity = $booking.data.quantity
    } else {
        $bookingId = $booking.booking.id
        $bookingReference = $booking.booking.reference_number
        $quantity = $booking.booking.quantity
    }
    
    Write-Host "✅ CREATE BOOKING: Success!" -ForegroundColor Green
    Write-Host "   Booking ID: $bookingId" -ForegroundColor Gray
    Write-Host "   Reference: $bookingReference" -ForegroundColor Gray
    Write-Host "   Quantity: $quantity" -ForegroundColor Gray
} catch {
    Write-Host "❌ CREATE BOOKING Failed: $($_.Exception.Message)" -ForegroundColor Red
    # Parse the error response for more details
    try {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "   Error details: $($errorResponse.error)" -ForegroundColor Red
    } catch {
        Write-Host "   Raw error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 4: Test GET USER BOOKINGS  
Write-Host "`n4. Testing GET USER BOOKINGS..." -ForegroundColor Yellow
try {
    $userBookings = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/user/$userId" -Method GET -Headers $userHeaders
    Write-Host "✅ GET USER BOOKINGS: Success!" -ForegroundColor Green
    Write-Host "   User has $($userBookings.data.Count) booking(s)" -ForegroundColor Gray
    
    foreach ($booking in $userBookings.data) {
        Write-Host "   - Booking: $($booking.reference_number) for $($booking.quantity) tickets" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ GET USER BOOKINGS Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Alternative GET USER BOOKINGS endpoint (sometimes the route is different)
Write-Host "`n4b. Testing Alternative GET USER BOOKINGS..." -ForegroundColor Yellow
try {
    $userBookingsAlt = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/user" -Method GET -Headers $userHeaders
    Write-Host "✅ GET USER BOOKINGS (Alt): Success!" -ForegroundColor Green
    Write-Host "   User has $($userBookingsAlt.data.Count) booking(s)" -ForegroundColor Gray
} catch {
    Write-Host "❌ GET USER BOOKINGS (Alt) Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 5: Test GET BOOKING BY REFERENCE
if ($bookingReference) {
    Write-Host "`n5. Testing GET BOOKING BY REFERENCE..." -ForegroundColor Yellow
    try {
        $bookingByRef = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/reference/$bookingReference" -Method GET
        Write-Host "✅ GET BOOKING BY REFERENCE: Success!" -ForegroundColor Green
        Write-Host "   Reference: $($bookingByRef.data.reference_number)" -ForegroundColor Gray
        Write-Host "   Status: $($bookingByRef.data.status)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ GET BOOKING BY REFERENCE Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "`n5. Skipping GET BOOKING BY REFERENCE (no reference available)" -ForegroundColor Yellow
}

# Step 6: Test CANCEL BOOKING
if ($bookingId) {
    Write-Host "`n6. Testing CANCEL BOOKING..." -ForegroundColor Yellow
    try {
        $cancelResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/$bookingId/cancel" -Method PUT -Headers $userHeaders
        Write-Host "✅ CANCEL BOOKING: Success!" -ForegroundColor Green
        Write-Host "   Status: $($cancelResponse.data.status)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ CANCEL BOOKING Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "`n6. Skipping CANCEL BOOKING (no booking ID available)" -ForegroundColor Yellow
}

# Step 7: Verify booking status after cancellation
if ($bookingReference) {
    Write-Host "`n7. Verifying booking status after cancellation..." -ForegroundColor Yellow
    try {
        $verifyBooking = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/reference/$bookingReference" -Method GET
        Write-Host "✅ Booking status verified: $($verifyBooking.data.status)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Booking verification failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Cleanup: Delete test event if we created it
if ($testEvent -and $eventId) {
    Write-Host "`n8. Cleaning up test event..." -ForegroundColor Yellow
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/v1/events/$eventId" -Method DELETE -Headers $adminHeaders
        Write-Host "✅ Test event cleaned up" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not clean up test event: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "`n=== BOOKING SYSTEM TEST COMPLETE ===" -ForegroundColor Green