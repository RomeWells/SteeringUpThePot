
let ws;
let displayMessageCallback;
export let audioContext;
let audioQueue = [];
let isPlaying = false;

// For real-time audio streaming
let audioInput;
let processor; // Keep processor for now, will remove later if not needed
let globalAudioStream; // To hold the stream from getUserMedia
let audioWorkletNode; // Declare audioWorkletNode globally

async function playAudio(audioBlob) {
  if (!audioContext || audioContext.sampleRate !== 24000) { // Check if context exists and has correct sample rate
    if (audioContext) { // Close existing context if sample rate is wrong
      await audioContext.close();
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
  }

  audioQueue.push(audioBlob);

  if (!isPlaying) {
    processQueue();
  }
}

async function processQueue() {
  if (audioQueue.length > 0 && !isPlaying) {
    isPlaying = true;
    const audioBlob = audioQueue.shift();
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = audioContext.createBuffer(1, arrayBuffer.byteLength / 2, 24000); // Assuming 1 channel, 16-bit PCM
      const nowBuffering = audioBuffer.getChannelData(0);
      const dataView = new DataView(arrayBuffer);
      for (let i = 0; i < nowBuffering.length; i++) {
        nowBuffering[i] = dataView.getInt16(i * 2, true) / 32768; // Read 16-bit little-endian, normalize
      }
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);
      source.onended = () => {
        isPlaying = false;
        processQueue();
      };
    } catch (error) {
      console.error("Error decoding or playing audio:", error);
      isPlaying = false;
      processQueue();
    }
  }
}

export function initWebRTC(displayMessage, apiKey) {
  displayMessageCallback = displayMessage;
  if (!apiKey) {
    console.error("API key is required to connect to Gemini Live API.");
    return;
  }

  const websocketUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  ws = new WebSocket(websocketUrl);

  ws.onopen = () => {
    console.log("WebSocket connection established.");
    // Send setup message
    const setupMessage = {
      setup: {
        model: "models/gemini-2.0-flash-live-001",
        generationConfig: {
          responseModalities: ["AUDIO"]
        }
      }
    };
    ws.send(JSON.stringify(setupMessage));
  };

  ws.onmessage = (event) => {
    if (event.data instanceof Blob) {
      console.log("Received blob from Gemini:", event.data);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          console.log("Parsed blob content:", JSON.stringify(json, null, 2));
          if (json.serverContent) {
            if (json.serverContent.modelTurn && json.serverContent.modelTurn.parts) {
              const textResponse = json.serverContent.modelTurn.parts.map(part => part.text).join("");
              if (displayMessageCallback) {
                displayMessageCallback("Gemini", textResponse);
              }
              // Check for audio data within modelTurn.parts
              const audioPart = json.serverContent.modelTurn.parts.find(part => part.inlineData && part.inlineData.mimeType.startsWith('audio/'));
              if (audioPart) {
                const audioData = atob(audioPart.inlineData.data);
                const audioBlob = new Blob([Uint8Array.from(audioData.split("").map(char => char.charCodeAt(0)))], { type: audioPart.inlineData.mimeType });
                playAudio(audioBlob);
              }
            }
          }
        } catch (e) {
          console.log("Blob content is not JSON:", reader.result);
        }
      };
      reader.readAsText(event.data);
    } else if (typeof event.data === 'string') {
      try {
        const json = JSON.parse(event.data);
        console.log("Received from Gemini:", json);
      } catch (e) {
        console.error("Failed to parse JSON from string:", event.data);
      }
      } else {
      console.log("Received unexpected data from Gemini:", event.data);
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = (event) => {
    console.log("WebSocket connection closed.", event);
  };
}

export function sendTextMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const clientMessage = {
      realtimeInput: {
        text: message
      }
    };
    ws.send(JSON.stringify(clientMessage));
    console.log("Sent to Gemini:", clientMessage);
  } else {
    console.warn("WebSocket is not open. Cannot send data.");
  }
}

export async function startAudioStreaming(stream) {
  globalAudioStream = stream;
  audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

  // Load the AudioWorklet processor
  try {
    await audioContext.audioWorklet.addModule('./audio-processor.js');
  } catch (e) {
    console.error('Error loading AudioWorklet module:', e);
    return;
  }

  audioInput = audioContext.createMediaStreamSource(stream);
  audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

  audioWorkletNode.port.onmessage = (event) => {
    const pcmData = new Int16Array(event.data);
    const base64data = btoa(String.fromCharCode.apply(null, new Uint8Array(pcmData.buffer)));

    if (ws && ws.readyState === WebSocket.OPEN) {
      const clientMessage = {
        realtimeInput: {
          audio: {
            data: base64data,
            mimeType: "audio/pcm;rate=24000" // Specify PCM and rate
          }
        }
      };
      ws.send(JSON.stringify(clientMessage));
    }
  };

  audioInput.connect(audioWorkletNode);
  audioWorkletNode.connect(audioContext.destination); // Connect to destination to keep it alive
  console.log("Audio streaming started.");
}

export function stopAudioStreaming() {
  if (globalAudioStream) {
    globalAudioStream.getTracks().forEach(track => track.stop());
  }
  if (audioInput) {
    audioInput.disconnect();
  }
  if (audioWorkletNode) { // Disconnect AudioWorkletNode
    audioWorkletNode.disconnect();
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  console.log("Audio streaming stopped.");
}

export function sendAudioMessage(audioBlob) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64data = reader.result.split(',')[1];
      const clientMessage = {
        realtimeInput: {
          audio: {
            data: base64data,
            mimeType: audioBlob.type
          }
        }
      };
      ws.send(JSON.stringify(clientMessage));
      console.log("Sent audio to Gemini:", clientMessage);
    };
    reader.readAsDataURL(audioBlob);
  } else {
    console.warn("WebSocket is not open. Cannot send audio data.");
  }
}


