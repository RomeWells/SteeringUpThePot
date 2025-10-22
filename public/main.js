import { initWebRTC, sendTextMessage, startAudioStreaming, stopAudioStreaming, audioContext } from './webrtc.js';
import { initializeGestureRecognition } from './gestures.js';
import { db } from './firebase.js';
import { onSnapshot, doc, setDoc, serverTimestamp, collection, query, getDocs } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

const startBtn = document.getElementById('startBtn');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const messageInput = document.getElementById('messageInput');
const localVideo = document.getElementById('localVideo');
const chatContainer = document.getElementById('chat-container');
const startSpeakingBtn = document.getElementById('startSpeakingBtn');
const testStepBtn = document.getElementById('test-step-btn');

const step1Btn = document.getElementById('step1-btn');
const step2Btn = document.getElementById('step2-btn');
const step3Btn = document.getElementById('step3-btn');
const step4Btn = document.getElementById('step4-btn');
const step5Btn = document.getElementById('step5-btn');

let audioStream; // To hold the stream from getUserMedia
let userId = 'user_123'; // Replace with actual user ID

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
    audioStream = stream; // Store audio stream for recording
  } catch (error) {
    console.error('Error accessing media devices.', error);
  }
}

function displayMessage(sender, message) {
  const messageElement = document.createElement('p');
  messageElement.textContent = `${sender}: ${message}`;
  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to bottom
}

function listenForUpdates() {
  const stepsCollectionRef = collection(db, "sessions", userId, "steps");
  onSnapshot(stepsCollectionRef, (snapshot) => {
    const stepsData = {};
    snapshot.forEach((doc) => {
      stepsData[doc.id] = doc.data();
    });
    console.log("Real-time steps update:", stepsData);
    updateProgress(stepsData);
  });
}

function updateProgress(stepsData) {
    console.log("updateProgress - stepsData:", stepsData);
    let completedSteps = 0;

    const stepButtons = {
        step1: document.getElementById('step1-btn'),
        step2: document.getElementById('step2-btn'),
        step3: document.getElementById('step3-btn'),
        step4: document.getElementById('step4-btn'),
        step5: document.getElementById('step5-btn'),
    };

    for (const stepKey in stepButtons) {
        const button = stepButtons[stepKey];
        if (button) {
            const stepData = stepsData[stepKey];
            if (stepData) {
                if (stepData.status === 'completed') {
                    button.textContent = 'Completed ✅';
                    button.classList.remove('bg-primary/20', 'dark:bg-primary/30');
                    button.classList.add('bg-green-500/50', 'dark:bg-green-500/70');
                    completedSteps++;
                } else if (stepData.status === 'in_progress') {
                    button.textContent = 'In Progress...';
                    button.classList.remove('bg-primary/20', 'dark:bg-primary/30');
                    button.classList.add('bg-yellow-500/50', 'dark:bg-yellow-500/70');
                } else {
                    button.textContent = 'Launch Shortcut';
                    button.classList.remove('bg-green-500/50', 'dark:bg-green-500/70', 'bg-yellow-500/50', 'dark:bg-yellow-500/70');
                    button.classList.add('bg-primary/20', 'dark:bg-primary/30');
                }
            }
        }
    }

    console.log("updateProgress - completedSteps:", completedSteps);
    const progress = (completedSteps / 5) * 100;
    console.log("updateProgress - calculated progress:", progress);
    const progressBar = document.getElementById('progress-bar-inner');
    console.log("updateProgress - progressBar element:", progressBar);
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        console.log("updateProgress - progressBar.style.width set to:", progressBar.style.width);
    }
}

async function testStep() {
    console.log("Testing step 1...");
    const stepDocRef = doc(db, "sessions", userId, "steps", "step1");
    try {
        await setDoc(stepDocRef, {
            status: "completed",
            tiktokUrl: "https://tiktok.com/@test/video/123",
            videoTitle: "Test Video",
            completedAt: serverTimestamp()
        }, { merge: true });
        console.log("Step 1 marked as complete in Firestore.");
    } catch (e) {
        console.error("Error setting document: ", e);
    }
}

