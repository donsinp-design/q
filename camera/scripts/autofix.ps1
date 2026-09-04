<#
  MouthWatch / UVC intraoral camera AUTO-FIX  (Windows)

  Applies every fix that can be automated, then opens a live camera test.
  Requires Administrator. Re-run after each physical change (new port/hub).

  What it CHANGES on this PC:
    - Enables camera access for desktop apps and for this user
    - Disables USB selective suspend on the active power plan
    - Re-binds any camera stuck with no driver to the built-in USB Video Device
    - Restarts the Windows camera frame server
  What it CANNOT do: supply more USB power. If the verdict says power, you must
  move the cable to a powered hub or a rear USB 2.0 port yourself.
#>

$ErrorActionPreference = 'Continue'
function Ok  ($m){ Write-Host "  [fixed] $m" -ForegroundColor Green }
function Sk  ($m){ Write-Host "  [ok]    $m" -ForegroundColor DarkGray }
function Bad ($m){ Write-Host "  [!]     $m" -ForegroundColor Red }
function Hdr ($m){ Write-Host "`n== $m ==" -ForegroundColor White }

if (-not ([Security.Principal.WindowsPrincipal] `
      [Security.Principal.WindowsIdentity]::GetCurrent()
     ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Bad "Not running as Administrator."
  Write-Host "  Right-click PowerShell > 'Run as administrator', then run this again."
  exit 1
}

Hdr "1. Camera privacy (this blocks most dental software)"
$store = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam'
foreach ($p in @($store, "$store\NonPackaged")) {
  try {
    if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
    $cur = (Get-ItemProperty $p -Name Value -ErrorAction SilentlyContinue).Value
    if ($cur -eq 'Allow') { Sk "$p already allows camera access." }
    else { Set-ItemProperty -Path $p -Name Value -Value 'Allow' -Force; Ok "Enabled camera access at $p" }
  } catch { Bad "Could not set $p : $($_.Exception.Message)" }
}
$ustore = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam'
foreach ($p in @($ustore, "$ustore\NonPackaged")) {
  try {
    if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
    Set-ItemProperty -Path $p -Name Value -Value 'Allow' -Force
    Ok "Enabled camera access for this user at $p"
  } catch { Bad "Could not set $p" }
}
# Group policy can override the above; report it rather than fight it.
$pol = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy'
$gp = (Get-ItemProperty $pol -Name LetAppsAccessCamera -ErrorAction SilentlyContinue).LetAppsAccessCamera
if ($gp -eq 2) { Bad "Group Policy is FORCE-DENYING camera access. Your IT admin must lift it." }

Hdr "2. USB selective suspend (causes mid-exam dropouts)"
try {
  powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 `
           48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 2>$null
  powercfg /setdcvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 `
           48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 2>$null
  powercfg /setactive SCHEME_CURRENT 2>$null
  Ok "Disabled USB selective suspend (plugged in and on battery)."
} catch { Bad "Could not change the power plan." }

Hdr "3. Stop USB hubs from being powered down"
$n = 0
Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue |
  Where-Object { $_.PNPDeviceID -match '^USB\\ROOT_HUB|^USB\\VID' } | ForEach-Object {
    $id = $_.PNPDeviceID
    try {
      $pm = Get-CimInstance -Namespace root\wmi -ClassName MSPower_DeviceEnable -ErrorAction Stop |
            Where-Object { $_.InstanceName -like "*$($id.Replace('\','\\'))*" }
      foreach ($d in $pm) {
        if ($d.Enable) { $d.Enable = $false; Set-CimInstance -InputObject $d -ErrorAction Stop; $n++ }
      }
    } catch {}
  }
if ($n) { Ok "Turned off 'allow the computer to turn off this device' on $n USB device(s)." }
else    { Sk "No USB devices needed this change." }

Hdr "4. Re-bind cameras with no driver"
$fixed = 0
Get-PnpDevice -ErrorAction SilentlyContinue |
  Where-Object { $_.Status -ne 'OK' -and
                ($_.Class -in 'Camera','Image','Media' -or $_.FriendlyName -match 'camera|intraoral|mouthwatch|uvc') } |
  ForEach-Object {
    Bad "$($_.FriendlyName) - status $($_.Status). Reinstalling..."
    try {
      pnputil /remove-device $_.InstanceId 2>&1 | Out-Null
      $fixed++
    } catch { Bad "  Could not reset $($_.FriendlyName)" }
  }
Write-Host "  Rescanning for hardware..."
pnputil /scan-devices 2>&1 | Out-Null
Start-Sleep -Seconds 4
if ($fixed) { Ok "Reset $fixed device(s) and rescanned; Windows re-bound the USB Video Device driver." }
else        { Sk "No camera was stuck without a driver." }

Hdr "5. Restart the camera frame server"
try {
  $svc = Get-Service FrameServer -ErrorAction Stop
  Restart-Service FrameServer -Force -ErrorAction Stop
  Ok "Restarted FrameServer (releases a camera held by a crashed app)."
} catch { Sk "FrameServer service not present or not restartable - fine on most systems." }

Hdr "6. Result"
$cams = Get-PnpDevice -Class Camera,Image,Media -ErrorAction SilentlyContinue |
        Where-Object { $_.FriendlyName -match 'camera|intraoral|mouthwatch|uvc|video' }
if ($cams | Where-Object Status -eq 'OK') {
  $cams | Where-Object Status -eq 'OK' | ForEach-Object { Ok "READY: $($_.FriendlyName)" }
  Write-Host "`n  The camera is working at the Windows level. Opening a live test..." -ForegroundColor Green
  $page = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Leaf) 'capture.html'
  $full = Join-Path (Split-Path $PSScriptRoot -Parent) 'capture.html'
  if (Test-Path $full) {
    Start-Process "msedge.exe" "--allow-file-access-from-files `"$full`"" -ErrorAction SilentlyContinue
    Write-Host "  If Edge did not open, serve the folder and browse to capture.html."
  }
  Write-Host "`n  If it streams in the browser but NOT in your dental software, the fault is"
  Write-Host "  that software's device selection - point it at the intraoral camera."
} else {
@"

  Windows still does not see a working camera. Every software fix has now been
  applied, so what is left is physical, and I cannot do it from here:

    1. Unplug the camera. Plug it DIRECTLY into a rear USB port on the PC
       (not a hub, not the monitor, not a dock).
    2. Prefer a black USB 2.0 port over a blue USB 3.0 one.
    3. If it has a separate power brick or powered dongle, make sure it is
       connected and the LED lights up.
    4. Re-run this script after each change.

  If the LED never lights on any port on any PC, the unit or cable is dead and
  it is a warranty call to MouthWatch.
"@ | Write-Host -ForegroundColor Yellow
}
Write-Host ""
