# MouthWatch / USB intraoral camera toolkit

## Read this first: there is no driver to install

MouthWatch intraoral cameras are **UVC (USB Video Class)** devices. UVC is a
standard, and Windows, macOS and Linux all ship the driver for it already:

| OS      | Driver that handles the camera        |
|---------|---------------------------------------|
| Windows | `usbvideo.sys` — "USB Video Device"   |
| macOS   | built into CoreMediaIO (no install)   |
| Linux   | `uvcvideo` kernel module              |

So downloading a driver will not fix a dead camera, and writing one would be
re-implementing code your OS already has. When one of these cameras "doesn't
work" it is nearly always one of four things, in order of how often it is the
cause:

1. **Not enough USB power.** The LED ring pushes these units past what an
   unpowered hub, a monitor port, or a laptop dock supplies. Plug it directly
   into the machine, or into a *powered* hub.
2. **USB 3 port negotiation.** Some units enumerate unreliably on USB 3 / USB-C
   ports. A USB 2.0 port (or a USB 2.0 hub in between) often fixes it outright.
3. **Camera permission.** The OS is blocking the app. On Windows especially,
   "Let desktop apps access your camera" being off blocks most dental software
   while leaving browser apps working.
4. **The wrong device is selected,** or another app already holds the stream.
   Only one application can own a UVC camera at a time.

## Use the toolkit

**Step 1 — diagnose.** This tells you which of the four it is.

```bash
# macOS / Linux
bash camera/scripts/diagnose.sh

# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File camera\scripts\diagnose.ps1
```

It checks USB enumeration, whether the device bound to the UVC driver, whether
another process holds it, camera privacy settings and USB selective suspend
(Windows), and on Linux it grabs a real frame with ffmpeg to prove the sensor
works. It ends with a verdict and the specific next step.

**Step 2 — confirm streaming outside your dental software.**

```bash
npx serve camera        # or: python3 -m http.server 8080 -d camera
```

Open `http://localhost:3000/capture.html` (or `:8080`) in Chrome, Edge, or
Safari. Pick the camera, hit Start, and capture stills. Browsers only grant
camera access on `http://localhost` or `https://` — opening the file directly
with `file://` will fail.

If the camera streams here, **the hardware and driver are fine** and the fault
is in your dental software's device selection or permissions.

## Interpreting what you see

| Symptom | Cause | Fix |
|---|---|---|
| Nothing in `lsusb` / Device Manager | Power, cable, or dead unit | Powered hub, USB 2.0 port, new cable, test on another machine |
| Windows error **code 10** | Insufficient power | Powered hub or direct port |
| Windows error **code 28** | No driver bound | Device Manager → Update driver → Browse → Let me pick → **USB Video Device** |
| Windows error **code 43** | Device reported a failure | Different port, then another PC — likely hardware |
| Enumerates, `/dev/video*` exists, no frame | Power brownout under LED load | Powered hub |
| `NotReadableError` in the browser | Another app holds the camera | Close dental software / video apps |
| Black image, camera otherwise fine | LED off or wrong device picked | Check the unit's LED switch; select the right device |
| Works, then drops mid-exam | USB selective suspend | Power Options → USB → Selective suspend → Disabled |

## Linux specifics

```bash
sudo modprobe uvcvideo            # load the driver if missing
sudo usermod -aG video "$USER"    # permission to open /dev/video* (re-login)
sudo apt install usbutils v4l-utils ffmpeg   # tools the diagnostic uses
```

Some intraoral cameras expose several `/dev/video*` nodes where only the first
actually delivers frames; the diagnostic tests each one and tells you which.

## When it really is hardware

If the camera enumerates on **no** machine, with a known-good cable, on a
powered port, it has failed. That is a warranty/replacement conversation with
MouthWatch, not a software problem.
