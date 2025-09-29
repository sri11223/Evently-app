# EVENT MANAGEMENT ENDPOINTS TEST
Write-Host "=== EVENT MANAGEMENT ENDPOINTS TEST ===" -ForegroundColor Green

$baseUrl = "https://evently-app-7hx2.onrender.com"
$adminEmail = "eventadmin$(Get-Random)@example.com"

# Step 1: Register Admin User
Write-Host "`n1. Registering Admin User..." -ForegroundColor Yellow
try {
    $adminReg = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/register" -Method POST -Body "{`"name`":`"Event Admin`",`"email`":`"$adminEmail`",`"password`":`"adminpassword123`",`"role`":`"admin`"}" -ContentType "application/json"
    $adminToken = $adminReg.data.token
    Write-Host "✅ Admin registered: $adminEmail" -ForegroundColor Green
    Write-Host "   Token: $($adminToken.Substring(0, 30))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Admin Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$adminHeaders = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

# Step 2: Test LIST EVENTS (Public endpoint)
Write-Host "`n2. Testing LIST EVENTS..." -ForegroundColor Yellow
try {
    $events = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method GET
    Write-Host "✅ LIST EVENTS: Found $($events.count) events" -ForegroundColor Green
    if ($events.count -gt 0) {
        Write-Host "   Sample event: $($events.data[0].name) at $($events.data[0].venue)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ LIST EVENTS Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 3: Test POPULAR EVENTS
Write-Host "`n3. Testing POPULAR EVENTS..." -ForegroundColor Yellow
try {
    $popularEvents = Invoke-RestMethod -Uri "$baseUrl/api/v1/events/popular" -Method GET
    Write-Host "✅ POPULAR EVENTS: Found $($popularEvents.count) popular events" -ForegroundColor Green
} catch {
    Write-Host "❌ POPULAR EVENTS Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 4: Test CREATE EVENT (Admin) - Using correct field names from API guide
Write-Host "`n4. Testing CREATE EVENT (Admin)..." -ForegroundColor Yellow
try {
    # Using field names from the API documentation
    $eventData = @{
        name = "Demo Event Test"
        venue = "Demo Venue Test"
        eventDate = "2025-12-25T18:00:00Z"
        totalCapacity = 100
        price = 50.00
    } | ConvertTo-Json

    Write-Host "   Creating event with data: $eventData" -ForegroundColor Gray
    $newEvent = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method POST -Body $eventData -Headers $adminHeaders
    $eventId = $newEvent.data.event.id
    Write-Host "✅ CREATE EVENT: Success!" -ForegroundColor Green
    Write-Host "   Event ID: $eventId" -ForegroundColor Gray
    Write-Host "   Event Name: $($newEvent.data.event.name)" -ForegroundColor Gray
} catch {
    Write-Host "❌ CREATE EVENT Failed: $($_.Exception.Message)" -ForegroundColor Red
    
    # Let's also try with the field names our controller expects
    Write-Host "   Trying with alternative field names..." -ForegroundColor Yellow
    try {
        $alternativeEventData = @{
            name = "Demo Event Test Alt"
            venue = "Demo Venue Test Alt"
            event_date = "2025-12-25T18:00:00Z"
            total_capacity = 100
            price = 50.00
        } | ConvertTo-Json

        $newEvent = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method POST -Body $alternativeEventData -Headers $adminHeaders
        $eventId = $newEvent.data.event.id
        Write-Host "✅ CREATE EVENT (Alternative): Success!" -ForegroundColor Green
        Write-Host "   Event ID: $eventId" -ForegroundColor Gray
    } catch {
        Write-Host "❌ CREATE EVENT (Alternative) Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 5: Test GET SPECIFIC EVENT (if we have an eventId)
if ($eventId) {
    Write-Host "`n5. Testing GET SPECIFIC EVENT..." -ForegroundColor Yellow
    try {
        $specificEvent = Invoke-RestMethod -Uri "$baseUrl/api/v1/events/$eventId" -Method GET
        Write-Host "✅ GET SPECIFIC EVENT: Success!" -ForegroundColor Green
        Write-Host "   Event: $($specificEvent.data.name)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ GET SPECIFIC EVENT Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    # Try with an existing event ID from the list
    Write-Host "`n5. Testing GET SPECIFIC EVENT (using existing event)..." -ForegroundColor Yellow
    try {
        $events = Invoke-RestMethod -Uri "$baseUrl/api/v1/events" -Method GET
        if ($events.count -gt 0) {
            $existingEventId = $events.data[0].id
            $specificEvent = Invoke-RestMethod -Uri "$baseUrl/api/v1/events/$existingEventId" -Method GET
            Write-Host "✅ GET SPECIFIC EVENT: Success!" -ForegroundColor Green
            Write-Host "   Event: $($specificEvent.data.name)" -ForegroundColor Gray
            $eventId = $existingEventId  # Use for update/delete tests
        }
    } catch {
        Write-Host "❌ GET SPECIFIC EVENT Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 6: Test UPDATE EVENT (Admin)
if ($eventId) {
    Write-Host "`n6. Testing UPDATE EVENT (Admin)..." -ForegroundColor Yellow
    try {
        $updateData = @{
            name = "Updated Demo Event Test"
            price = 75.00
        } | ConvertTo-Json

        $updatedEvent = Invoke-RestMethod -Uri "$baseUrl/api/v1/events/$eventId" -Method PUT -Body $updateData -Headers $adminHeaders
        Write-Host "✅ UPDATE EVENT: Success!" -ForegroundColor Green
        Write-Host "   Updated name: $($updatedEvent.data[0].name)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ UPDATE EVENT Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 7: Test DELETE EVENT (Admin) - Only if we created a new event
if ($eventId -and $newEvent) {
    Write-Host "`n7. Testing DELETE EVENT (Admin)..." -ForegroundColor Yellow
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/v1/events/$eventId" -Method DELETE -Headers $adminHeaders
        Write-Host "✅ DELETE EVENT: Success!" -ForegroundColor Green
    } catch {
        Write-Host "❌ DELETE EVENT Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== EVENT MANAGEMENT TEST COMPLETE ===" -ForegroundColor Green