startBtn.onclick = async () => {
  const apiKey = prompt("Enter your Gemini API Key:");
  if (!apiKey) {
    console.error("API key is required to connect to Gemini Live API.");
    return;
  }
  await setupCamera();
  await initWebRTC(displayMessage, apiKey);
  await initializeGestureRecognition();
  listenForUpdates();
  console.log('WebRTC connection initiated');
};

sendMessageBtn.onclick = () => {
  const message = messageInput.value;
  if (message) {
    displayMessage("You", message);
    sendTextMessage(message);
    messageInput.value = '';
  }
};

startSpeakingBtn.onclick = () => {
  if (startSpeakingBtn.textContent === 'Start Speaking') {
    if (audioStream) {
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
      startAudioStreaming(audioStream);
      startSpeakingBtn.textContent = 'Stop Speaking';
      displayMessage("You", "[Speaking...]");
    } else {
      console.error("Audio stream not available. Please launch WebRTC connection first.");
    }
  } else {
    stopAudioStreaming();
    startSpeakingBtn.textContent = 'Start Speaking';
    displayMessage("You", "[Stopped Speaking]");
  }
};

testStepBtn.onclick = testStep;

export function speakAvatarMessage(message) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'en-US'; // Set language
    speechSynthesis.speak(utterance);
  } else {
    console.warn("Speech Synthesis not supported in this browser.");
  }
}

function launchStep(step) {
  const shortcutURLs = {
    step1: 'shortcuts://run-shortcut?name=Steering%20-%20Step%201',
    step2: 'shortcuts://run-shortcut?name=Steering%20-%20Step%202',
    step3: 'shortcuts://run-shortcut?name=Steering%20-%20Step%203',
    step4: 'shortcuts://run-shortcut?name=Steering%20-%20Step%204',
    step5: 'shortcuts://run-shortcut?name=Steering%20-%20Step%205'
  };
  
  // Update UI immediately
  const button = document.getElementById(`${step}-btn`);
  if (button) {
      button.textContent = 'In Progress...';
      button.classList.remove('bg-primary/20', 'dark:bg-primary/30');
      button.classList.add('bg-yellow-500/50', 'dark:bg-yellow-500/70');
  }

  // Get dynamic launch message from server
  fetch('/launch-step-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      step: step
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.avatarResponse) {
      speakAvatarMessage(data.avatarResponse);
    }
  })
  .catch(error => console.error('Error fetching launch step message:', error));

  // Tell server step started
  fetch('/step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      step: step,
      data: { status: 'in_progress' }
    })
  });
  
  // Launch shortcut
  window.location.href = shortcutURLs[step];
}

step1Btn.onclick = () => launchStep('step1');
step2Btn.onclick = () => launchStep('step2');
step3Btn.onclick = () => launchStep('step3');
step4Btn.onclick = () => launchStep('step4');
step5Btn.onclick = () => launchStep('step5');

function checkShortcutCallback() {
  const params = new URLSearchParams(window.location.search);
  
  if (params.has('callback')) {
    const callback = params.get('callback');
    const step = params.get('step');
    const status = params.get('status');
    const userIdFromParams = params.get('userId');

    console.log(`📱 Shortcut returned: ${callback}, ${step}`);
    
    // Make a fetch request to the server's /callback endpoint
    fetch(`/callback?userId=${userIdFromParams || userId}&step=${step}&status=${status || 'completed'}&callback=${callback}`)
      .then(response => response.json())
      .then(data => {
        if (data.avatarResponse) {
          speakAvatarMessage(data.avatarResponse);
        }
        // You might want to update UI or progress bar here based on data.message
      })
      .catch(error => console.error('Error fetching callback response:', error));

    // Clean URL
    window.history.replaceState({}, document.title, '/');
  }
}

checkShortcutCallback();