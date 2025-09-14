# Test what's in our current database
$baseUrl = "https://evently-app-production.up.railway.app"

# Login as admin
$loginData = @{email="testadmin@evently.com"; password="TestAdmin123!"} | ConvertTo-Json
$admin = Invoke-RestMethod "$baseUrl/api/v1/auth/login" -Method POST -Body $loginData -ContentType "application/json"
$adminToken = $admin.data.token

# Test database status
Write-Host "=== CHECKING DATABASE STATUS ==="
$headers = @{"Authorization"="Bearer $adminToken"}

try {
    $dbStatus = Invoke-RestMethod "$baseUrl/api/v1/analytics/database-status" -Headers $headers
    Write-Host "Database Status:"
    $dbStatus | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Database check failed: $($_.Exception.Message)"
}

# Check events table structure by trying to get events
Write-Host "`n=== CHECKING EVENTS TABLE ==="
try {
    $events = Invoke-RestMethod "$baseUrl/api/v1/events"
    Write-Host "Events found: $($events.count)"
    if ($events.data.Count -gt 0) {
        Write-Host "Sample event structure:"
        $events.data[0] | ConvertTo-Json
    }
} catch {
    Write-Host "Events check failed: $($_.Exception.Message)"
}

# Try to create a minimal event
Write-Host "`n=== TESTING MINIMAL EVENT CREATION ==="
$minimalEvent = @{
    name = "Test Event"
    venue = "Test Venue" 
    event_date = "2025-12-01T20:00:00Z"
    total_capacity = 10
    price = 10.00
} | ConvertTo-Json

Write-Host "Request:"
$minimalEvent

$headers = @{"Authorization"="Bearer $adminToken"; "Content-Type"="application/json"}
try {
    $response = Invoke-WebRequest "$baseUrl/api/v1/events" -Method POST -Body $minimalEvent -Headers $headers
    Write-Host "SUCCESS!"
    $response.Content
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        Write-Host "Error response: $content"
    }
}