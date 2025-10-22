import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

console.log("---- Server script starting ----");
console.log("GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY ? "Loaded" : "Not Loaded");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Use express.json() instead of bodyParser
app.use(express.static(path.join(__dirname, "public")));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

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

async function getGeminiTextResponse(prompt) {
  const geminiTextApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;
  console.log("Gemini Text API: Constructed URL:", geminiTextApiUrl);
  try {
    console.log("Gemini Text API: Sending prompt:", prompt);
    const response = await fetch(geminiTextApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini Text API Error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log("Gemini Text API: Raw response data:", data);
    const textResponse = data.candidates[0].content.parts[0].text;
    console.log("Gemini Text API: Parsed text response:", textResponse);
    return textResponse;

  } catch (error) {
    console.error("❌ Error calling Gemini Text API:", error);
    return null;
  }
}

// Handle gesture and emotion data
app.post('/emotion', async (req, res) => {
  const { userId, gestures, emotions } = req.body;
  console.log(`Received emotion data for user ${userId}:`, { gestures, emotions });

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    console.log(`Entering try block for /emotion endpoint for user ${userId}`);
    const docRef = db.collection('sessions').doc(userId);
    console.log(`Attempting to update session ${userId} with gestures: ${gestures} and emotions: ${emotions}`);
    await docRef.set({
      gestures: admin.firestore.FieldValue.arrayUnion(...gestures),
      emotions: admin.firestore.FieldValue.arrayUnion(...emotions),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`Successfully updated session ${userId} with emotion data.`);

    // Generate avatar response using Gemini
    const geminiPrompt = `The user just made a ${gestures[0]} gesture, indicating they are ${emotions[0]}. Respond positively and encouragingly, making sure to factor in their ${emotions[0]} mood. Keep the response concise and directly acknowledge their action.`;
    const avatarResponse = await getGeminiTextResponse(geminiPrompt);
    console.log("Emotion endpoint: Avatar response from Gemini:", avatarResponse);

    res.json({ success: true, message: "Emotion data saved", avatarResponse: avatarResponse });
  } catch (error) {
    console.error("❌❌❌ Error saving emotion data to Firestore: ", error);
    res.status(500).json({ error: "Failed to save emotion data" });
  }
});

app.post('/step', async (req, res) => {
  const { userId, step, data } = req.body;
  console.log(`Received step data for user ${userId}:`, { step, data });

  if (!userId || !step) {
    return res.status(400).json({ error: "userId and step are required" });
  }

  try {
    const docRef = db.collection('sessions').doc(userId);
    await docRef.collection('steps').doc(step).set({
        ...data,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({ success: true, message: "Step data saved" });
  } catch (error) {
    console.error("Error saving step data to Firestore:", error);
    res.status(500).json({ error: "Failed to save step data" });
  }
});

app.post('/launch-step-message', async (req, res) => {
  const { userId, step } = req.body;
  console.log(`Received launch step message request for user ${userId}, step ${step}`);

  if (!userId || !step) {
    return res.status(400).json({ error: "userId and step are required" });
  }

  try {
    const sessionDocRef = db.collection('sessions').doc(userId);
    const sessionDoc = await sessionDocRef.get();
    const lastEmotion = sessionDoc.exists ? (sessionDoc.data().emotions ? sessionDoc.data().emotions[sessionDoc.data().emotions.length - 1] : 'neutral') : 'neutral';

    const geminiPrompt = `The user is about to start step ${step} which is about ${serverStepNames[step]}. Their current mood is ${lastEmotion}. Provide a short, encouraging message to start this step, factoring in their mood. Keep it concise.`;
    const avatarResponse = await getGeminiTextResponse(geminiPrompt);

    res.json({ success: true, avatarResponse: avatarResponse });

  } catch (error) {
    console.error("❌ Error generating launch step message:", error);
    res.status(500).json({ error: "Failed to generate launch step message" });
  }
});

// Handle iOS Shortcut callbacks
app.get('/callback', async (req, res) => {
  const { userId, step, status, ...callbackData } = req.query;
  
  console.log(`📱 Shortcut callback: ${step}`, callbackData);

  if (!userId || !step) {
    return res.status(400).json({ error: "userId and step are required" });
  }

  try {
    await db.collection('sessions').doc(userId).collection('steps').doc(step).set({
      ...callbackData,
      status: status || 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Update stepHistory in the main session document
    await db.collection('sessions').doc(userId).update({
      step: step,
      stepHistory: admin.firestore.FieldValue.arrayUnion({
        step: step,
        status: 'completed',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      })
    });

    // Get current response count for this step
    const stepDocRef = db.collection('sessions').doc(userId).collection('steps').doc(step);
    const stepDoc = await stepDocRef.get();
    const currentResponseCount = stepDoc.exists ? (stepDoc.data().responseCount || 0) : 0;

    // Select a motivational message
    const messages = stepMotivationalMessages[step];
    const selectedMessage = messages[currentResponseCount % messages.length];

    // Increment response count and save back to Firestore
    await stepDocRef.set({ responseCount: currentResponseCount + 1 }, { merge: true });

    const message = avatarResponses[step] || "Step completed!";

    // Use the selected motivational message as avatarResponse
    res.json({ success: true, message: message, avatarResponse: selectedMessage });

  } catch (error) {
    console.error('❌ Callback error:', error);
    res.status(500).json({ error: "Failed to process callback" });
  }
});

// Fallback for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const PORT = process.env.PORT || 8084;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});