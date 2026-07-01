$BASE = "http://localhost:4000"
$RESULTS = [System.Collections.ArrayList]::new()

function Test-Endpoint {
    param($Name, [bool]$Pass, $Detail = "")
    $status = if ($Pass) { "PASS" } else { "FAIL" }
    $color = if ($Pass) { "Green" } else { "Red" }
    Write-Host "[$status] $Name" -ForegroundColor $color
    if ($Detail) { Write-Host "       $Detail" -ForegroundColor Gray }
    [void]$RESULTS.Add([PSCustomObject]@{ Name=$Name; Status=$status })
}

function Req {
    param($Method, $Url, $Body, $Headers)
    $h = @{ "Content-Type"="application/json" }
    if ($Headers) { $Headers.Keys | ForEach-Object { $h[$_]=$Headers[$_] } }
    try {
        $r = Invoke-WebRequest -Uri $Url -Method $Method -Body $Body -Headers $h -UseBasicParsing -ErrorAction Stop
        $data = if ($r.Content) { $r.Content | ConvertFrom-Json } else { $null }
        return [PSCustomObject]@{ Code=[int]$r.StatusCode; Data=$data; Raw=$r.Content }
    } catch {
        $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        $raw = if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $reader.ReadToEnd()
        } else {
            $_.ErrorDetails.Message
        }
        $data = try { $raw | ConvertFrom-Json } catch { $null }
        return [PSCustomObject]@{ Code=$code; Data=$data; Raw=$raw }
    }
}

# Generate unique emails
$rand = Get-Random
$patientEmail = "patient_$rand@mv.com"
$doctorEmail = "doctor_$rand@mv.com"

# Test 1: Register Patient
$r1 = Req POST "$BASE/auth/register" ("{`"name`":`"Api Patient`",`"email`":`"$patientEmail`",`"password`":`"Test1234!`",`"role`":`"patient`"}")
Test-Endpoint "1. Patient Registration" ($r1.Code -eq 200 -or $r1.Code -eq 201) "Code: $($r1.Code)"

# Test 2: Register Doctor
$r2 = Req POST "$BASE/auth/register" ("{`"name`":`"Api Doctor`",`"email`":`"$doctorEmail`",`"password`":`"Test1234!`",`"role`":`"doctor`",`"regNumber`":`"REG$rand`",`"degree`":`"MBBS`"}")
Test-Endpoint "2. Doctor Registration" ($r2.Code -eq 200 -or $r2.Code -eq 201) "Code: $($r2.Code)"

# Test 3: Zod - Missing email on Register
$r3 = Req POST "$BASE/auth/register" '{"name":"NoEmail"}'
Test-Endpoint "3. Zod Validation (missing email -> 400)" ($r3.Code -eq 400) "Code: $($r3.Code), Errors: $($r3.Raw)"

# Test 4: Login Patient
$r4 = Req POST "$BASE/auth/login" ("{`"email`":`"$patientEmail`",`"password`":`"Test1234!`",`"role`":`"patient`"}")
$global:TOKEN = if ($r4.Data.token) { $r4.Data.token } else { "" }
$global:REFRESH = if ($r4.Data.refreshToken) { $r4.Data.refreshToken } else { "" }
Test-Endpoint "4. Patient Login" ($global:TOKEN -ne "") "Code: $($r4.Code), Token received: $($global:TOKEN -ne '')"

# Test 5: Auth header required on /patient/medical-records
$r5 = Req GET "$BASE/patient/medical-records" $null $null
Test-Endpoint "5. Auth required (/patient/medical-records -> 401)" ($r5.Code -eq 401) "Code: $($r5.Code)"

# Test 6: Authenticated request
$r6 = Req GET "$BASE/patient/medical-records" $null @{ Authorization="Bearer $global:TOKEN" }
Test-Endpoint "6. Authenticated GET /patient/medical-records" ($r6.Code -eq 200) "Code: $($r6.Code)"

# Test 7: Refresh token prefix format (userId.hex)
$formatOk = $global:REFRESH -match '^\d+\.[a-f0-9]{80}$'
Test-Endpoint "7. Refresh Token has userId.hex prefix" $formatOk "Token: $global:REFRESH"

# Test 8: Token refresh works
$refreshBody = "{`"refreshToken`":`"$global:REFRESH`"}"
$r8 = Req POST "$BASE/auth/refresh" $refreshBody
$newTok = if ($r8.Data.token) { $r8.Data.token } else { "" }
Test-Endpoint "8. Token Refresh works" ($r8.Code -eq 200 -and $newTok -ne "") "Code: $($r8.Code)"

# Test 9: Invalid refresh token -> 403
$r9 = Req POST "$BASE/auth/refresh" '{"refreshToken":"99.badhex00000000000000000000000000000000000000000000000000000000000000"}'
Test-Endpoint "9. Invalid refresh token -> 403" ($r9.Code -eq 403) "Code: $($r9.Code)"

# Test 10: Appointment Zod (missing time -> 400)
$r10 = Req POST "$BASE/appointments/" '{"doctor_id":2,"appointment_date":"2026-08-15"}' @{ Authorization="Bearer $global:TOKEN" }
Test-Endpoint "10. Appointment Zod (missing time -> 400)" ($r10.Code -eq 400) "Code: $($r10.Code), Errors: $($r10.Raw)"

# Test 11: Upload no auth -> 401
$r11 = Req POST "$BASE/files/upload" $null $null
Test-Endpoint "11. Upload no auth -> 401" ($r11.Code -eq 401) "Code: $($r11.Code)"

# Summary
Write-Host "`n==============================" -ForegroundColor Cyan
$pass = ($RESULTS | Where-Object Status -eq "PASS").Count
$fail = ($RESULTS | Where-Object Status -eq "FAIL").Count
Write-Host " PASSED: $pass / $($RESULTS.Count)" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
if ($fail -gt 0) { 
    Write-Host " FAILED: $fail" -ForegroundColor Red
    $RESULTS | Where-Object Status -eq "FAIL" | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Red }
}
Write-Host "==============================`n" -ForegroundColor Cyan
