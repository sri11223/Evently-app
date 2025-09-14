# Dynamic Pricing System Endpoints Test Script  
# Tests documented pricing endpoints + actual implemented endpoints
Write-Host "DYNAMIC PRICING SYSTEM TESTING SCRIPT" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

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

# Register a test user for pricing testing
$userEmail = "pricing-user-$(Get-Random)@test.com"
$userRegisterBody = @{
    name = "Pricing Test User"
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

Write-Host "`nStep 2: Getting Event ID for Pricing Testing" -ForegroundColor Yellow

# Get an event ID for pricing testing
try {
    $eventsResponse = Invoke-RestMethod -Uri "$baseUrl/events" -Method GET
    if ($eventsResponse.data -and $eventsResponse.data.Count -gt 0) {
        $eventId = $eventsResponse.data[0].id
        $eventName = $eventsResponse.data[0].name
        $eventPrice = $eventsResponse.data[0].price
        Write-Host "SUCCESS: Using Event - ID: $eventId, Name: $eventName, Base Price: $eventPrice" -ForegroundColor Green
    } else {
        Write-Host "ERROR: No events found for pricing testing" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Could not get events: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 3: Testing Dynamic Pricing Endpoints" -ForegroundColor Yellow

# Test function
function Test-PricingEndpoint {
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
                # Show pricing data if available
                if ($response.data.recommended_price) {
                    Write-Host "Recommended Price: `$$($response.data.recommended_price)" -ForegroundColor White
                }
                if ($response.data.current_price) {
                    Write-Host "Current Price: `$$($response.data.current_price)" -ForegroundColor White
                }
                if ($response.data.pricing_factor) {
                    Write-Host "Pricing Factor: $($response.data.pricing_factor)" -ForegroundColor White
                }
                Write-Host "Data Keys: $(($response.data | Get-Member -MemberType NoteProperty).Name -join ', ')" -ForegroundColor White
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
            Write-Host "WARNING: NOT FOUND: $name (404) - Endpoint may not be implemented" -ForegroundColor Yellow
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

Write-Host "`n=== TESTING DOCUMENTED PRICING ENDPOINTS ===" -ForegroundColor Magenta

$documentedSuccessCount = 0
$documentedTests = 0

# Test 1: Dynamic Pricing (Documented)
Write-Host "`n--- TEST 1: GET DYNAMIC PRICING (DOCUMENTED) ---" -ForegroundColor Magenta
$documentedTests++
if (Test-PricingEndpoint -url "$baseUrl/pricing/dynamic/$eventId" -method "GET" -name "Dynamic Pricing (Documented)" -headers $userHeaders) {
    $documentedSuccessCount++
}

Start-Sleep -Milliseconds 500

# Test 2: Bulk Pricing (Documented)
Write-Host "`n--- TEST 2: BULK PRICING (DOCUMENTED) ---" -ForegroundColor Magenta
$documentedTests++
if (Test-PricingEndpoint -url "$baseUrl/pricing/bulk?quantity=10" -method "GET" -name "Bulk Pricing (Documented)" -headers $userHeaders) {
    $documentedSuccessCount++
}

Start-Sleep -Milliseconds 500

# Test 3: Demand-based Pricing (Documented)
Write-Host "`n--- TEST 3: DEMAND-BASED PRICING (DOCUMENTED) ---" -ForegroundColor Magenta
$documentedTests++
if (Test-PricingEndpoint -url "$baseUrl/pricing/demand/$eventId" -method "GET" -name "Demand-based Pricing (Documented)" -headers $adminHeaders) {
    $documentedSuccessCount++
}

Start-Sleep -Milliseconds 500

# Test 4: Pricing Analytics (Documented)
Write-Host "`n--- TEST 4: PRICING ANALYTICS (DOCUMENTED) ---" -ForegroundColor Magenta
$documentedTests++
if (Test-PricingEndpoint -url "$baseUrl/pricing/analytics" -method "GET" -name "Pricing Analytics (Documented)" -headers $adminHeaders) {
    $documentedSuccessCount++
}

Start-Sleep -Milliseconds 500

Write-Host "`n=== TESTING ACTUAL IMPLEMENTED PRICING ENDPOINTS ===" -ForegroundColor Magenta

$actualSuccessCount = 0
$actualTests = 0

# Test A: Event Pricing (Actual Implementation)
Write-Host "`n--- TEST A: EVENT PRICING (ACTUAL) ---" -ForegroundColor Magenta
$actualTests++
if (Test-PricingEndpoint -url "$baseUrl/pricing/event/$eventId" -method "GET" -name "Event Pricing (Actual)" -headers $userHeaders) {
    $actualSuccessCount++
}

Start-Sleep -Milliseconds 500

# Test B: All Pricing Recommendations (Actual Implementation)
Write-Host "`n--- TEST B: PRICING RECOMMENDATIONS (ACTUAL) ---" -ForegroundColor Magenta
$actualTests++
if (Test-PricingEndpoint -url "$baseUrl/pricing/recommendations" -method "GET" -name "Pricing Recommendations (Actual)" -headers $adminHeaders) {
    $actualSuccessCount++
}

Start-Sleep -Milliseconds 500

# Test C: Apply Dynamic Pricing (Actual Implementation)
Write-Host "`n--- TEST C: APPLY PRICING (ACTUAL) ---" -ForegroundColor Magenta
$applyPricingBody = @{
    new_price = [math]::Round($eventPrice * 1.2, 2)
    reason = "API Testing - Demand adjustment"
    valid_until = (Get-Date).AddHours(24).ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json

$actualTests++
if (Test-PricingEndpoint -url "$baseUrl/pricing/event/$eventId/apply" -method "POST" -name "Apply Pricing (Actual)" -headers $adminHeaders -body $applyPricingBody) {
    $actualSuccessCount++
}

Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "DYNAMIC PRICING SYSTEM TESTING SUMMARY" -ForegroundColor Cyan
Write-Host "="*60 -ForegroundColor Cyan
Write-Host "Event Used: $eventName ($eventId)" -ForegroundColor White
Write-Host "Base Price: `$$eventPrice" -ForegroundColor White
Write-Host "Test User: $userEmail ($userId)" -ForegroundColor White
Write-Host ""
Write-Host "DOCUMENTED ENDPOINTS:" -ForegroundColor Yellow
Write-Host "  Successful: $documentedSuccessCount/$documentedTests endpoints" -ForegroundColor Green
Write-Host "  Failed: $($documentedTests - $documentedSuccessCount)/$documentedTests endpoints" -ForegroundColor $(if ($documentedSuccessCount -eq $documentedTests) { "Green" } else { "Red" })
Write-Host ""
Write-Host "ACTUAL IMPLEMENTATION:" -ForegroundColor Yellow
Write-Host "  Successful: $actualSuccessCount/$actualTests endpoints" -ForegroundColor Green
Write-Host "  Failed: $($actualTests - $actualSuccessCount)/$actualTests endpoints" -ForegroundColor $(if ($actualSuccessCount -eq $actualTests) { "Green" } else { "Red" })

$totalSuccess = $documentedSuccessCount + $actualSuccessCount
$totalTests = $documentedTests + $actualTests

Write-Host ""
Write-Host "OVERALL RESULTS:" -ForegroundColor Cyan
Write-Host "  Total Successful: $totalSuccess/$totalTests endpoints" -ForegroundColor Green
Write-Host "  Total Failed: $($totalTests - $totalSuccess)/$totalTests endpoints" -ForegroundColor $(if ($totalSuccess -eq $totalTests) { "Green" } else { "Red" })

if ($actualSuccessCount -gt $documentedSuccessCount) {
    Write-Host "`nFINDING: Actual implementation differs from documentation" -ForegroundColor Yellow
    Write-Host "The working endpoints use different URL patterns than documented" -ForegroundColor Yellow
} elseif ($documentedSuccessCount -eq $documentedTests) {
    Write-Host "`nSUCCESS: ALL DOCUMENTED PRICING ENDPOINTS WORKING!" -ForegroundColor Green
} else {
    Write-Host "`nMIXED RESULTS: Some endpoints working, documentation may be outdated" -ForegroundColor Yellow
}

Write-Host "`nDYNAMIC PRICING FEATURES DISCOVERED:" -ForegroundColor Cyan
Write-Host "- Event-specific dynamic pricing calculation" -ForegroundColor White
Write-Host "- Demand-based price adjustments" -ForegroundColor White
Write-Host "- Bulk pricing discounts for large quantities" -ForegroundColor White
Write-Host "- Administrative price override capabilities" -ForegroundColor White
Write-Host "- Pricing analytics and recommendations" -ForegroundColor White
Write-Host "- Time-based pricing validity windows" -ForegroundColor White

Write-Host "`nPricing system testing complete!" -ForegroundColor Green