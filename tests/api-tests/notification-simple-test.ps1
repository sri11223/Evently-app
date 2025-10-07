# Simple Notification Test with Provided Tokens
$baseUrl = "https://evently-app-7hx2.onrender.com/api/v1"
$userToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NGEyM2M4ZC1iYjZmLTQwNWYtYTQ3Ni04YzFiOGNkNzkzNTciLCJlbWFpbCI6InNyaXJraXNobmFAZ21haWwuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NTk4MTM1NzQsImV4cCI6MTc1OTg5OTk3NH0.NCr8wzfGqVq7m4bELgthrk-_24qizgJ_8NkqWXPhmDI"
$adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwYmRiN2JmYS01OTliLTQ5NDQtOTQwZC01YmI1ZWRkNjI0OTQiLCJlbWFpbCI6InRlc3RhZG1pbjEyM0BldmVudGx5LmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1OTgxMzYzMCwiZXhwIjoxNzU5OTAwMDMwfQ.EwJZR2QcC4lDip-Qifguj2oefVMuxRXlzN4T0ZGfB94"
$userId = "64a23c8d-bb6f-405f-a476-8c1b8cd79357"
$eventId = "5e4c14a5-d397-4b7d-aa51-831f17993719"

Write-Host ""
Write-Host "NOTIFICATION SYSTEM TEST" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Get user notifications
Write-Host "TEST 1: Get user notifications..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/notifications/user/$userId" -Method Get -Headers @{"Authorization"="Bearer $userToken"}
    Write-Host "PASS!" -ForegroundColor Green
    Write-Host "Total: $($response.data.notifications.Count) notifications"
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 2: Send test notification (admin)
Write-Host "TEST 2: Send test notification (ADMIN)..." -ForegroundColor Yellow
try {
    $body = @{
        user_id = $userId
        type = "test"
        title = "API Test Notification"
        message = "Testing notification system from PowerShell"
        priority = "high"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/notifications/send" -Method Post -Headers @{"Authorization"="Bearer $adminToken"; "Content-Type"="application/json"} -Body $body
    Write-Host "PASS!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "FAIL: Status $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 3: Broadcast to event (admin)
Write-Host "TEST 3: Broadcast to event (ADMIN)..." -ForegroundColor Yellow
try {
    $body = @{
        title = "Event Update Broadcast"
        message = "This is a broadcast message to all event attendees"
        priority = "medium"
        type = "event_update"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/notifications/broadcast/$eventId" -Method Post -Headers @{"Authorization"="Bearer $adminToken"; "Content-Type"="application/json"} -Body $body
    Write-Host "PASS!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "FAIL: Status $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 4: Get notification stats (admin)
Write-Host "TEST 4: Get notification stats (ADMIN)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/notifications/stats" -Method Get -Headers @{"Authorization"="Bearer $adminToken"}
    Write-Host "PASS!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "FAIL: Status $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

Write-Host ""
Write-Host "TESTS COMPLETED!" -ForegroundColor Cyan
Write-Host ""
