import { db } from './firebase.js';
import { speakAvatarMessage } from './main.js';

let hands = null;
let camera = null;
let userId = 'user_123'; // Replace with actual user ID

async function initializeGestureRecognition() {
  console.log('👋 Starting MediaPipe Hands...');
  
  const videoElement = document.getElementById('localVideo');

  hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hands.onResults(onHandsResults);

  camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
  });

  await camera.start();
  console.log('✅ Gesture recognition active!');
}

function onHandsResults(results) {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    return; // No hands detected
  }

  const landmarks = results.multiHandLandmarks[0];
  const gesture = classifyGesture(landmarks);
  
  if (gesture) {
    handleGestureDetected(gesture);
  }
}

function classifyGesture(landmarks) {
  const thumb_tip = landmarks[4];
  const index_tip = landmarks[8];
  const middle_tip = landmarks[12];
  const ring_tip = landmarks[16];
  const pinky_tip = landmarks[20];
  const wrist = landmarks[0];
  
  if (thumb_tip.y < wrist.y - 0.2 && 
      index_tip.y > middle_tip.y) {
    return 'thumbs_up';
  }
  
  if (thumb_tip.y > wrist.y + 0.2 && 
      index_tip.y < wrist.y) {
    return 'thumbs_down';
  }
  
  if (index_tip.y < wrist.y && 
      middle_tip.y < wrist.y && 
      ring_tip.y < wrist.y && 
      pinky_tip.y < wrist.y) {
    return 'open_palm';
  }
  
  if (index_tip.y < wrist.y - 0.15 && 
      middle_tip.y > wrist.y && 
      ring_tip.y > wrist.y) {
    return 'pointing';
  }
  
  if (index_tip.y < wrist.y && 
      middle_tip.y < wrist.y && 
      ring_tip.y > wrist.y && 
      pinky_tip.y > wrist.y) {
    return 'peace_sign';
  }
  
  const thumbIndexDist = distance(thumb_tip, index_tip);
  if (thumbIndexDist < 0.05 && 
      middle_tip.y < wrist.y) {
    return 'ok_sign';
  }
  
  return null;
}

function distance(p1, p2) {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + 
    Math.pow(p1.y - p2.y, 2) + 
    Math.pow(p1.z - p2.z, 2)
  );
}

let lastGesture = null;
let lastGestureTime = 0;
let canAvatarSpeak = true; // New flag for cooldown
const AVATAR_COOLDOWN_TIME = 5000; // 5 seconds cooldown

function handleGestureDetected(gesture) {
  const now = Date.now();
  
  if (gesture !== lastGesture || now - lastGestureTime > 3000) {
    lastGesture = gesture;
    lastGestureTime = now;
    
    console.log(`🎯 Gesture detected: ${gesture}`);
    
    const gestureDetectedElement = document.getElementById('gesture-detected');
    if (gestureDetectedElement) {
        gestureDetectedElement.textContent = `Gesture: ${gesture}`;
    }
    
    if (canAvatarSpeak) {
        sendGestureToServer(gesture);
        canAvatarSpeak = false;
        setTimeout(() => {
            canAvatarSpeak = true;
        }, AVATAR_COOLDOWN_TIME);
    }
  }
}

async function sendGestureToServer(gesture) {
  try {
    const response = await fetch('/emotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        gestures: [gesture],
        emotions: [getEmotionFromGesture(gesture)]
      })
    });

    const data = await response.json();
    
    if (data.avatarResponse) {
      speakAvatarMessage(data.avatarResponse);
    }
    
  } catch (error) {
    console.error('Failed to send gesture:', error);
  }
}

const GESTURES = {
  thumbs_up: {
    description: "Thumb extended upward",
    emotion: "excited",
    accuracy: 92
  },
  thumbs_down: {
    description: "Thumb extended downward",
    emotion: "disappointed",
    accuracy: 90
  },
  open_palm: {
    description: "All fingers extended",
    emotion: "receptive",
    accuracy: 88
  },
  pointing: {
    description: "Index finger extended",
    emotion: "indicating",
    accuracy: 95
  },
  peace_sign: {
    description: "Index and middle extended",
    emotion: "happy",
    accuracy: 89
  },
  ok_sign: {
    description: "Thumb and index touching",
    emotion: "confirming",
    accuracy: 86
  },
  clapping: {
    description: "Both hands moving together",
    emotion: "celebrating",
    accuracy: 75
  }
};

function getEmotionFromGesture(gesture) {
    if (GESTURES[gesture]) {
        return GESTURES[gesture].emotion;
    }
    return "neutral";
}

export { initializeGestureRecognition };