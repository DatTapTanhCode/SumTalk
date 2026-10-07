// AudioWorklet: turns the mixed microphone (+ meeting) audio into 16 kHz mono 16-bit PCM,
// the format the backend and Whisper expect. Runs on the audio thread, posts ~100 ms blocks.
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const targetRate = (options.processorOptions && options.processorOptions.targetRate) || 16000
    this.step = sampleRate / targetRate // input samples per output sample (e.g. 48000/16000 = 3)
    this.pos = 0
    this.sum = 0
    this.count = 0
    this.block = new Int16Array(Math.round(targetRate / 10))
    this.length = 0
    this.recording = false
    this.port.onmessage = (event) => {
      this.recording = Boolean(event.data && event.data.recording)
      if (!this.recording) this.post()
    }
  }

  post() {
    if (this.length === 0) return
    const out = this.block.slice(0, this.length)
    this.port.postMessage(out, [out.buffer])
    this.length = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel || !this.recording) return true
    for (let i = 0; i < channel.length; i++) {
      // Average the input samples that fall into each output sample (the graph low-passes before this).
      this.sum += channel[i]
      this.count++
      this.pos += 1
      if (this.pos >= this.step) {
        this.pos -= this.step
        const value = Math.max(-1, Math.min(1, this.sum / this.count))
        this.sum = 0
        this.count = 0
        this.block[this.length++] = value < 0 ? value * 0x8000 : value * 0x7fff
        if (this.length === this.block.length) this.post()
      }
    }
    return true
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor)
