import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

console.log("---- Server script starting ----");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Use express.json() instead of bodyParser
app.use(express.static(path.join(__dirname, "public")));

// WebRTC connection endpoint
app.post("/webrtc/connect", async (req, res) => {
  console.log("✅ POST /webrtc/connect endpoint hit");
  try {
    const offerSdp = req.body.sdp;
    if (!offerSdp) {
      return res.status(400).json({ error: "SDP offer is missing" });
    }

    const googleApiUrl = 'https://gemini.googleapis.com/v1/liveSessions:create?model=gemini-live-1';

    console.log("Forwarding offer to Google API...");
    const response = await fetch(googleApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GOOGLE_API_KEY}`,
        'Content-Type': 'application/sdp',
      },
      body: offerSdp,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Google API Error:", response.status, errorText);
      return res.status(response.status).json({ error: "Failed to connect to Gemini API", details: errorText });
    }

    const answerSdp = await response.text();
    console.log("✅ Received SDP answer from Google API.");
    res.json({ sdp: answerSdp });

  } catch (error) {
    console.error("❌ Internal Server Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Fallback for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const PORT = process.env.PORT || 8083;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});