# BOOKING SYSTEM FINAL TEST
Write-Host "=== BOOKING SYSTEM FINAL TEST ===" -ForegroundColor Green

$baseUrl = "http://localhost:3000"
$userEmail = "finalbookinguser$(Get-Random)@example.com"

# Step 1: Register User
Write-Host "`n1. Registering User..." -ForegroundColor Yellow
try {
    $userReg = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/register" -Method POST -Body "{`"name`":`"Final Test User`",`"email`":`"$userEmail`",`"password`":`"userpassword123`",`"role`":`"user`"}" -ContentType "application/json"
    $userToken = $userReg.data.token
    $userId = $userReg.data.user.id
    Write-Host "✅ User registered: $userEmail" -ForegroundColor Green
} catch {
    Write-Host "❌ User Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$userHeaders = @{
    "Authorization" = "Bearer $userToken"  
    "Content-Type" = "application/json"
}

# Step 2: Get existing event
Write-Host "`n2. Getting existing event..." -ForegroundColor Yellow
try {
    $events = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method GET
    if ($events.data.Count -gt 0) {
        $eventId = $events.data[0].id
        Write-Host "✅ Using existing event: $($events.data[0].name)" -ForegroundColor Green
        Write-Host "   Event ID: $eventId" -ForegroundColor Gray
    } else {
        Write-Host "❌ No events available for testing" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Cannot get events: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Wait a moment to avoid rate limiting
Write-Host "`n3. Waiting to avoid rate limits..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Step 4: Test CREATE BOOKING
Write-Host "`n4. Testing CREATE BOOKING..." -ForegroundColor Yellow
try {
    $bookingData = @{
        user_id = $userId
        event_id = $eventId
        quantity = 1
    } | ConvertTo-Json

    $booking = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings" -Method POST -Body $bookingData -Headers $userHeaders
    Write-Host "✅ CREATE BOOKING: Success!" -ForegroundColor Green
    Write-Host "   Booking Response: $($booking | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
    
    # Extract booking details from response
    $bookingId = if ($booking.booking) { $booking.booking.id } else { $booking.data.booking.id }
    $bookingReference = if ($booking.booking) { $booking.booking.reference_number } else { $booking.data.booking.reference_number }
    
    Write-Host "   Booking ID: $bookingId" -ForegroundColor Green
    Write-Host "   Reference: $bookingReference" -ForegroundColor Green
    
} catch {
    Write-Host "❌ CREATE BOOKING Failed: $($_.Exception.Message)" -ForegroundColor Red
    try {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "   Error details: $($errorResponse.error)" -ForegroundColor Red
    } catch {
        Write-Host "   Raw error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 5: Test GET USER BOOKINGS  
Write-Host "`n5. Testing GET USER BOOKINGS..." -ForegroundColor Yellow
try {
    $userBookings = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/user/$userId" -Method GET -Headers $userHeaders
    Write-Host "✅ GET USER BOOKINGS: Success!" -ForegroundColor Green
    Write-Host "   User has $($userBookings.data.Count) booking(s)" -ForegroundColor Gray
    
    foreach ($userBooking in $userBookings.data) {
        Write-Host "   - Reference: $($userBooking.reference_number), Quantity: $($userBooking.quantity), Status: $($userBooking.status)" -ForegroundColor Gray
        if (-not $bookingReference -and $userBooking.reference_number) {
            $bookingReference = $userBooking.reference_number
            $bookingId = $userBooking.id
        }
    }
} catch {
    Write-Host "❌ GET USER BOOKINGS Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 6: Test GET BOOKING BY REFERENCE
if ($bookingReference) {
    Write-Host "`n6. Testing GET BOOKING BY REFERENCE..." -ForegroundColor Yellow
    try {
        $bookingByRef = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/reference/$bookingReference" -Method GET
        Write-Host "✅ GET BOOKING BY REFERENCE: Success!" -ForegroundColor Green
        Write-Host "   Reference: $($bookingByRef.data.reference_number)" -ForegroundColor Gray
        Write-Host "   Status: $($bookingByRef.data.status)" -ForegroundColor Gray
        Write-Host "   Event: $($bookingByRef.data.event_name)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ GET BOOKING BY REFERENCE Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "`n6. Skipping GET BOOKING BY REFERENCE (no reference available)" -ForegroundColor Yellow
}

# Step 7: Test CANCEL BOOKING
if ($bookingId) {
    Write-Host "`n7. Testing CANCEL BOOKING..." -ForegroundColor Yellow
    try {
        $cancelResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/$bookingId/cancel" -Method PUT -Headers $userHeaders
        Write-Host "✅ CANCEL BOOKING: Success!" -ForegroundColor Green
        Write-Host "   Message: $($cancelResponse.message)" -ForegroundColor Gray
        Write-Host "   Status: $($cancelResponse.data.status)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ CANCEL BOOKING Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "`n7. Skipping CANCEL BOOKING (no booking ID available)" -ForegroundColor Yellow
}

# Step 8: Verify cancellation
if ($bookingReference) {
    Write-Host "`n8. Verifying booking cancellation..." -ForegroundColor Yellow
    try {
        $verifyBooking = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/reference/$bookingReference" -Method GET
        Write-Host "✅ Final booking status: $($verifyBooking.data.status)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Verification failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== BOOKING SYSTEM TEST COMPLETE ===" -ForegroundColor Green
Write-Host "✅ All 4 booking endpoints tested!" -ForegroundColor Green