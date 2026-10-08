cd ~/Downloads/hand-gesture-volume-control-web

cat > README.md <<'EOF'
# Hand Gesture Volume Control

A browser-based computer vision project that uses your webcam and MediaPipe Hand Landmarker to track hand landmarks and control a visual volume indicator using hand gestures.

## Demo

Live Demo: https://hand-gesture-volume-control-web.vercel.app/

GitHub: https://github.com/mrinmoycontent/hand-gesture-volume-control-web

## Features

- Real-time hand tracking through the browser webcam
- Tracks all 21 MediaPipe hand landmarks
- Tracks five fingertips:
  - Thumb
  - Index
  - Middle
  - Ring
  - Pinky
- Calculates four thumb-to-finger distances
- Smooths distance values for more stable tracking
- Uses thumb-to-pinky distance to calculate the volume percentage
- Displays a real-time volume bar
- Draws hand landmarks and connection lines directly over the webcam feed
- Runs hand landmark processing in the browser

## How It Works

```text
Webcam
   ↓
MediaPipe Hand Landmarker
   ↓
21 Hand Landmarks
   ↓
Thumb + Finger Distance Calculation
   ↓
Distance Smoothing
   ↓
Volume Percentage
   ↓
Visual Volume Indicator
