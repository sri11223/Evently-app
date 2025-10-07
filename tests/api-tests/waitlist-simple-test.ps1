# Waitlist System Full Testing Script
$baseUrl = "https://evently-app-7hx2.onrender.com/api/v1"
$userToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NGEyM2M4ZC1iYjZmLTQwNWYtYTQ3Ni04YzFiOGNkNzkzNTciLCJlbWFpbCI6InNyaXJraXNobmFAZ21haWwuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NTk4MTM1NzQsImV4cCI6MTc1OTg5OTk3NH0.NCr8wzfGqVq7m4bELgthrk-_24qizgJ_8NkqWXPhmDI"
$adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwYmRiN2JmYS01OTliLTQ5NDQtOTQwZC01YmI1ZWRkNjI0OTQiLCJlbWFpbCI6InRlc3RhZG1pbjEyM0BldmVudGx5LmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1OTgxMzYzMCwiZXhwIjoxNzU5OTAwMDMwfQ.EwJZR2QcC4lDip-Qifguj2oefVMuxRXlzN4T0ZGfB94"
$soldOutEventId = "5e4c14a5-d397-4b7d-aa51-831f17993719"
$userId = "64a23c8d-bb6f-405f-a476-8c1b8cd79357"

Write-Host ""
Write-Host "WAITLIST SYSTEM TEST" -ForegroundColor Cyan
Write-Host "===================="
Write-Host ""

# Test 1: Join waitlist
Write-Host "TEST 1: Join waitlist for sold-out event..." -ForegroundColor Yellow
try {
    $body = @{ user_id = $userId } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/join" -Method Post `
        -Headers @{"Authorization"="Bearer $userToken"; "Content-Type"="application/json"} -Body $body
    Write-Host "PASS: Joined waitlist!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 2: Check position
Write-Host "TEST 2: Check waitlist position..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/user/$userId" `
        -Method Get -Headers @{"Authorization"="Bearer $userToken"}
    Write-Host "PASS: Got position!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 3: Get stats (admin)
Write-Host "TEST 3: Get waitlist stats (ADMIN)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/stats" `
        -Method Get -Headers @{"Authorization"="Bearer $adminToken"}
    Write-Host "PASS: Got stats!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "FAIL: Status $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 4: Process waitlist (admin)
Write-Host "TEST 4: Process waitlist (ADMIN)..." -ForegroundColor Yellow
try {
    $body = @{ available_seats = 1 } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/process" -Method Post `
        -Headers @{"Authorization"="Bearer $adminToken"; "Content-Type"="application/json"} -Body $body
    Write-Host "PASS: Processed waitlist!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "FAIL: Status $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 5: Leave waitlist
Write-Host "TEST 5: Leave waitlist..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/waitlist/$soldOutEventId/user/$userId" `
        -Method Delete -Headers @{"Authorization"="Bearer $userToken"}
    Write-Host "PASS: Left waitlist!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "TESTS COMPLETED!" -ForegroundColor Cyan
Write-Host ""
