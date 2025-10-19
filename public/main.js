import { initWebRTC, sendTextMessage, startAudioStreaming, stopAudioStreaming } from './webrtc.js';

const startBtn = document.getElementById('startBtn');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const messageInput = document.getElementById('messageInput');
const localVideo = document.getElementById('localVideo');
const chatContainer = document.getElementById('chat-container');
const startSpeakingBtn = document.getElementById('startSpeakingBtn');

let audioStream; // To hold the stream from getUserMedia

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

startBtn.onclick = async () => {
  const apiKey = prompt("Enter your Gemini API Key:");
  if (!apiKey) {
    console.error("API key is required to connect to Gemini Live API.");
    return;
  }
  await setupCamera();
  await initWebRTC(displayMessage, apiKey);
  console.log('WebSocket connection initiated');
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
      startAudioStreaming(audioStream);
      startSpeakingBtn.textContent = 'Stop Speaking';
      displayMessage("You", "[Speaking...]");
    } else {
      console.error("Audio stream not available. Please launch WebSocket first.");
    }
  } else {
    stopAudioStreaming();
    startSpeakingBtn.textContent = 'Start Speaking';
    displayMessage("You", "[Stopped Speaking]");
  }
};