import { initWebRTC, sendTextMessage } from './webrtc.js';

const startBtn = document.getElementById('startBtn');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const messageInput = document.getElementById('messageInput');
const localVideo = document.getElementById('localVideo');

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
  } catch (error) {
    console.error('Error accessing media devices.', error);
  }
}

startBtn.onclick = async () => {
  await setupCamera();
  await initWebRTC();
  console.log('WebSocket connection initiated');
};

sendMessageBtn.onclick = () => {
  const message = messageInput.value;
  if (message) {
    sendTextMessage(message);
    messageInput.value = '';
  }
};