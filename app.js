import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startButton = document.getElementById("startButton");
const status = document.getElementById("status");

const volumeValue = document.getElementById("volumeValue");
const volumeFill = document.getElementById("volume-fill");

const indexValue = document.getElementById("indexValue");
const middleValue = document.getElementById("middleValue");
const ringValue = document.getElementById("ringValue");
const pinkyValue = document.getElementById("pinkyValue");

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const MIN_DISTANCE = 0.45;
const MAX_DISTANCE = 2.00;

const HISTORY_SIZE = 10;
const VOLUME_SMOOTHING = 0.15;

let handLandmarker = null;
let cameraStream = null;
let lastVideoTime = -1;
let currentVolume = 0;


class DistanceFilter {

  constructor(size) {
    this.values = [];
    this.size = size;
  }

  update(value) {

    this.values.push(value);

    if (this.values.length > this.size) {
      this.values.shift();
    }

    const total = this.values.reduce(
      (sum, value) => sum + value,
      0
    );

    return total / this.values.length;
  }

  reset() {
    this.values = [];
  }
}


const indexFilter =
  new DistanceFilter(HISTORY_SIZE);

const middleFilter =
  new DistanceFilter(HISTORY_SIZE);

const ringFilter =
  new DistanceFilter(HISTORY_SIZE);

const pinkyFilter =
  new DistanceFilter(HISTORY_SIZE);


function calculateDistance(pointA, pointB) {

  return Math.sqrt(
    Math.pow(pointA.x - pointB.x, 2) +
    Math.pow(pointA.y - pointB.y, 2)
  );
}


function calculateFingerDistance(
  landmarks,
  fingertipIndex
) {

  const wrist = landmarks[0];
  const middleMCP = landmarks[9];

  const thumb = landmarks[4];
  const fingertip = landmarks[fingertipIndex];

  const palmSize =
    calculateDistance(
      wrist,
      middleMCP
    );

  if (palmSize < 0.001) {
    return 0;
  }

  const thumbDistance =
    calculateDistance(
      thumb,
      fingertip
    );

  return thumbDistance / palmSize;
}


function distanceToVolume(distance) {

  distance = Math.max(
    MIN_DISTANCE,
    Math.min(
      MAX_DISTANCE,
      distance
    )
  );

  return (
    (distance - MIN_DISTANCE) /
    (MAX_DISTANCE - MIN_DISTANCE)
  ) * 100;
}


function getCanvasPoint(landmark) {

  return {
    x: landmark.x * canvas.width,
    y: landmark.y * canvas.height
  };
}


function drawPoint(landmark, label) {

  const point =
    getCanvasPoint(landmark);

  ctx.beginPath();

  ctx.arc(
    point.x,
    point.y,
    7,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = "#00ff00";
  ctx.fill();

  ctx.font = "14px Arial";
  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    label,
    point.x + 9,
    point.y - 8
  );
}


function drawConnection(
  thumb,
  fingertip,
  label
) {

  const start =
    getCanvasPoint(thumb);

  const end =
    getCanvasPoint(fingertip);

  ctx.beginPath();

  ctx.moveTo(
    start.x,
    start.y
  );

  ctx.lineTo(
    end.x,
    end.y
  );

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#1d4ed8";

  ctx.stroke();

  const centerX =
    (start.x + end.x) / 2;

  const centerY =
    (start.y + end.y) / 2;

  ctx.font = "14px Arial";
  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    label,
    centerX + 5,
    centerY - 5
  );
}


