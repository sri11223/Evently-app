# Raw API Testing - No Filtering
$baseUrl = "https://evently-app-production.up.railway.app"

# Admin Login
$loginData = @{email="testadmin@evently.com"; password="TestAdmin123!"} | ConvertTo-Json
$admin = Invoke-RestMethod "$baseUrl/api/v1/auth/login" -Method POST -Body $loginData -ContentType "application/json"
$adminToken = $admin.data.token

# Test Event Creation - RAW RESPONSE
Write-Host "=== TESTING EVENT CREATION ==="
$headers = @{"Authorization"="Bearer $adminToken"; "Content-Type"="application/json"}
$newEvent = @{
    name="Raw Test Event"
    description="Testing raw response"  
    venue="Test Venue"
    event_date="2025-12-01T20:00:00Z"
    total_capacity=50
    price=25.00
} | ConvertTo-Json

Write-Host "Request Body:"
$newEvent

Write-Host "Headers:"
$headers

try {
    Write-Host "Making POST request..."
    $response = Invoke-WebRequest "$baseUrl/api/v1/events" -Method POST -Body $newEvent -Headers $headers
    Write-Host "SUCCESS - Status: $($response.StatusCode)"
    Write-Host "Raw Response:"
    $response.Content
} catch {
    Write-Host "ERROR occurred"
    Write-Host "Exception: $($_.Exception.Message)"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errorContent = $reader.ReadToEnd()
        Write-Host "Raw Error Response:"
        $errorContent
    }
}