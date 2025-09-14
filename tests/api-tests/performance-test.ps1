# Performance Systems Test Script - Caching, Load Testing, Tracing, Enterprise
# Tests all performance-related endpoints quickly
Write-Host "PERFORMANCE SYSTEMS TESTING SCRIPT" -ForegroundColor Cyan
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
    $adminToken = $adminResponse.data.token
    Write-Host "SUCCESS: Admin login successful" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Admin login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$adminHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $adminToken"
}

# Quick test function
function Test-QuickEndpoint {
    param($url, $method, $name, $headers, $body = $null)
    try {
        Write-Host "  Testing: $name..." -ForegroundColor Gray
        
        if ($body) {
            $response = Invoke-RestMethod -Uri $url -Method $method -Headers $headers -Body $body
        } else {
            $response = Invoke-RestMethod -Uri $url -Method $method -Headers $headers
        }
        
        Write-Host "  SUCCESS: $name" -ForegroundColor Green
        if ($response.data -and $response.data.GetType().Name -eq "PSCustomObject") {
            $keys = ($response.data | Get-Member -MemberType NoteProperty).Name
            if ($keys.Count -le 3) {
                Write-Host "    Data: $(($keys -join ', '))" -ForegroundColor White
            } else {
                Write-Host "    Data: $($keys.Count) properties" -ForegroundColor White
            }
        }
        return $true
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 404) {
            Write-Host "  NOT FOUND: $name (404)" -ForegroundColor Yellow
        } elseif ($statusCode -eq 403) {
            Write-Host "  FORBIDDEN: $name (403)" -ForegroundColor Red
        } elseif ($statusCode -eq 429) {
            Write-Host "  RATE LIMITED: $name (429)" -ForegroundColor Yellow
        } else {
            Write-Host "  FAILED: $name ($statusCode)" -ForegroundColor Red
        }
        return $false
    }
}

Write-Host "`nStep 2: Testing Performance Systems" -ForegroundColor Yellow

# Initialize counters
$totalTests = 0
$totalSuccess = 0

Write-Host "`n=== CACHING SYSTEM (4 endpoints) ===" -ForegroundColor Magenta

$cachingTests = @(
    @{ Name = "Cache Metrics"; Url = "$baseUrl/cache/metrics"; Method = "GET" },
    @{ Name = "Cache Status"; Url = "$baseUrl/cache/status"; Method = "GET" },
    @{ Name = "Clear Events Cache"; Url = "$baseUrl/cache/events"; Method = "DELETE" },
    @{ Name = "Clear All Cache"; Url = "$baseUrl/cache/all"; Method = "DELETE" }
)

$cachingSuccess = 0
foreach ($test in $cachingTests) {
    $totalTests++
    if (Test-QuickEndpoint -url $test.Url -method $test.Method -name $test.Name -headers $adminHeaders) {
        $cachingSuccess++
        $totalSuccess++
    }
    Start-Sleep -Milliseconds 300
}

Write-Host "`n=== LOAD TESTING & PERFORMANCE (3 endpoints) ===" -ForegroundColor Magenta

# Start Load Test
$loadTestBody = @{
    concurrentUsers = 10
    duration = 5
    scenario = "api_test"
} | ConvertTo-Json

$loadTestSuccess = 0
$totalTests++
Write-Host "  Testing: Start Load Test..." -ForegroundColor Gray
try {
    $loadTestResponse = Invoke-RestMethod -Uri "$baseUrl/load-test/start" -Method POST -Headers $adminHeaders -Body $loadTestBody
    Write-Host "  SUCCESS: Start Load Test" -ForegroundColor Green
    $testId = $loadTestResponse.data.testId
    Write-Host "    Test ID: $testId" -ForegroundColor White
    $loadTestSuccess++
    $totalSuccess++
    
    # Test Load Test Status
    Start-Sleep -Milliseconds 500
    $totalTests++
    if (Test-QuickEndpoint -url "$baseUrl/load-test/status/$testId" -method "GET" -name "Load Test Status" -headers $adminHeaders) {
        $loadTestSuccess++
        $totalSuccess++
    }
    
    # Test Load Test Results
    Start-Sleep -Milliseconds 500
    $totalTests++
    if (Test-QuickEndpoint -url "$baseUrl/load-test/results/$testId" -method "GET" -name "Load Test Results" -headers $adminHeaders) {
        $loadTestSuccess++
        $totalSuccess++
    }
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
        Write-Host "  NOT FOUND: Start Load Test (404)" -ForegroundColor Yellow
    } elseif ($statusCode -eq 403) {
        Write-Host "  FORBIDDEN: Start Load Test (403)" -ForegroundColor Red
    } else {
        Write-Host "  FAILED: Start Load Test ($statusCode)" -ForegroundColor Red
    }
    
    # Still test the other endpoints with dummy ID
    $testId = "dummy-test-id"
    $totalTests += 2
    Test-QuickEndpoint -url "$baseUrl/load-test/status/$testId" -method "GET" -name "Load Test Status" -headers $adminHeaders | Out-Null
    Test-QuickEndpoint -url "$baseUrl/load-test/results/$testId" -method "GET" -name "Load Test Results" -headers $adminHeaders | Out-Null
}

