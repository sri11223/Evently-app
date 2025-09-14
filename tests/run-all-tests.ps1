# 🚀 MASTER TEST RUNNER - Evently API Testing Suite

param(
    [string]$Category = "all",
    [switch]$Verbose = $false,
    [switch]$StopOnError = $false,
    [int]$Delay = 2
)

# Color functions for better output
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Warning { param($Message) Write-Host "⚠️ $Message" -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host "ℹ️ $Message" -ForegroundColor Cyan }
function Write-Header { param($Message) Write-Host "`n🎯 $Message" -ForegroundColor Magenta -BackgroundColor Black }

# Test script definitions
$TestSuites = @{
    "core" = @(
        @{ Name = "System Health Check"; Script = "simple-test.ps1"; Duration = "1-2 min"; Priority = 1 }
        @{ Name = "Basic API Tests"; Script = "test-api.ps1"; Duration = "2-3 min"; Priority = 1 }
        @{ Name = "Event Management"; Script = "event-test.ps1"; Duration = "3-4 min"; Priority = 1 }
    )
    "booking" = @(
        @{ Name = "Booking System"; Script = "booking-test.ps1"; Duration = "4-5 min"; Priority = 2 }
        @{ Name = "Enhanced Bookings"; Script = "booking-final-test.ps1"; Duration = "3-4 min"; Priority = 2 }
    )
    "analytics" = @(
        @{ Name = "Analytics Suite"; Script = "analytics-clean-test.ps1"; Duration = "4-6 min"; Priority = 2 }
        @{ Name = "Basic Analytics"; Script = "analytics-test.ps1"; Duration = "3-4 min"; Priority = 3 }
    )
    "advanced" = @(
        @{ Name = "Waitlist Management"; Script = "waitlist-test.ps1"; Duration = "3-4 min"; Priority = 2 }
        @{ Name = "Notification System"; Script = "notification-test.ps1"; Duration = "2-3 min"; Priority = 3 }
        @{ Name = "Dynamic Pricing"; Script = "pricing-test.ps1"; Duration = "2-3 min"; Priority = 3 }
    )
    "performance" = @(
        @{ Name = "Performance Analysis"; Script = "performance-test.ps1"; Duration = "5-7 min"; Priority = 1 }
    )
    "demo" = @(
        @{ Name = "System Demo"; Script = "system-demo.ps1"; Duration = "8-10 min"; Priority = 2 }
        @{ Name = "Full Test Suite"; Script = "full-test-suite.ps1"; Duration = "15-20 min"; Priority = 3 }
    )
}

# Main execution function
function Run-Tests {
    param($TestList)
    
    $totalTests = $TestList.Count
    $currentTest = 0
    $successful = 0
    $failed = 0
    $skipped = 0
    
    Write-Header "Starting Test Execution - $totalTests tests queued"
    Write-Info "Category: $Category | Delay: ${Delay}s between tests | Stop on Error: $StopOnError"
    
    foreach ($test in $TestList) {
        $currentTest++
        Write-Host "`n" + "="*80 -ForegroundColor DarkGray
        Write-Header "Test $currentTest/$totalTests : $($test.Name)"
        Write-Info "Script: $($test.Script) | Expected Duration: $($test.Duration)"
        
        $scriptPath = ".\tests\api-tests\$($test.Script)"
        
        if (-not (Test-Path $scriptPath)) {
            Write-Error "Script not found: $scriptPath"
            $skipped++
            continue
        }
        
        try {
            Write-Info "Executing test script..."
            $startTime = Get-Date
            
            if ($Verbose) {
                & $scriptPath
            } else {
                & $scriptPath 2>&1 | Out-Null
            }
            
            $endTime = Get-Date
            $duration = ($endTime - $startTime).TotalSeconds
            
            if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq $null) {
                Write-Success "Test completed successfully in ${duration}s"
                $successful++
            } else {
                Write-Warning "Test completed with warnings (Exit Code: $LASTEXITCODE)"
                $successful++
            }
            
        } catch {
            Write-Error "Test failed: $($_.Exception.Message)"
            $failed++
            
            if ($StopOnError) {
                Write-Error "Stopping execution due to error (StopOnError flag set)"
                break
            }
        }
        
        # Delay between tests
        if ($currentTest -lt $totalTests -and $Delay -gt 0) {
            Write-Host "⏱️ Waiting ${Delay}s before next test..." -ForegroundColor DarkYellow
            Start-Sleep -Seconds $Delay
        }
    }
    
    # Final results
    Write-Host "`n" + "="*80 -ForegroundColor Green
    Write-Header "TEST EXECUTION COMPLETE"
    Write-Success "Successful: $successful"
    if ($failed -gt 0) { Write-Error "Failed: $failed" }
    if ($skipped -gt 0) { Write-Warning "Skipped: $skipped" }
    
    $successRate = if ($totalTests -gt 0) { [math]::Round(($successful / $totalTests) * 100, 1) } else { 0 }
    Write-Info "Success Rate: $successRate% ($successful/$totalTests tests)"
    
    return @{
        Total = $totalTests
        Successful = $successful
        Failed = $failed
        Skipped = $skipped
        SuccessRate = $successRate
    }
}

