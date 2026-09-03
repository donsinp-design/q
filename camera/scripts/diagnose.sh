#!/usr/bin/env bash
# MouthWatch / UVC intraoral camera diagnostic (macOS + Linux)
# Answers: is the device enumerating, is it UVC, does it stream, who is holding it.
set -uo pipefail

ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$1"; }
hdr()  { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

OS=$(uname -s)
FOUND=0

hdr "1. USB enumeration"
if [ "$OS" = "Darwin" ]; then
  DUMP=$(system_profiler SPUSBDataType 2>/dev/null)
  if printf '%s' "$DUMP" | grep -qiE 'mouthwatch|intraoral|intra-oral|usb ?camera|uvc'; then
    ok "A camera-like USB device is enumerating."
    printf '%s' "$DUMP" | grep -iE -A6 'mouthwatch|intraoral|usb ?camera' | sed 's/^/       /'
    FOUND=1
  else
    bad "No camera-like USB device found. The Mac is not seeing it at all."
  fi
else
  if command -v lsusb >/dev/null 2>&1; then
    LSUSB=$(lsusb)
    printf '%s\n' "$LSUSB" | sed 's/^/       /'
    if printf '%s' "$LSUSB" | grep -qiE 'mouthwatch|intraoral|camera|webcam|uvc'; then
      ok "A camera-like USB device is enumerating."; FOUND=1
    else
      bad "No camera-like USB device in lsusb. The machine is not seeing it at all."
    fi
  else
    warn "lsusb not installed (apt install usbutils / dnf install usbutils)."
  fi
fi

hdr "2. UVC video nodes"
if [ "$OS" = "Darwin" ]; then
  CAMS=$(system_profiler SPCameraDataType 2>/dev/null | grep -E '^\s{4}\S' | sed 's/:$//' | sed 's/^ *//')
  if [ -n "$CAMS" ]; then
    ok "macOS registered these cameras:"; printf '%s\n' "$CAMS" | sed 's/^/       - /'
  else
    bad "macOS registered no cameras. Device is not binding to the UVC driver."
  fi
else
  if ls /dev/video* >/dev/null 2>&1; then
    ok "Video nodes present:"; ls -1 /dev/video* | sed 's/^/       /'
    if command -v v4l2-ctl >/dev/null 2>&1; then
      for d in /dev/video*; do
        CARD=$(v4l2-ctl -d "$d" --info 2>/dev/null | sed -n 's/.*Card type *: *//p')
        FMTS=$(v4l2-ctl -d "$d" --list-formats 2>/dev/null | sed -n 's/.*Pixel Format: //p' | tr '\n' ' ')
        [ -n "$CARD" ] && printf '       %s -> %s  [%s]\n' "$d" "$CARD" "${FMTS:-no capture formats}"
      done
    else
      warn "v4l2-ctl not installed (apt install v4l-utils) - cannot confirm capture formats."
    fi
  else
    bad "No /dev/video* nodes. Check: lsmod | grep uvcvideo"
    lsmod 2>/dev/null | grep -q uvcvideo && warn "uvcvideo is loaded but bound nothing - likely a power/cable fault." \
                                         || bad "uvcvideo module is NOT loaded: sudo modprobe uvcvideo"
  fi
fi

hdr "3. Is another app holding the camera?"
if [ "$OS" = "Darwin" ]; then
  HOLD=$(lsof 2>/dev/null | grep -iE 'AppleCamera|VDCAssistant' | awk '{print $1}' | sort -u)
  [ -n "$HOLD" ] && warn "Camera stack in use by: $(echo $HOLD)" || ok "Nothing appears to be holding the camera."
else
  if ls /dev/video* >/dev/null 2>&1; then
    HOLD=$(fuser /dev/video* 2>&1 | grep -v '^$' || true)
    [ -n "$HOLD" ] && warn "Something has /dev/video* open: $HOLD" || ok "No process is holding the video nodes."
  fi
fi

hdr "4. Live capture test"
if [ "$OS" != "Darwin" ] && command -v ffmpeg >/dev/null 2>&1 && ls /dev/video* >/dev/null 2>&1; then
  for d in /dev/video*; do
    if ffmpeg -hide_banner -loglevel error -f v4l2 -i "$d" -frames:v 1 -y "/tmp/uvc-test-$(basename "$d").jpg" 2>/dev/null; then
      ok "$d produced a real frame -> /tmp/uvc-test-$(basename "$d").jpg"; FOUND=2
    else
      warn "$d enumerated but produced no frame (metadata-only node, or power fault)."
    fi
  done
else
  warn "Skipping frame grab (needs ffmpeg on Linux). Use camera/capture.html in a browser instead."
fi

hdr "Verdict"
case "$FOUND" in
  0) cat <<'T'
  The device never enumerated. In order, this is almost always:
    1. Underpowered port. Plug straight into the machine, or a POWERED hub.
       Intraoral cameras with LED rings exceed what a bus-powered hub gives.
    2. Try a USB 2.0 port. Some MouthWatch units negotiate badly on USB 3 ports.
    3. Swap the cable, then try a second machine to isolate cable vs. camera.
  If it enumerates nowhere, it is a hardware/cable fault - no driver fixes that.
T
;;
  *) cat <<'T'
  The camera IS visible to the OS, so no driver is missing. If your dental
  software still shows black, the problem is app-side:
    - The app is opening the wrong device. Pick the intraoral camera explicitly.
    - OS camera permission is not granted to that app.
    - Another app already holds the stream (see section 3) - quit it.
  Open camera/capture.html in a browser to confirm the camera streams outside
  your dental software. If it works there, the camera is fine.
T
;;
esac
