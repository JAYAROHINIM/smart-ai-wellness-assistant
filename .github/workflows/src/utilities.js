// Register WebGL backend.
import '@tensorflow/tfjs-backend-webgl';

const color = "aqua";

function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }
  
  function isiOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  
  export function isMobile() {
    return isAndroid() || isiOS();
  }

export function drawPoint(ctx, y, x, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }

export function drawKeypoints(keypoints, minConfidence, ctx, scale = 1) {
    for (let i = 0; i < keypoints.length; i++) {
      const keypoint = keypoints[i];
  
      if (keypoint.score < minConfidence) {
        continue;
      }
  
      const y = keypoint.y;
      const x = keypoint.x;
      drawPoint(ctx, y * scale, x * scale, 3, color);
    }
  }