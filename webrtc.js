// Minimal WebRTC test for both desktop & mobile
document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-webrtc");
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");

  if (!startBtn) return console.error("Start button not found!");

  startBtn.disabled = false; // ensure button is enabled

  startBtn.addEventListener("click", async () => {
    console.log("✅ Start AI Avatar clicked");

    // Request camera + mic
    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      console.log("🎥 Local stream started");
    } catch (err) {
      console.error("Error accessing camera/mic:", err);
      alert("Camera/mic access required");
      return;
    }

    // Create peer connection
    const pc = new RTCPeerConnection();

    // Add local tracks
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Display remote stream
    pc.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
      console.log("🖥️ Remote stream received");
    };

    // Create SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send offer to backend
    try {
      const res = await fetch("/webrtc/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user123",
          sdpOffer: offer.sdp,
          context: { step: "Start" }
        })
      });

      const data = await res.json();
      console.log("✅ SDP answer received:", data.answerSdp);

      // Set remote description
      await pc.setRemoteDescription({ type: "answer", sdp: data.answerSdp });
    } catch (err) {
      console.error("Error sending offer to backend:", err);
    }
  });
});