function drawLandmarks(landmarks) {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  for (const landmark of landmarks) {

    const point =
      getCanvasPoint(landmark);

    ctx.beginPath();

    ctx.arc(
      point.x,
      point.y,
      3,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "#ffff00";
    ctx.fill();
  }


  const thumb = landmarks[4];
  const index = landmarks[8];
  const middle = landmarks[12];
  const ring = landmarks[16];
  const pinky = landmarks[20];


  drawPoint(
    thumb,
    "Thumb"
  );

  drawPoint(
    index,
    "Index"
  );

  drawPoint(
    middle,
    "Middle"
  );

  drawPoint(
    ring,
    "Ring"
  );

  drawPoint(
    pinky,
    "Pinky"
  );


  drawConnection(
    thumb,
    index,
    "I"
  );

  drawConnection(
    thumb,
    middle,
    "M"
  );

  drawConnection(
    thumb,
    ring,
    "R"
  );

  drawConnection(
    thumb,
    pinky,
    "P"
  );
}


function updateVolume(
  indexDistance,
  middleDistance,
  ringDistance,
  pinkyDistance
) {

  indexValue.textContent =
    indexDistance.toFixed(2);

  middleValue.textContent =
    middleDistance.toFixed(2);

  ringValue.textContent =
    ringDistance.toFixed(2);

  pinkyValue.textContent =
    pinkyDistance.toFixed(2);


  const targetVolume =
    distanceToVolume(
      pinkyDistance
    );


  currentVolume +=
    (
      targetVolume -
      currentVolume
    ) * VOLUME_SMOOTHING;


  currentVolume =
    Math.max(
      0,
      Math.min(
        100,
        currentVolume
      )
    );


  const displayedVolume =
    Math.round(
      currentVolume
    );


  volumeValue.textContent =
    displayedVolume;

  volumeFill.style.width =
    displayedVolume + "%";
}


function resizeCanvas() {

  if (
    !video.videoWidth ||
    !video.videoHeight
  ) {
    return;
  }

  canvas.width =
    video.videoWidth;

  canvas.height =
    video.videoHeight;
}


async function loadHandModel() {

  status.textContent =
    "Loading hand model...";


  const vision =
    await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );


  handLandmarker =
    await HandLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            MODEL_URL
        },

        runningMode: "VIDEO",

        numHands: 2,

        minHandDetectionConfidence: 0.5,

        minHandPresenceConfidence: 0.5,

        minTrackingConfidence: 0.6
      }
    );
}


async function startCamera() {

  startButton.disabled = true;


  try {

    if (!handLandmarker) {
      await loadHandModel();
    }


    cameraStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          width: {
            ideal: 640
          },

          height: {
            ideal: 480
          },

          facingMode: "user"
        },

        audio: false
      });


    video.srcObject =
      cameraStream;


    await video.play();


    resizeCanvas();


    status.textContent =
      "Camera running — show your hand";


    currentVolume = 0;
    lastVideoTime = -1;


    requestAnimationFrame(
      processFrame
    );

  } catch (error) {

    console.error(error);

    status.textContent =
      "Camera/model error. Check browser permissions.";

    startButton.disabled = false;
  }
}


function processFrame() {

  if (
    !handLandmarker ||
    video.readyState < 2
  ) {

    requestAnimationFrame(
      processFrame
    );

    return;
  }


  resizeCanvas();


  if (
    video.currentTime !==
    lastVideoTime
  ) {

    const result =
      handLandmarker.detectForVideo(
        video,
        performance.now()
      );


    lastVideoTime =
      video.currentTime;


    if (
      result.landmarks &&
      result.landmarks.length > 0
    ) {

      const landmarks =
        result.landmarks[0];


      const indexRaw =
        calculateFingerDistance(
          landmarks,
          8
        );


      const middleRaw =
        calculateFingerDistance(
          landmarks,
          12
        );


      const ringRaw =
        calculateFingerDistance(
          landmarks,
          16
        );


      const pinkyRaw =
        calculateFingerDistance(
          landmarks,
          20
        );


      const indexDistance =
        indexFilter.update(
          indexRaw
        );


      const middleDistance =
        middleFilter.update(
          middleRaw
        );


      const ringDistance =
        ringFilter.update(
          ringRaw
        );


      const pinkyDistance =
        pinkyFilter.update(
          pinkyRaw
        );


      drawLandmarks(
        landmarks
      );


      updateVolume(
        indexDistance,
        middleDistance,
        ringDistance,
        pinkyDistance
      );


      status.textContent =
        "Hand detected";

    } else {

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );


      indexFilter.reset();
      middleFilter.reset();
      ringFilter.reset();
      pinkyFilter.reset();


      status.textContent =
        "Camera running — no hand detected";
    }
  }


  requestAnimationFrame(
    processFrame
  );
}


startButton.addEventListener(
  "click",
  startCamera
);


window.addEventListener(
  "resize",
  resizeCanvas
);
