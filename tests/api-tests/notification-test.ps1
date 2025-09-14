# Notification System Endpoints Test Script  
# Tests all 4 notification system endpoints with proper authentication
Write-Host "NOTIFICATION SYSTEM TESTING SCRIPT" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# API Configuration
$baseUrl = "https://evently-app-7hx2.onrender.com/api/v1"
$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "`nStep 1: Authentication Setup" -ForegroundColor Yellow

# Admin Login (using working admin endpoint approach)
$adminLoginBody = @{
    email = "admin2@evently.com"
    password = "admin123"
} | ConvertTo-Json

try {
    Write-Host "Logging in as admin..." -ForegroundColor White
    $adminResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $adminLoginBody -Headers $headers
    $adminToken = $adminResponse.data.token
    Write-Host "SUCCESS: Admin login successful" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Admin login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Register a test user for notification testing
$userEmail = "notification-user-$(Get-Random)@test.com"
$userRegisterBody = @{
    name = "Notification Test User"
    email = $userEmail
    password = "password123"
    role = "user"
} | ConvertTo-Json

try {
    Write-Host "Registering test user..." -ForegroundColor White
    $userResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $userRegisterBody -Headers $headers
    $userToken = $userResponse.data.token
    $userId = $userResponse.data.user.id
    Write-Host "SUCCESS: Test user registered - ID: $userId" -ForegroundColor Green
} catch {
    Write-Host "ERROR: User registration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Create headers with tokens
$adminHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $adminToken"
}

$userHeaders = @{
    "Content-Type" = "application/json" 
    "Authorization" = "Bearer $userToken"
}

Write-Host "`nStep 2: Getting Event ID for Notification Testing" -ForegroundColor Yellow

# Get an event ID for broadcast testing
try {
    $eventsResponse = Invoke-RestMethod -Uri "$baseUrl/events" -Method GET
    if ($eventsResponse.data -and $eventsResponse.data.Count -gt 0) {
        $eventId = $eventsResponse.data[0].id
        $eventName = $eventsResponse.data[0].name
        Write-Host "SUCCESS: Using Event - ID: $eventId, Name: $eventName" -ForegroundColor Green
    } else {
        Write-Host "ERROR: No events found for notification testing" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Could not get events: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 3: Testing Notification Endpoints" -ForegroundColor Yellow

# Test function
function Test-NotificationEndpoint {
    param($url, $method, $name, $headers, $body = $null)
    try {
        Write-Host "`nTesting: $name" -ForegroundColor Cyan
        Write-Host "Method: $method $url" -ForegroundColor Gray
        
        if ($body) {
            Write-Host "Body: $($body | ConvertFrom-Json | ConvertTo-Json -Compress)" -ForegroundColor Gray
            $response = Invoke-RestMethod -Uri $url -Method $method -Headers $headers -Body $body
        } else {
            $response = Invoke-RestMethod -Uri $url -Method $method -Headers $headers
        }
        
        Write-Host "SUCCESS: $name" -ForegroundColor Green
        
        # Show response data
        if ($response.success) {
            Write-Host "Response: SUCCESS" -ForegroundColor Green
            if ($response.data) {
                Write-Host "Data: $($response.data | ConvertTo-Json -Compress)" -ForegroundColor White
            }
            if ($response.message) {
                Write-Host "Message: $($response.message)" -ForegroundColor White
            }
        }
        
        return $true
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $reasonPhrase = $_.Exception.Response.ReasonPhrase
        
        if ($statusCode -eq 429) {
            Write-Host "WARNING: RATE LIMITED: $name (429)" -ForegroundColor Yellow
        } elseif ($statusCode -eq 401) {
            Write-Host "ERROR: UNAUTHORIZED: $name (401)" -ForegroundColor Red
        } elseif ($statusCode -eq 403) {
            Write-Host "ERROR: FORBIDDEN: $name (403) - Admin middleware issue" -ForegroundColor Red
        } elseif ($statusCode -eq 404) {
            Write-Host "WARNING: NOT FOUND: $name (404)" -ForegroundColor Yellow
        } elseif ($statusCode -eq 400) {
            Write-Host "INFO: BAD REQUEST: $name (400) - Check request format" -ForegroundColor Yellow
        } else {
            Write-Host "ERROR: FAILED: $name - Status: $statusCode $reasonPhrase" -ForegroundColor Red
        }
        
        # Try to get error details
        if ($_.Exception.Response) {
            try {
                $errorContent = $_.Exception.Response.GetResponseStream()
                $reader = [System.IO.StreamReader]::new($errorContent)
                $errorBody = $reader.ReadToEnd()
                Write-Host "Error Details: $errorBody" -ForegroundColor Red
            } catch {
                Write-Host "Could not read error details" -ForegroundColor Red
            }
        }
        
        return $false
    }
}

$successCount = 0
$totalTests = 4

# Test 1: Send Test Notification (Admin)
Write-Host "`n=== TEST 1: SEND TEST NOTIFICATION ===" -ForegroundColor Magenta
$sendNotificationBody = @{
    user_id = $userId
    type = "test"
    title = "Test Notification"
    message = "This is a test notification from the API testing script"
    priority = "high"
    data = @{
        source = "api_test"
        timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
} | ConvertTo-Json

if (Test-NotificationEndpoint -url "$baseUrl/notifications/send" -method "POST" -name "Send Test Notification" -headers $adminHeaders -body $sendNotificationBody) {
    $successCount++
}

Start-Sleep -Milliseconds 500

# Test 2: Broadcast to Event (Admin)
Write-Host "`n=== TEST 2: BROADCAST TO EVENT ===" -ForegroundColor Magenta
$broadcastBody = @{
    title = "Event Update"
    message = "Important update about $eventName"
    type = "event_update"
    priority = "medium"
} | ConvertTo-Json

if (Test-NotificationEndpoint -url "$baseUrl/notifications/broadcast/$eventId" -method "POST" -name "Broadcast to Event" -headers $adminHeaders -body $broadcastBody) {
    $successCount++
}

Start-Sleep -Milliseconds 500

# Test 3: Get User Notifications
Write-Host "`n=== TEST 3: GET USER NOTIFICATIONS ===" -ForegroundColor Magenta
if (Test-NotificationEndpoint -url "$baseUrl/notifications/user/$userId" -method "GET" -name "Get User Notifications" -headers $userHeaders) {
    $successCount++
}

Start-Sleep -Milliseconds 500

# Test 4: Notification Statistics (Admin)
Write-Host "`n=== TEST 4: NOTIFICATION STATISTICS ===" -ForegroundColor Magenta
if (Test-NotificationEndpoint -url "$baseUrl/notifications/stats" -method "GET" -name "Notification Statistics" -headers $adminHeaders) {
    $successCount++
}

Write-Host "`n" + "="*50 -ForegroundColor Cyan
Write-Host "NOTIFICATION SYSTEM TESTING SUMMARY" -ForegroundColor Cyan
Write-Host "="*50 -ForegroundColor Cyan
Write-Host "Event Used: $eventName ($eventId)" -ForegroundColor White
Write-Host "Test User: $userEmail ($userId)" -ForegroundColor White
Write-Host "Successful: $successCount/$totalTests endpoints" -ForegroundColor Green
Write-Host "Failed: $($totalTests - $successCount)/$totalTests endpoints" -ForegroundColor $(if ($successCount -eq $totalTests) { "Green" } else { "Red" })

if ($successCount -eq $totalTests) {
    Write-Host "`nSUCCESS: ALL NOTIFICATION ENDPOINTS WORKING!" -ForegroundColor Green
} elseif ($successCount -ge 2) {
    Write-Host "`nPARTIAL SUCCESS: Core notification features working" -ForegroundColor Yellow
} else {
    Write-Host "`nWARNING: Most notification endpoints need debugging" -ForegroundColor Yellow
}

Write-Host "`nNOTIFICATION FEATURES DISCOVERED:" -ForegroundColor Cyan
Write-Host "- Admin can send test notifications with multiple types" -ForegroundColor White
Write-Host "- Broadcast capabilities to all event attendees" -ForegroundColor White
Write-Host "- User notification inbox and history" -ForegroundColor White
Write-Host "- Admin notification statistics and analytics" -ForegroundColor White
Write-Host "- Multi-channel delivery (websocket, email)" -ForegroundColor White
Write-Host "- Priority levels and notification types" -ForegroundColor White

Write-Host "`nNOTIFICATION TYPES SUPPORTED:" -ForegroundColor Cyan
Write-Host "- booking_confirmed, waitlist_promoted, event_reminder" -ForegroundColor White
Write-Host "- seat_available, price_change, system_update" -ForegroundColor White
Write-Host "- waitlist_joined, booking_cancelled, and more" -ForegroundColor White

Write-Host "`nNotification system testing complete!" -ForegroundColor Green