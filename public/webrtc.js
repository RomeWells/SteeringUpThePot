
let ws;

export function initWebRTC() {
  const apiKey = prompt("Enter your Gemini API Key:");
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
          responseModalities: ["TEXT"]
        }
      }
    };
    ws.send(JSON.stringify(setupMessage));
  };

  ws.onmessage = (event) => {
    if (event.data instanceof Blob) {
      console.log("Received blob from Gemini:", event.data);
      // We can try to read the blob as text to see if it contains a message
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          console.log("Parsed blob content:", JSON.stringify(json, null, 2));
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


