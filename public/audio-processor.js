class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (input.length > 0) {
      const inputData = input[0]; // Assuming mono input
      const outputData = new Int16Array(inputData.length);

      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = Math.min(1, Math.max(-1, inputData[i])) * 0x7FFF; // Convert to 16-bit PCM
      }

      // Send the processed audio data back to the main thread
      this.port.postMessage(outputData.buffer, [outputData.buffer]);
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
