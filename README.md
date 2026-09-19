# ✨ Aura — Offline-First AI Companion

Aura is a full-stack, local-first web application designed for a **100% offline, deeply empathetic, and supportive AI companion**. It runs entirely detached from the internet on your laptop, guaranteeing absolute privacy and data sovereignty.

---

## 🎨 Visual Aesthetics & Design

- **Neo-Brutalist Cyberpunk x Premium Glassmorphism**: Deep obsidian background (`#0B0F17`), translucent charcoal panels with `backdrop-filter: blur(16px)`, solid slate borders, and glowing functional accents (`#00F2FE` Cyan & `#9B51E0` Electric Purple).
- **Interactive AI Core Sphere**: High-performance HTML5 Canvas 3D particle sphere that smoothly pulses and morphs across four responsive states:
  - `IDLE`: Gentle breathing glow with floating orbital particles.
  - `LISTENING`: Real-time reactive sonic waveform rings responding to your voice.
  - `THINKING`: High-speed electric purple particle vortex with energy sparks.
  - `SPEAKING`: Harmonic audio frequency wave oscillations synced to speech cadence.
- **Distraction-Free Chat Feed**: Markdown rendering, custom code boxes with language badges and 1-click copy buttons, smooth token-by-token streaming, and audio replay controls.

---

## 🚀 Step-by-Step Setup Guide

### 1. Download & Install Ollama (Offline LLM Engine)

1. Download Ollama for Windows, Mac, or Linux from: **[https://ollama.com](https://ollama.com)**
2. Install and launch Ollama.
3. Open your terminal or PowerShell and pull your preferred local model:
   ```bash
   # Recommended balanced model (8B parameters)
   ollama run llama3

   # Or lightweight, fast models (3B / 7B parameters)
   ollama run phi3
   ollama run mistral
   ollama run deepseek-r1
   ```
4. Verify Ollama is running locally at `http://localhost:11434`.

---

### 2. Install Python Backend Dependencies

Make sure Python 3.9+ is installed, then install the lightweight requirements:

```bash
pip install -r requirements.txt
```

*Dependencies included:*
- `fastapi` — High-performance async web framework
- `uvicorn` — ASGI server
- `httpx` — Async HTTP client for streaming local Ollama requests
- `pydantic` — Data validation and schema management

---

### 3. Launch Aura

You can launch the entire stack with a single command:

```bash
python run.py
```

Or run via Uvicorn directly:

```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Open your browser and navigate to:
**[http://localhost:8000](http://localhost:8000)**

---

## 🎙️ Offline Audio Features

- **Offline Speech-to-Text (STT)**:
  - Click the **Push-to-Talk Microphone** in the center HUD or the chat input.
  - Powered directly by browser-native speech recognition (`webkitSpeechRecognition`) with zero cloud data transmission.
- **Offline Text-to-Speech (TTS)**:
  - Aura automatically speaks responses using your operating system's local speech synthesizer (`window.speechSynthesis`).
  - Toggle voice on/off instantly via the top status bar.
  - Customize local system voice, speech rate, and pitch from the Left Control Matrix.

---

## 🧠 Aura Persona & Presets

Aura's system prompt enforces a friendly, empathetic, deeply supportive, and patient tech companion. You can switch personas on the fly:
1. **🤗 Empathetic Companion (Default)**: Warm, encouraging, breaks down hard concepts with intuitive analogies.
2. **📚 Step-by-Step Tutor**: Pedagogical structure with phased explanations and check-in questions.
3. **💻 Senior Code Mentor**: Clean, production-ready code with best practices and architecture breakdowns.
4. **⚡ Ultra-Concise**: High-density, direct technical bullet points.

---

## 💾 Local JSON Persistence

All conversation history and sessions are stored strictly on your local disk in `backend/data/history.json`.
- Multi-session conversation management
- 1-click export to Markdown (`.md`) or JSON
- Session clear and reset controls

---

## 📁 Project Architecture

```
NOVA AI/
├── backend/
│   ├── main.py              # FastAPI server, SSE streaming, Ollama proxy & static routes
│   ├── config.py            # Aura persona, default configs, Ollama host URL
│   ├── history_manager.py   # Local JSON state engine for sessions & messages
│   └── data/
│       ├── history.json     # Local persistent conversations
│       └── settings.json    # Persisted settings (voice, temp, model)
├── frontend/
│   ├── index.html           # 3-column responsive SPA layout
│   ├── css/
│   │   └── styles.css       # Neo-Brutalist Cyberpunk & Glassmorphism design tokens
│   └── js/
│       ├── sphere.js        # Canvas-rendered 3D AI Core Sphere & particle physics
│       ├── speech.js        # Offline STT & TTS audio engine
│       ├── chat.js          # Markdown renderer & syntax code blocks with copy
│       └── app.js           # Reactive application orchestrator
├── requirements.txt         # Backend Python dependencies
├── run.py                   # One-click startup script
└── README.md                # System documentation
```
