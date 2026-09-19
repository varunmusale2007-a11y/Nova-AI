/**
 * Aura Offline Speech Engine
 * Powered entirely by browser-native APIs:
 * - Offline STT: webkitSpeechRecognition / SpeechRecognition
 * - Offline TTS: window.speechSynthesis
 */

class SpeechEngine {
  constructor(options = {}) {
    this.onStateChange = options.onStateChange || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onError = options.onError || (() => {});

    this.isTTSActive = true;
    this.isListening = false;
    this.voiceRate = 1.0;
    this.voicePitch = 1.0;
    this.selectedVoiceURI = "";
    
    this.voices = [];
    this.synth = window.speechSynthesis;
    this.recognition = null;

    this.initTTS();
    this.initSTT();
  }

  /* ------------------- TEXT-TO-SPEECH (TTS) ------------------- */
  initTTS() {
    if (!this.synth) {
      console.warn("SpeechSynthesis API not supported in this browser.");
      return;
    }

    const loadVoices = () => {
      this.voices = this.synth.getVoices() || [];
      this.populateVoiceDropdown();
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  populateVoiceDropdown() {
    const voiceSelect = document.getElementById('voice-select');
    if (!voiceSelect) return;

    voiceSelect.innerHTML = "";
    if (this.voices.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = "Default System Voice";
      opt.value = "";
      voiceSelect.appendChild(opt);
      return;
    }

    // Filter and sort English or local natural voices first
    this.voices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — Default' : ''}`;
      
      // Auto-select preferred natural-sounding voices if available
      if (!this.selectedVoiceURI && (voice.name.includes("Natural") || voice.name.includes("Aria") || voice.name.includes("Samantha") || voice.name.includes("Jenny") || voice.default)) {
        this.selectedVoiceURI = voice.voiceURI;
        option.selected = true;
      } else if (this.selectedVoiceURI === voice.voiceURI) {
        option.selected = true;
      }

      voiceSelect.appendChild(option);
    });
  }

  setVoice(voiceURI) {
    this.selectedVoiceURI = voiceURI;
  }

  setRate(rate) {
    this.voiceRate = parseFloat(rate) || 1.0;
  }

  setPitch(pitch) {
    this.voicePitch = parseFloat(pitch) || 1.0;
  }

  toggleTTS(enabled) {
    this.isTTSActive = enabled !== undefined ? enabled : !this.isTTSActive;
    if (!this.isTTSActive) {
      this.stopSpeaking();
    }
    return this.isTTSActive;
  }

  cleanTextForSpeech(text) {
    if (!text) return "";
    return text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, " [Code block skipped] ")
      // Remove inline code
      .replace(/`([^`]+)`/g, "$1")
      // Remove markdown links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove formatting symbols like *, _, #, >
      .replace(/[#*_~>`]/g, "")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim();
  }

  speak(rawText, onEndCallback) {
    if (!this.isTTSActive || !this.synth) {
      if (onEndCallback) onEndCallback();
      return;
    }

    this.stopSpeaking();

    const cleanText = this.cleanTextForSpeech(rawText);
    if (!cleanText) {
      if (onEndCallback) onEndCallback();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = this.voiceRate;
    utterance.pitch = this.voicePitch;

    if (this.selectedVoiceURI) {
      const foundVoice = this.voices.find(v => v.voiceURI === this.selectedVoiceURI);
      if (foundVoice) utterance.voice = foundVoice;
    }

    utterance.onstart = () => {
      this.onStateChange('speaking');
    };

    utterance.onend = () => {
      this.onStateChange('idle');
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = (e) => {
      console.warn("TTS Error:", e);
      this.onStateChange('idle');
      if (onEndCallback) onEndCallback();
    };

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
      this.onStateChange('idle');
    }
  }

  /* ------------------- SPEECH-TO-TEXT (STT) ------------------- */
  initSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser.");
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStateChange('listening');
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        this.onTranscript(currentText, Boolean(finalTranscript));
      };

      this.recognition.onerror = (event) => {
        console.warn("STT Error:", event.error);
        this.isListening = false;
        this.onStateChange('idle');
        this.onError(`Microphone error: ${event.error}`);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.onStateChange('idle');
      };
    } catch (err) {
      console.error("STT Init Error:", err);
    }
  }

  toggleListening() {
    if (!this.recognition) {
      this.onError("Offline Voice Recognition is not supported by your browser engine. Please use Google Chrome or Microsoft Edge.");
      return false;
    }

    if (this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      this.onStateChange('idle');
      return false;
    } else {
      this.stopSpeaking();
      try {
        this.recognition.start();
        return true;
      } catch (err) {
        console.warn("Speech recognition already running:", err);
        return false;
      }
    }
  }
}

window.SpeechEngine = SpeechEngine;
