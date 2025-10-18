import { initWebRTC, sendTextMessage } from './webrtc.js';

const startBtn = document.getElementById('startBtn');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const messageInput = document.getElementById('messageInput');
const localVideo = document.getElementById('localVideo');
const chatContainer = document.getElementById('chat-container');

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
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
  await setupCamera();
  await initWebRTC(displayMessage);
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