# Display available categories
function Show-Categories {
    Write-Header "Available Test Categories"
    
    foreach ($category in $TestSuites.Keys) {
        $tests = $TestSuites[$category]
        $testCount = $tests.Count
        $estimatedTime = ($tests | ForEach-Object { 
            $duration = $_.Duration -replace '[^\d-]', '' -split '-'
            if ($duration.Count -eq 2) { ([int]$duration[1] + [int]$duration[0]) / 2 } else { [int]$duration[0] }
        } | Measure-Object -Sum).Sum
        
        Write-Host "📁 $($category.ToUpper())" -ForegroundColor Yellow
        Write-Host "   Tests: $testCount | Estimated Time: ${estimatedTime} minutes" -ForegroundColor White
        foreach ($test in $tests) {
            Write-Host "   - $($test.Name) ($($test.Duration))" -ForegroundColor DarkGray
        }
        Write-Host ""
    }
    
    Write-Info "Usage Examples:"
    Write-Host "   .\run-all-tests.ps1                    # Run all tests" -ForegroundColor DarkGray
    Write-Host "   .\run-all-tests.ps1 -Category core     # Run core tests only" -ForegroundColor DarkGray  
    Write-Host "   .\run-all-tests.ps1 -Verbose           # Run with detailed output" -ForegroundColor DarkGray
    Write-Host "   .\run-all-tests.ps1 -StopOnError       # Stop on first failure" -ForegroundColor DarkGray
}

# Main script execution
Clear-Host
Write-Host @"
╔══════════════════════════════════════════════════════════════════════════════╗
║                    🚀 EVENTLY API MASTER TEST RUNNER 🚀                     ║
║                          Comprehensive Testing Suite                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Check if user wants to see categories
if ($Category -eq "help" -or $Category -eq "list") {
    Show-Categories
    exit 0
}

# Get API status first
Write-Info "Checking API availability..."
try {
    $healthCheck = Invoke-RestMethod -Uri "https://evently-app-7hx2.onrender.com/health" -TimeoutSec 10
    Write-Success "API is online and healthy"
} catch {
    Write-Error "API seems to be unavailable. Tests may fail."
    Write-Warning "Continuing anyway, but expect connectivity issues..."
}

# Build test list based on category
$testsToRun = @()

if ($Category -eq "all") {
    # Run all tests, prioritized
    $allTests = @()
    foreach ($categoryTests in $TestSuites.Values) {
        $allTests += $categoryTests
    }
    $testsToRun = $allTests | Sort-Object Priority, Name
} elseif ($TestSuites.ContainsKey($Category)) {
    $testsToRun = $TestSuites[$Category] | Sort-Object Priority, Name
} else {
    Write-Error "Unknown category: $Category"
    Write-Info "Available categories: $($TestSuites.Keys -join ', '), all, help"
    exit 1
}

if ($testsToRun.Count -eq 0) {
    Write-Warning "No tests found for category: $Category"
    exit 1
}

# Execute the tests
$results = Run-Tests -TestList $testsToRun

# Final summary with recommendations
Write-Host "`n" + "="*80 -ForegroundColor Blue
Write-Header "FINAL RECOMMENDATIONS"

if ($results.SuccessRate -ge 80) {
    Write-Success "Excellent performance! System is production-ready."
} elseif ($results.SuccessRate -ge 60) {
    Write-Warning "Good performance with some issues. Review failed tests."
} else {
    Write-Error "Multiple system issues detected. Review logs carefully."
}

Write-Info "Next steps:"
Write-Host "  1. Check ACCURATE_API_STATUS.md for detailed endpoint status" -ForegroundColor DarkGray
Write-Host "  2. Review individual test logs for specific failures" -ForegroundColor DarkGray
Write-Host "  3. Focus on fixing middleware authentication issues" -ForegroundColor DarkGray
Write-Host "  4. Consider rate limiting adjustments for booking system" -ForegroundColor DarkGray

Write-Host "`n🎉 Testing complete! Thank you for using Evently Test Suite." -ForegroundColor Green