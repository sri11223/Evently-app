# Analytics Endpoints Test Script
# Tests all available analytics endpoints with admin authentication
Write-Host "ANALYTICS ENDPOINTS TESTING SCRIPT" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# API Configuration
$baseUrl = "https://evently-app-7hx2.onrender.com/api/v1"
$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "`nStep 1: Admin Authentication" -ForegroundColor Yellow

# Admin Login
$adminLoginBody = @{
    email = "admin2@evently.com"
    password = "admin123"
} | ConvertTo-Json

try {
    Write-Host "Logging in as admin..." -ForegroundColor White
    $adminResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $adminLoginBody -Headers $headers
    $adminToken = $adminResponse.token
    Write-Host "Admin login successful" -ForegroundColor Green
    Write-Host "Admin Token: $($adminToken.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "Admin login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Add admin token to headers
$adminHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $adminToken"
}

Write-Host "`nStep 2: Testing Analytics Endpoints" -ForegroundColor Yellow

# Test function
function Test-Endpoint {
    param($url, $name, $headers)
    try {
        Write-Host "`n🧪 Testing: $name" -ForegroundColor Cyan
        Write-Host "URL: $url" -ForegroundColor Gray
        
        $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers
        Write-Host "✅ SUCCESS: $name" -ForegroundColor Green
        
        # Show key data from response
        if ($response.success) {
            Write-Host "Response Status: SUCCESS" -ForegroundColor Green
            if ($response.data) {
                Write-Host "Data Keys: $(($response.data | Get-Member -MemberType NoteProperty).Name -join ', ')" -ForegroundColor White
            }
        }
        
        return $true
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $reasonPhrase = $_.Exception.Response.ReasonPhrase
        
        if ($statusCode -eq 429) {
            Write-Host "⚠️  RATE LIMITED: $name (429 Too Many Requests)" -ForegroundColor Yellow
        } elseif ($statusCode -eq 401) {
            Write-Host "🔒 UNAUTHORIZED: $name (401)" -ForegroundColor Red
        } elseif ($statusCode -eq 404) {
            Write-Host "🚫 NOT FOUND: $name (404)" -ForegroundColor Red
        } else {
            Write-Host "❌ FAILED: $name - Status: $statusCode $reasonPhrase" -ForegroundColor Red
        }
        
        return $false
    }
}

# Get an event ID first for event-specific analytics
Write-Host "`n🎪 Getting Event ID for event-specific analytics..." -ForegroundColor Cyan
try {
    $eventsResponse = Invoke-RestMethod -Uri "$baseUrl/events" -Method GET
    if ($eventsResponse.data -and $eventsResponse.data.Count -gt 0) {
        $eventId = $eventsResponse.data[0].id
        Write-Host "✅ Found Event ID: $eventId" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No events found for event-specific analytics test" -ForegroundColor Yellow
        $eventId = "1" # Fallback for testing
    }
} catch {
    Write-Host "⚠️  Could not get events, using fallback ID" -ForegroundColor Yellow
    $eventId = "1"
}

# Analytics endpoints to test
$analyticsEndpoints = @(
    @{ Name = "Overall Analytics"; Url = "$baseUrl/analytics" },
    @{ Name = "Event-Specific Analytics"; Url = "$baseUrl/analytics/events/$eventId" },
    @{ Name = "Database Status"; Url = "$baseUrl/analytics/database-status" },
    @{ Name = "Rate Limit Stats"; Url = "$baseUrl/analytics/rate-limits" },
    @{ Name = "Advanced Dashboard"; Url = "$baseUrl/analytics/dashboard" },
    @{ Name = "Real-time Metrics"; Url = "$baseUrl/analytics/realtime" },
    @{ Name = "Conversion Funnel"; Url = "$baseUrl/analytics/funnel" },
    @{ Name = "Predictive Analytics"; Url = "$baseUrl/analytics/predictive" }
)

$successCount = 0
$totalCount = $analyticsEndpoints.Count

foreach ($endpoint in $analyticsEndpoints) {
    if (Test-Endpoint -url $endpoint.Url -name $endpoint.Name -headers $adminHeaders) {
        $successCount++
    }
    Start-Sleep -Milliseconds 500 # Brief pause to avoid rate limiting
}

Write-Host "`n📈 ANALYTICS TESTING SUMMARY" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host "✅ Successful: $successCount/$totalCount endpoints" -ForegroundColor Green
Write-Host "❌ Failed: $($totalCount - $successCount)/$totalCount endpoints" -ForegroundColor $(if ($successCount -eq $totalCount) { "Green" } else { "Red" })

if ($successCount -eq $totalCount) {
    Write-Host "`n🎉 ALL ANALYTICS ENDPOINTS WORKING!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some analytics endpoints may need debugging" -ForegroundColor Yellow
}

Write-Host "`n🎯 ANALYTICS FEATURES DISCOVERED:" -ForegroundColor Cyan
Write-Host "• Overall system analytics (events, bookings, revenue)" -ForegroundColor White
Write-Host "• Event-specific performance metrics" -ForegroundColor White
Write-Host "• Database health monitoring" -ForegroundColor White
Write-Host "• Rate limiting statistics" -ForegroundColor White
Write-Host "• Advanced dashboard with KPIs" -ForegroundColor White
Write-Host "• Real-time business metrics" -ForegroundColor White
Write-Host "• Conversion funnel analysis" -ForegroundColor White
Write-Host "• Predictive analytics capabilities" -ForegroundColor White

Write-Host "`n🏁 Analytics testing complete!" -ForegroundColor Green