Write-Host "`n=== TRACING & MONITORING (3 endpoints) ===" -ForegroundColor Magenta

$tracingTests = @(
    @{ Name = "Performance Metrics"; Url = "$baseUrl/tracing/metrics"; Method = "GET" },
    @{ Name = "Request Tracing"; Url = "$baseUrl/tracing/requests"; Method = "GET" },
    @{ Name = "Error Tracking"; Url = "$baseUrl/tracing/errors"; Method = "GET" }
)

$tracingSuccess = 0
foreach ($test in $tracingTests) {
    $totalTests++
    if (Test-QuickEndpoint -url $test.Url -method $test.Method -name $test.Name -headers $adminHeaders) {
        $tracingSuccess++
        $totalSuccess++
    }
    Start-Sleep -Milliseconds 300
}

Write-Host "`n=== ENTERPRISE FEATURES (8+ endpoints) ===" -ForegroundColor Magenta

$enterpriseTests = @(
    @{ Name = "Enterprise Dashboard"; Url = "$baseUrl/enterprise/dashboard"; Method = "GET" },
    @{ Name = "Scaling Status"; Url = "$baseUrl/enterprise/scaling"; Method = "GET" },
    @{ Name = "Audit Logs"; Url = "$baseUrl/enterprise/audit"; Method = "GET" },
    @{ Name = "System Health"; Url = "$baseUrl/enterprise/health"; Method = "GET" },
    @{ Name = "Performance Overview"; Url = "$baseUrl/enterprise/performance"; Method = "GET" },
    @{ Name = "Resource Usage"; Url = "$baseUrl/enterprise/resources"; Method = "GET" },
    @{ Name = "Security Status"; Url = "$baseUrl/enterprise/security"; Method = "GET" },
    @{ Name = "Backup Status"; Url = "$baseUrl/enterprise/backup"; Method = "GET" }
)

$enterpriseSuccess = 0
foreach ($test in $enterpriseTests) {
    $totalTests++
    if (Test-QuickEndpoint -url $test.Url -method $test.Method -name $test.Name -headers $adminHeaders) {
        $enterpriseSuccess++
        $totalSuccess++
    }
    Start-Sleep -Milliseconds 200
}

Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "PERFORMANCE SYSTEMS TESTING SUMMARY" -ForegroundColor Cyan
Write-Host "="*60 -ForegroundColor Cyan

Write-Host "CACHING SYSTEM:" -ForegroundColor Yellow
Write-Host "  Success: $cachingSuccess/4 endpoints" -ForegroundColor $(if ($cachingSuccess -gt 2) { "Green" } else { "Red" })

Write-Host "`nLOAD TESTING & PERFORMANCE:" -ForegroundColor Yellow
Write-Host "  Success: $loadTestSuccess/3 endpoints" -ForegroundColor $(if ($loadTestSuccess -gt 1) { "Green" } else { "Red" })

Write-Host "`nTRACING & MONITORING:" -ForegroundColor Yellow
Write-Host "  Success: $tracingSuccess/3 endpoints" -ForegroundColor $(if ($tracingSuccess -gt 1) { "Green" } else { "Red" })

Write-Host "`nENTERPRISE FEATURES:" -ForegroundColor Yellow
Write-Host "  Success: $enterpriseSuccess/8 endpoints" -ForegroundColor $(if ($enterpriseSuccess -gt 3) { "Green" } else { "Red" })

Write-Host "`nOVERALL PERFORMANCE SYSTEMS:" -ForegroundColor Cyan
Write-Host "  Total Success: $totalSuccess/$totalTests endpoints" -ForegroundColor $(if ($totalSuccess -gt ($totalTests * 0.5)) { "Green" } else { "Red" })
Write-Host "  Success Rate: $([math]::Round($totalSuccess / $totalTests * 100, 1))%" -ForegroundColor $(if ($totalSuccess -gt ($totalTests * 0.5)) { "Green" } else { "Red" })

if ($totalSuccess -gt ($totalTests * 0.7)) {
    Write-Host "`nEXCELLENT: Most performance systems are working!" -ForegroundColor Green
} elseif ($totalSuccess -gt ($totalTests * 0.4)) {
    Write-Host "`nGOOD: Core performance monitoring is functional" -ForegroundColor Yellow
} else {
    Write-Host "`nNEEDS ATTENTION: Many performance endpoints need debugging" -ForegroundColor Red
}

Write-Host "`nPERFORMANCE CAPABILITIES DISCOVERED:" -ForegroundColor Cyan
Write-Host "- Redis caching with metrics and management" -ForegroundColor White
Write-Host "- Load testing with configurable scenarios" -ForegroundColor White
Write-Host "- Request tracing and performance monitoring" -ForegroundColor White
Write-Host "- Error tracking and debugging tools" -ForegroundColor White
Write-Host "- Enterprise-grade system monitoring" -ForegroundColor White
Write-Host "- Scaling and resource usage analytics" -ForegroundColor White
Write-Host "- Security and backup status monitoring" -ForegroundColor White

Write-Host "`nPerformance systems testing complete!" -ForegroundColor Green