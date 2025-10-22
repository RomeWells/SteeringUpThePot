import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, MessageCircle, Zap } from 'lucide-react';

export default function AvatarPiPSystem() {
  const [isPiP, setIsPiP] = useState(false);
  const [currentStep, setCurrentStep] = useState('welcome');
  const [avatarState, setAvatarState] = useState('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [gestureDetected, setGestureDetected] = useState(null);
  const videoRef = useRef(null);
  const avatarCanvasRef = useRef(null);
  const wsRef = useRef(null);
  const mouthOpenRef = useRef(0);
  const animationRef = useRef(null);

  // Initialize WebSocket & Camera
  useEffect(() => {
    initializeSystem();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const initializeSystem = async () => {
    try {
      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}`);

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({
          type: 'init',
          userId: `user_${Date.now()}`,
          userName: 'Pet Lover',
          currentStep: 'welcome'
        }));
      };

      ws.onmessage = (e) => handleWebSocketMessage(JSON.parse(e.data));
      wsRef.current = ws;

      // Request camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' },
        audio: true 
      });
      videoRef.current.srcObject = stream;

      // Start avatar animation loop
      animateAvatar();
    } catch (error) {
      console.error('Initialization error:', error);
    }
  };

  const handleWebSocketMessage = (data) => {
    if (data.type === 'gesture-detected') {
      const emotion = data.gesture?.emotionalState || 'neutral';
      setGestureDetected(data.gesture?.gesture);
      
      // React to emotions
      if (emotion === 'excited' || emotion === 'happy') {
        setAvatarState('excited');
        speak(`That's amazing! I can see your enthusiasm!`);
      } else if (emotion === 'thinking') {
        setAvatarState('thinking');
        speak(`Take your time, I'm here to help.`);
      }
    }
  };

  // Avatar Animation - Lip Sync & Expressions
  const animateAvatar = () => {
    const canvas = avatarCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 300;
    canvas.height = 300;

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw head
      ctx.fillStyle = '#FFB347';
      ctx.beginPath();
      ctx.arc(150, 120, 70, 0, Math.PI * 2);
      ctx.fill();

      // Draw eyes based on state
      ctx.fillStyle = '#000';
      const eyeY = avatarState === 'excited' ? 100 : 110;
      const eyeSize = avatarState === 'excited' ? 8 : 6;

      // Left eye
      ctx.beginPath();
      ctx.arc(125, eyeY, eyeSize, 0, Math.PI * 2);
      ctx.fill();

      // Right eye
      ctx.beginPath();
      ctx.arc(175, eyeY, eyeSize, 0, Math.PI * 2);
      ctx.fill();

      // Draw mouth (lip sync)
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 3;
      ctx.beginPath();

      if (isSpeaking) {
        // Animate mouth when speaking
        const mouthHeight = Math.sin(mouthOpenRef.current) * 15 + 20;
        ctx.ellipse(150, 160, 25, mouthHeight, 0, 0, Math.PI * 2);
        mouthOpenRef.current += 0.15;
      } else {
        // Neutral mouth
        ctx.moveTo(130, 160);
        ctx.quadraticCurveTo(150, 165, 170, 160);
      }
      ctx.stroke();

      // Draw eyebrows based on emotion
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;

      if (avatarState === 'excited') {
        // Happy eyebrows (raised)
        ctx.beginPath();
        ctx.arc(125, 95, 3, 0, Math.PI, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(175, 95, 3, 0, Math.PI, true);
        ctx.stroke();
      } else if (avatarState === 'thinking') {
        // Thinking eyebrows (furrowed)
        ctx.beginPath();
        ctx.moveTo(110, 105);
        ctx.lineTo(140, 100);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(160, 100);
        ctx.lineTo(190, 105);
        ctx.stroke();
      }

      // Emotion label
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(avatarState.toUpperCase(), 150, 280);

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const speak = (text) => {
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1.2;
    
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const sendGestureToServer = (gesture) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'gesture',
        userId: `user_${Date.now()}`,
        gesture: gesture,
        confidence: 85,
        currentStep
      }));
    }
  };

  const launchStep = async (step) => {
    setCurrentStep(step);
    setAvatarState('excited');
    speak(`Starting ${step}! Good luck!`);

    // Send to server
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'step-update',
        userId: `user_${Date.now()}`,
        newStep: step,
        userName: 'Pet Lover'
      }));
    }

    // Launch iOS Shortcut
    launchIOSShortcut(step);
  };

  const launchIOSShortcut = (step) => {
    const shortcuts = {
      doomScroll: 'https://www.icloud.com/shortcuts/[YOUR_SHORTCUT_ID]',
      workout: 'https://www.icloud.com/shortcuts/[YOUR_SHORTCUT_ID]',
      meditation: 'https://www.icloud.com/shortcuts/[YOUR_SHORTCUT_ID]',
      reading: 'https://www.icloud.com/shortcuts/[YOUR_SHORTCUT_ID]',
    };

    const shortcutURL = shortcuts[step];
    if (shortcutURL) {
      window.location.href = shortcutURL;
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        const avatar = document.getElementById('pip-container');
        await avatar.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  const steps = [
    { id: 'doomScroll', label: '📱 Doom Scroll Through TikTok', icon: '🎵' },
    { id: 'workout', label: '💪 Quick Workout', icon: '🏋️' },
    { id: 'meditation', label: '🧘 5-Min Meditation', icon: '☮️' },
    { id: 'reading', label: '📚 Read Article', icon: '📖' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">✨ Avatar-Guided Journey</h1>
        <p className="text-blue-200 mb-8">Your AI avatar guides you through each step with real-time reactions</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Video Feed */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-black rounded-lg overflow-hidden shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full aspect-video object-cover"
              />
            </div>

            {/* Gesture Recognition Status */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Live Gesture Recognition
                </h3>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  wsConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {wsConnected ? '🟢 Connected' : '🔴 Connecting...'}
                </div>
              </div>

              {gestureDetected && (
                <div className="bg-green-900 border border-green-500 rounded p-3 text-green-100">
                  <p className="font-semibold">🎯 Gesture Detected: {gestureDetected}</p>
                  <p className="text-sm">Avatar is reacting to your expression...</p>
                </div>
              )}

              {/* Gesture Test Buttons */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <button
                  onClick={() => { sendGestureToServer('thumbs_up'); setAvatarState('excited'); }}
                  className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded text-sm font-semibold"
                >
                  👍 Thumbs Up
                </button>
                <button
                  onClick={() => { sendGestureToServer('smile'); setAvatarState('excited'); }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm font-semibold"
                >
                  😊 Smile
                </button>
                <button
                  onClick={() => { sendGestureToServer('thinking'); setAvatarState('thinking'); }}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded text-sm font-semibold"
                >
                  🤔 Thinking
                </button>
              </div>
            </div>
          </div>

          {/* Avatar Section */}
          <div className="space-y-4">
            {/* Avatar Canvas */}
            <div id="pip-container" className="bg-gradient-to-b from-blue-100 to-blue-50 rounded-lg shadow-xl p-4 border-4 border-blue-300">
              <canvas
                ref={avatarCanvasRef}
                className="w-full rounded-lg shadow-lg"
              />
              <div className="mt-4 text-center">
                <p className="text-sm font-semibold text-slate-700">Status: {isSpeaking ? '🎤 Speaking' : '😌 Listening'}</p>
              </div>
            </div>

            {/* PiP Controls */}
            <button
              onClick={togglePiP}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
            >
              <MessageCircle className="w-5 h-5" />
              {isPiP ? 'Exit' : 'Enter'} Picture-in-Picture
            </button>

            {/* Quick Actions */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-2">
              <button
                onClick={() => speak('Hello! I\'m excited to help you on this journey!')}
                className="w-full bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4" />
                Test Voice
              </button>
              <button
                onClick={() => setAvatarState('excited')}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-2 rounded font-semibold text-sm"
              >
                Show Excitement
              </button>
            </div>
          </div>
        </div>

        {/* Steps Section */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-6">🚀 Your Journey Steps</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`rounded-lg p-4 border-2 transition cursor-pointer ${
                  currentStep === step.id
                    ? 'bg-blue-600 border-blue-400'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="text-3xl mb-2">{step.icon}</div>
                <h3 className="text-white font-semibold mb-3">{step.label}</h3>
                <button
                  onClick={() => launchStep(step.id)}
                  className="w-full bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded font-semibold text-sm transition"
                >
                  🚀 Launch
                </button>
                <p className="text-xs text-slate-400 mt-2">
                  Avatar will react to your progress
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* iOS Shortcuts Info */}
        <div className="mt-8 bg-indigo-900 border border-indigo-600 rounded-lg p-6 text-white">
          <h3 className="text-xl font-bold mb-3">📱 iOS Shortcuts Integration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-blue-300 mb-2">How It Works:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Click "Launch" on any step</li>
                <li>iOS Shortcut automation opens</li>
                <li>Complete the activity</li>
                <li>Avatar receives feedback</li>
                <li>Celebrates your completion</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold text-blue-300 mb-2">Setup Shortcuts:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Open iOS Shortcuts app</li>
                <li>Create automation for each step</li>
                <li>Use x-callback-url to send data back</li>
                <li>Avatar notifies on completion</li>
                <li>Track progress in Firebase</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}