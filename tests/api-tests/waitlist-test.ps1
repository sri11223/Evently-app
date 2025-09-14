# Waitlist Management Endpoints Test Script  
# Tests all 5 waitlist management endpoints with proper authentication
Write-Host "WAITLIST MANAGEMENT TESTING SCRIPT" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# API Configuration
$baseUrl = "https://evently-app-7hx2.onrender.com/api/v1"
$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "`nStep 1: Authentication Setup" -ForegroundColor Yellow

# Admin Login
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

# Register a test user for waitlist operations
$userEmail = "waitlist-user-$(Get-Random)@test.com"
$userRegisterBody = @{
    name = "Waitlist Test User"
    email = $userEmail
    password = "waitlist123"
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

Write-Host "`nStep 2: Getting Event for Waitlist Testing" -ForegroundColor Yellow

# Get an event ID for waitlist testing
try {
    $eventsResponse = Invoke-RestMethod -Uri "$baseUrl/events" -Method GET
    if ($eventsResponse.data -and $eventsResponse.data.Count -gt 0) {
        $eventId = $eventsResponse.data[0].id
        $eventName = $eventsResponse.data[0].name
        Write-Host "SUCCESS: Using Event - ID: $eventId, Name: $eventName" -ForegroundColor Green
    } else {
        Write-Host "ERROR: No events found for waitlist testing" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Could not get events: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 3: Testing Waitlist Endpoints" -ForegroundColor Yellow

# Test function
function Test-WaitlistEndpoint {
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
        } elseif ($statusCode -eq 404) {
            Write-Host "WARNING: NOT FOUND: $name (404) - Expected for some tests" -ForegroundColor Yellow
        } elseif ($statusCode -eq 409) {
            Write-Host "INFO: CONFLICT: $name (409) - User might already be in waitlist" -ForegroundColor Yellow
        } else {
            Write-Host "ERROR: FAILED: $name - Status: $statusCode $reasonPhrase" -ForegroundColor Red
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
        }
        
        return $false
    }
}

$successCount = 0
$totalTests = 5

# Test 1: Join Waitlist
Write-Host "`n=== TEST 1: JOIN WAITLIST ===" -ForegroundColor Magenta
$joinBody = @{
    user_id = $userId
    priority = "standard"
} | ConvertTo-Json

if (Test-WaitlistEndpoint -url "$baseUrl/waitlist/$eventId/join" -method "POST" -name "Join Waitlist" -headers $userHeaders -body $joinBody) {
    $successCount++
}

Start-Sleep -Milliseconds 500

# Test 2: Check Waitlist Position
Write-Host "`n=== TEST 2: CHECK WAITLIST POSITION ===" -ForegroundColor Magenta
if (Test-WaitlistEndpoint -url "$baseUrl/waitlist/$eventId/user/$userId" -method "GET" -name "Check Waitlist Position" -headers $userHeaders) {
    $successCount++
}

Start-Sleep -Milliseconds 500

# Test 3: Waitlist Statistics (Admin)
Write-Host "`n=== TEST 3: WAITLIST STATISTICS ===" -ForegroundColor Magenta
if (Test-WaitlistEndpoint -url "$baseUrl/waitlist/$eventId/stats" -method "GET" -name "Waitlist Statistics" -headers $adminHeaders) {
    $successCount++
}

Start-Sleep -Milliseconds 500

# Test 4: Process Waitlist (Admin)
Write-Host "`n=== TEST 4: PROCESS WAITLIST ===" -ForegroundColor Magenta
$processBody = @{
    available_spots = 1
} | ConvertTo-Json

if (Test-WaitlistEndpoint -url "$baseUrl/waitlist/$eventId/process" -method "POST" -name "Process Waitlist" -headers $adminHeaders -body $processBody) {
    $successCount++
}

Start-Sleep -Milliseconds 500

# Test 5: Leave Waitlist
Write-Host "`n=== TEST 5: LEAVE WAITLIST ===" -ForegroundColor Magenta
if (Test-WaitlistEndpoint -url "$baseUrl/waitlist/$eventId/user/$userId" -method "DELETE" -name "Leave Waitlist" -headers $userHeaders) {
    $successCount++
}

Write-Host "`n" + "="*50 -ForegroundColor Cyan
Write-Host "WAITLIST MANAGEMENT TESTING SUMMARY" -ForegroundColor Cyan
Write-Host "="*50 -ForegroundColor Cyan
Write-Host "Event Used: $eventName ($eventId)" -ForegroundColor White
Write-Host "Test User: $userEmail ($userId)" -ForegroundColor White
Write-Host "Successful: $successCount/$totalTests endpoints" -ForegroundColor Green
Write-Host "Failed: $($totalTests - $successCount)/$totalTests endpoints" -ForegroundColor $(if ($successCount -eq $totalTests) { "Green" } else { "Red" })

if ($successCount -eq $totalTests) {
    Write-Host "`nSUCCESS: ALL WAITLIST ENDPOINTS WORKING!" -ForegroundColor Green
} else {
    Write-Host "`nWARNING: Some waitlist endpoints may need debugging" -ForegroundColor Yellow
}

Write-Host "`nWAITLIST FEATURES DISCOVERED:" -ForegroundColor Cyan
Write-Host "- Users can join event waitlists with priority levels" -ForegroundColor White
Write-Host "- Position tracking in waitlist queue" -ForegroundColor White
Write-Host "- Admin statistics and waitlist management" -ForegroundColor White
Write-Host "- Automated waitlist processing when spots available" -ForegroundColor White
Write-Host "- Users can leave waitlist voluntarily" -ForegroundColor White

Write-Host "`nWaitlist testing complete!" -ForegroundColor Green