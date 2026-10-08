import {
  FilesetResolver,
  HandLandmarker
} from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const startButton = document.getElementById("startButton");
const status = document.getElementById("status");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const volumeValue = document.getElementById("volumeValue");
const volumeFill = document.getElementById("volume-fill");

const indexValue = document.getElementById("indexValue");
const middleValue = document.getElementById("middleValue");
const ringValue = document.getElementById("ringValue");
const pinkyValue = document.getElementById("pinkyValue");

const THUMB = 4;
const INDEX = 8;
const MIDDLE = 12;
const RING = 16;
const PINKY = 20;

const MIN_DISTANCE = 0.45;
const MAX_DISTANCE = 2.0;
const HISTORY_SIZE = 8;

let handLandmarker = null;
let lastTimestamp = 0;

const history = {
  index: [],
  middle: [],
  ring: [],
  pinky: []
};

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(
    dx * dx + dy * dy
  );
}

function smoothValue(array, value) {
  array.push(value);

  if (array.length > HISTORY_SIZE) {
    array.shift();
  }

  return (
    array.reduce(
      (sum, item) => sum + item,
      0
    ) / array.length
  );
}

function normalizedDistance(hand, fingertipIndex) {
  const palmSize =
    distance(hand[0], hand[9]);

  if (palmSize < 0.001) {
    return 0;
  }

  return (
    distance(
      hand[THUMB],
      hand[fingertipIndex]
    ) / palmSize
  );
}

function distanceToVolume(value) {
  const clamped = Math.max(
    MIN_DISTANCE,
    Math.min(MAX_DISTANCE, value)
  );

  return (
    (clamped - MIN_DISTANCE) /
    (MAX_DISTANCE - MIN_DISTANCE)
  ) * 100;
}

/*
 * The video is mirrored in CSS.
 * MediaPipe gives coordinates for the original frame.
 * Mirror only the X coordinate for the overlay.
 *
 * The canvas itself is NOT mirrored, so text remains readable.
 */
function screenX(landmark) {
  return (
    (1 - landmark.x) *
    canvas.width
  );
}

function screenY(landmark) {
  return (
    landmark.y *
    canvas.height
  );
}

function drawPoint(landmark, label) {
  const x = screenX(landmark);
  const y = screenY(landmark);

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    6,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = "#00ff00";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "14px Arial";

  ctx.fillText(
    label,
    x + 8,
    y - 8
  );
}

function drawLine(a, b) {
  ctx.beginPath();

  ctx.moveTo(
    screenX(a),
    screenY(a)
  );

  ctx.lineTo(
    screenX(b),
    screenY(b)
  );

  ctx.strokeStyle = "#008cff";
  ctx.lineWidth = 3;

  ctx.stroke();
}

function drawHand(hand) {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  for (const landmark of hand) {

    ctx.beginPath();

    ctx.arc(
      screenX(landmark),
      screenY(landmark),
      3,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "#ffff00";
    ctx.fill();
  }

  const thumb = hand[THUMB];
  const index = hand[INDEX];
  const middle = hand[MIDDLE];
  const ring = hand[RING];
  const pinky = hand[PINKY];

  drawLine(thumb, index);
  drawLine(thumb, middle);
  drawLine(thumb, ring);
  drawLine(thumb, pinky);

  drawPoint(thumb, "Thumb");
  drawPoint(index, "Index");
  drawPoint(middle, "Middle");
  drawPoint(ring, "Ring");
  drawPoint(pinky, "Pinky");
}

async function initializeHandLandmarker() {

  status.textContent =
    "Loading hand tracking...";

  const vision =
    await FilesetResolver.forVisionTasks(
      "./wasm"
    );

  handLandmarker =
    await HandLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath: MODEL_URL
        },

        runningMode: "VIDEO",

        numHands: 1,

        minHandDetectionConfidence: 0.5,

        minHandPresenceConfidence: 0.5,

        minTrackingConfidence: 0.6
      }
    );

  status.textContent =
    "Hand tracking ready.";
}

async function startCamera() {

  startButton.disabled = true;

  try {

    if (!handLandmarker) {
      await initializeHandLandmarker();
    }

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480
        },
        audio: false
      });

    video.srcObject =
      stream;

    await video.play();

    canvas.width =
      video.videoWidth || 640;

    canvas.height =
      video.videoHeight || 480;

    status.textContent =
      "Camera running.";

    processVideo();

  } catch (error) {

    console.error(error);

    status.textContent =
      "Error: " + error.message;

    startButton.disabled = false;
  }
}

function processVideo() {

  if (
    video.readyState <
    HTMLMediaElement.HAVE_CURRENT_DATA
  ) {

    requestAnimationFrame(
      processVideo
    );

    return;
  }

  let timestamp =
    Math.floor(
      performance.now()
    );

  if (timestamp <= lastTimestamp) {
    timestamp =
      lastTimestamp + 1;
  }

  lastTimestamp =
    timestamp;

  const result =
    handLandmarker.detectForVideo(
      video,
      timestamp
    );

  if (
    result.landmarks &&
    result.landmarks.length > 0
  ) {

    const hand =
      result.landmarks[0];

    drawHand(hand);

    const indexDistance =
      smoothValue(
        history.index,
        normalizedDistance(
          hand,
          INDEX
        )
      );

    const middleDistance =
      smoothValue(
        history.middle,
        normalizedDistance(
          hand,
          MIDDLE
        )
      );

    const ringDistance =
      smoothValue(
        history.ring,
        normalizedDistance(
          hand,
          RING
        )
      );

    const pinkyDistance =
      smoothValue(
        history.pinky,
        normalizedDistance(
          hand,
          PINKY
        )
      );

    const volume =
      distanceToVolume(
        pinkyDistance
      );

    indexValue.textContent =
      indexDistance.toFixed(2);

    middleValue.textContent =
      middleDistance.toFixed(2);

    ringValue.textContent =
      ringDistance.toFixed(2);

    pinkyValue.textContent =
      pinkyDistance.toFixed(2);

    volumeValue.textContent =
      Math.round(volume);

    volumeFill.style.width =
      volume + "%";

  } else {

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    indexValue.textContent =
      "--";

    middleValue.textContent =
      "--";

    ringValue.textContent =
      "--";

    pinkyValue.textContent =
      "--";
  }

  requestAnimationFrame(
    processVideo
  );
}

startButton.addEventListener(
  "click",
  startCamera
);
