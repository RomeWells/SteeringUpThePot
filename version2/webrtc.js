let ws;
let displayMessageCallback;
export let audioContext;
let audioQueue = [];
let isPlaying = false;

// For real-time audio streaming
let audioInput;
let processor;
let globalAudioStream;
let audioWorkletNode;

async function playAudio(audioBlob) {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
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
    console.log("Processing audio blob:", audioBlob);
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log("ArrayBuffer created, length:", arrayBuffer.byteLength);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer); // Use decodeAudioData for proper audio decoding
      console.log("AudioBuffer decoded, duration:", audioBuffer.duration);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);
      console.log("Audio source started.");
      source.onended = () => {
        console.log("Audio playback ended.");
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

export async function initWebRTC(displayMessage, apiKey) { // Removed videoElement argument
  displayMessageCallback = displayMessage;

  // WebSocket connection
  const websocketUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  ws = new WebSocket(websocketUrl);

  ws.onopen = () => {
    console.log("WebSocket connection established.");
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
      console.log("Received blob from Gemini:", event.data, "Type:", event.data.type);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          // First, try to parse as JSON
          const json = JSON.parse(reader.result);
          console.log("Parsed blob content as JSON:", JSON.stringify(json, null, 2));

          if (json.setupComplete) {
            // Handle setup complete message
            console.log("Gemini setup complete.");
          } else if (json.serverContent) {
            if (json.serverContent.modelTurn && json.serverContent.modelTurn.parts) {
              const textResponse = json.serverContent.modelTurn.parts.map(part => part.text).join("");
              if (displayMessageCallback) {
                displayMessageCallback("Gemini", textResponse);
              }
              const audioPart = json.serverContent.modelTurn.parts.find(part => part.inlineData && part.inlineData.mimeType.startsWith('audio/'));
              if (audioPart) {
                console.log("Found audio part in Gemini response (within JSON).", audioPart);
                const audioData = atob(audioPart.inlineData.data);
                console.log("Decoded base64 audio data, length:", audioData.length);
                const pcmData = new Uint8Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                  pcmData[i] = audioData.charCodeAt(i);
                }
                console.log("Created PCM data, length:", pcmData.length);
                const wavBlob = createWaveBlob(pcmData.buffer, { sampleRate: 24000 });
                console.log("Created WAV blob:", wavBlob);
                playAudio(wavBlob);
                console.log("playAudio function called.");
              }
            }
          }
        } catch (e) {
          // If JSON parsing fails, assume it's a raw audio blob
          console.log("Blob content is not JSON, attempting to process as raw audio.", e);
          const audioDataBuffer = await event.data.arrayBuffer(); // Get ArrayBuffer directly from the blob
          console.log("Received raw audio blob, length:", audioDataBuffer.byteLength);
          const wavBlob = createWaveBlob(audioDataBuffer, { sampleRate: 24000 });
          console.log("Created WAV blob from raw audio blob:", wavBlob);
          playAudio(wavBlob);
          console.log("playAudio function called for raw audio blob.");
        }
      };
      reader.readAsText(event.data); // Still read as text initially to attempt JSON parse
    } else if (typeof event.data === 'string') {
      try {
        const json = JSON.parse(event.data);
        console.log("Received from Gemini (string JSON):", json);
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

function createWaveBlob(pcmData, options) {
  // pcmData is expected to be an ArrayBuffer
  const numChannels = options.numChannels || 1;
  const sampleRate = options.sampleRate || 24000;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample; // 1 channel * 2 bytes/sample = 2
  
  const numFrames = Math.floor(pcmData.byteLength / bytesPerSample);
  const dataSize = numFrames * blockAlign;

  // Corrected waveFileSize calculation: 12 (RIFF) + 24 (fmt) + 8 (data chunk header) + dataSize
  const waveFileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(waveFileSize);
  const view = new DataView(buffer);

  let offset = 0;

  // RIFF header
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, waveFileSize - 8, true); offset += 4; // ChunkSize
  writeString(view, offset, 'WAVE'); offset += 4;

  // fmt chunk
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
  view.setUint16(offset, 1, true); offset += 2; // AudioFormat (PCM)
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  const byteRate = sampleRate * blockAlign; // Added this line
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true); offset += 2; // BitsPerSample

  // data chunk
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

  // Write PCM data
  const pcm = new Int16Array(pcmData);
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    view.setInt16(offset, pcm[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
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
            mimeType: "audio/pcm;rate=24000"
          }
        }
      };
      ws.send(JSON.stringify(clientMessage));
    }
  };

  audioInput.connect(audioWorkletNode);
  audioWorkletNode.connect(audioContext.destination);
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