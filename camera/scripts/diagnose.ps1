<#
  MouthWatch / UVC intraoral camera diagnostic (Windows)
  Run in PowerShell:  powershell -ExecutionPolicy Bypass -File .\diagnose.ps1
#>

function Ok   ($m) { Write-Host "  OK   $m" -ForegroundColor Green }
function Bad  ($m) { Write-Host "  FAIL $m" -ForegroundColor Red }
function Warn ($m) { Write-Host "  WARN $m" -ForegroundColor Yellow }
function Hdr  ($m) { Write-Host "`n== $m ==" -ForegroundColor White }

$found = $false

Hdr "1. Imaging / camera devices"
$cams = Get-PnpDevice -Class Camera,Image,Media -ErrorAction SilentlyContinue |
        Where-Object { $_.FriendlyName -match 'camera|intraoral|intra-oral|mouthwatch|uvc|video' }
if ($cams) {
  $found = $true
  $cams | Select-Object Status, FriendlyName, InstanceId | Format-Table -AutoSize
  foreach ($c in $cams) {
    switch ($c.Status) {
      'OK'       { Ok   "$($c.FriendlyName) is running." }
      'Error'    { Bad  "$($c.FriendlyName) is in an error state - see code below." }
      'Unknown'  { Warn "$($c.FriendlyName) reports Unknown - usually unplugged mid-session." }
      default    { Warn "$($c.FriendlyName) status: $($c.Status)" }
    }
    $code = (Get-PnpDeviceProperty -InstanceId $c.InstanceId -KeyName 'DEVPKEY_Device_ProblemCode' -ErrorAction SilentlyContinue).Data
    if ($code -and $code -ne 0) {
      Bad "  Device problem code $code"
      switch ($code) {
        10 { Write-Host "       Code 10 = cannot start. Almost always insufficient USB power." }
        28 { Write-Host "       Code 28 = no driver bound. Fix: Device Manager > right-click >" 
             Write-Host "       Update driver > Browse > Let me pick > 'USB Video Device'." }
        43 { Write-Host "       Code 43 = device reported a failure. Try another port, then another PC." }
        default { Write-Host "       Look up 'Device Manager error code $code'." }
      }
    }
  }
} else {
  Bad "No camera/imaging device found. Windows is not seeing the camera at all."
}

Hdr "2. Unknown / problem USB devices"
$bad = Get-PnpDevice -ErrorAction SilentlyContinue |
       Where-Object { $_.Status -ne 'OK' -and $_.InstanceId -match '^USB' }
if ($bad) {
  Warn "These USB devices are not healthy - one of them may be your camera:"
  $bad | Select-Object Status, Class, FriendlyName | Format-Table -AutoSize
} else { Ok "All USB devices report healthy." }

Hdr "3. Windows camera privacy settings"
$root = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam'
$g = (Get-ItemProperty $root -ErrorAction SilentlyContinue).Value
if ($g -eq 'Allow') { Ok "Camera access is enabled for this user." }
elseif ($g)         { Bad "Camera access is '$g'. Settings > Privacy > Camera > turn it ON." }
else                { Warn "Could not read the camera privacy setting; check it manually." }

$desktop = (Get-ItemProperty "$root\NonPackaged" -ErrorAction SilentlyContinue).Value
if ($desktop -and $desktop -ne 'Allow') {
  Bad "Desktop apps are BLOCKED from the camera. This blocks most dental software."
  Write-Host "       Settings > Privacy & security > Camera > 'Let desktop apps access your camera' = On"
}

Hdr "4. USB selective suspend"
try {
  $plan = (powercfg /getactivescheme) -replace '.*GUID: ([a-f0-9-]+).*','$1'
  $s = powercfg /query $plan 2>$null | Select-String -Pattern 'USB selective suspend' -Context 0,6
  if ($s -match '0x00000001') {
    Warn "USB selective suspend is ENABLED. It can drop intraoral cameras mid-exam."
    Write-Host "       Power Options > Change advanced settings > USB > Selective suspend > Disabled"
  } else { Ok "USB selective suspend does not appear to be forcing suspend." }
} catch { Warn "Could not read the power plan." }

Hdr "Verdict"
if ($found) {
@"
  Windows sees the camera, so no driver package is missing - MouthWatch cameras
  are standard UVC and use the built-in 'USB Video Device' driver.
  If your dental software still shows black:
    - It is opening the wrong device. Select the intraoral camera in its settings.
    - Desktop-app camera access is off (section 3).
    - Another program already holds the stream. Close it and retry.
  Open camera\capture.html in Chrome or Edge to confirm the camera streams
  outside your dental software.
"@ | Write-Host
} else {
@"
  The camera never enumerated. In order, this is almost always:
    1. Underpowered port. Plug directly into the PC, or use a POWERED hub.
       The LED ring draws more than a bus-powered hub supplies.
    2. Use a USB 2.0 port. Some units negotiate badly on USB 3.
    3. Swap the cable, then try a second PC to isolate cable vs. camera.
  If it enumerates on no machine, it is a hardware fault - no driver fixes that.
"@ | Write-Host
}
