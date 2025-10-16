const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const fetch = require("node-fetch"); // for Gemini Live API calls
const cors = require("cors");
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ===== EXPRESS SETUP =====
const app = express();          // <-- Initialize app first
app.use(cors());                // <-- Now you can use cors
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// ===== FIREBASE SETUP =====
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ===== ROUTES =====

// Root
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// Health check
app.get("/health", (req, res) => res.status(200).send("ok"));

// ===== WEBRTC SIGNALING =====
app.post("/webrtc/offer", async (req, res) => {
  const { userId, sdpOffer, context } = req.body;
  console.log("Received WebRTC offer from user:", userId, context);

  // Store context in Firestore
  await db.collection("sessions").doc(userId).set({ context }, { merge: true });

  try {
    const geminiResponse = await fetch("https://api.geminilive.ai/v1/webrtc/offer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({ sdpOffer, userId, context }),
    });

    const data = await geminiResponse.json();
    const answerSdp = data.answerSdp;

    res.json({ answerSdp });
  } catch (err) {
    console.error("Gemini Live error:", err);
    res.json({ answerSdp: sdpOffer }); // fallback
  }
});

// ===== EMOTION / GESTURE LOGGING =====
app.post("/emotion", async (req, res) => {
  const { userId, emotions, gestures } = req.body;
  console.log("Emotion & gesture update:", userId, emotions, gestures);

  await db.collection("sessions").doc(userId).set({ emotions, gestures }, { merge: true });
  res.sendStatus(200);
});

// ===== STEP TRACKING =====
app.post("/step", async (req, res) => {
  const { userId, step } = req.body;
  console.log("User progressed to step:", userId, step);

  await db.collection("sessions").doc(userId).set({ step }, { merge: true });
  res.sendStatus(200);
});

// ===== START SERVER =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
