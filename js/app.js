/**
 * Aura AI Companion Main Application Controller
 * Orchestrates local state, streaming responses, audio engines & UI interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Subsystems
  const sphere = new AuraSphere('aura-canvas');
  const chatRenderer = new ChatRenderer();
  
  let currentSessionId = 'default-session';
  let activeSessionData = null;
  let isGenerating = false;
  let abortController = null;

  // Persona Prompt Templates
  const PERSONA_PROMPTS = {
    empathetic: `You are Aura, a friendly, empathetic, deeply supportive, and patient AI companion.
You are running 100% locally and offline on the user's laptop, ensuring absolute privacy and data sovereignty.
Your core traits:
1. Empathy & Warmth: Always greet and respond with warmth, encouragement, and genuine care. Validate the user's curiosity and emotions.
2. Step-by-Step Guidance: When breaking down technical or complex questions, guide the user step-by-step with clear, bite-sized explanations.
3. Clarity & Simplicity: Avoid unnecessary jargon unless requested. Use intuitive analogies to explain hard concepts.
4. Clean Structure: Use concise markdown formatting, bullet points, and code blocks with syntax tags where helpful.
5. Patience: Never rush the user. Offer helpful follow-up thoughts to help them learn at their own pace.`,
    
    tutor: `You are Aura in Step-by-Step Tutor Mode.
Your primary goal is pedagogical clarity. Whenever the user asks any question or presents a topic:
1. Break down the concept into numbered, logical phases or steps (Phase 1, Phase 2, etc.).
2. Use everyday physical analogies to make abstract or intimidating concepts completely intuitive.
3. Include a short 'Check Your Understanding' question at the end to keep learning interactive and enjoyable.`,
    
    code: `You are Aura in Senior Code Mentor Mode.
You are a master software engineer and architectural advisor.
1. Provide clean, modern, and production-ready code with best practices and comments.
2. Explain architectural trade-offs and performance implications.
3. Format all code cleanly in fenced code blocks with appropriate language tags.
4. If debugging, pinpoint the exact root cause first, then offer the corrected code with explanation.`,
    
    concise: `You are Aura in Ultra-Concise Mode.
Deliver direct, laser-focused answers with zero conversational fluff.
Use bullet points, exact commands, and high-density technical summaries.`
  };

  let activeSystemPrompt = PERSONA_PROMPTS.empathetic;

  // 2. Initialize Offline Speech Engine
  const speechEngine = new SpeechEngine({
    onStateChange: (newState) => {
      sphere.setState(newState);
      if (newState === 'listening') {
        updateMicUI(true);
      } else if (newState === 'idle') {
        updateMicUI(false);
      }
    },
    onTranscript: (text, isFinal) => {
      const transcriptPreview = document.getElementById('speech-transcript-preview');
      const chatInput = document.getElementById('chat-input');
      
      if (transcriptPreview) {
        transcriptPreview.textContent = text ? `"${text}"` : '';
      }
      if (chatInput) {
        chatInput.value = text;
        autoResizeTextarea(chatInput);
      }

      if (isFinal && text.trim().length > 0) {
        setTimeout(() => {
          if (!isGenerating) {
            handleSendMessage();
          }
        }, 600);
      }
    },
    onError: (err) => {
      showToast(err, 'error');
    }
  });

  // 3. UI Element References
  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const micBtn = document.getElementById('mic-btn');
  const inlineMicBtn = document.getElementById('inline-mic-btn');
  const quickTtsToggle = document.getElementById('quick-tts-toggle');
  const ttsIcon = document.getElementById('tts-icon');
  const ttsQuickLabel = document.getElementById('tts-quick-label');
  const ollamaPulseDot = document.getElementById('ollama-pulse-dot');
  const ollamaStatusText = document.getElementById('ollama-status-text');
  const ollamaLatencyBadge = document.getElementById('ollama-latency-badge');
  const modelSelect = document.getElementById('model-select');
  const modelCountLabel = document.getElementById('model-count-label');
  const refreshOllamaBtn = document.getElementById('refresh-ollama-btn');
  const temperatureSlider = document.getElementById('temperature-slider');
  const tempValue = document.getElementById('temp-value');
  const voiceSelect = document.getElementById('voice-select');
  const voiceRateSlider = document.getElementById('voice-rate');
  const rateValue = document.getElementById('rate-value');
  const voicePitchSlider = document.getElementById('voice-pitch');
  const pitchValue = document.getElementById('pitch-value');
  const testVoiceBtn = document.getElementById('test-voice-btn');
  const stopVoiceBtn = document.getElementById('stop-voice-btn');
  const sessionList = document.getElementById('session-list');
  const newSessionBtn = document.getElementById('new-session-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const clearCurrentChatBtn = document.getElementById('clear-current-chat-btn');
  const exportSessionBtn = document.getElementById('export-session-btn');
  const activeChatTitle = document.getElementById('active-chat-title');
  const tokenStreamSpeed = document.getElementById('token-stream-speed');
  const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
  const leftPanel = document.getElementById('left-panel');
  const closeLeftPanel = document.getElementById('close-left-panel');

  // 4. Notifications / Toasts
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const borderCol = type === 'error' ? 'border-rose-500 text-rose-300' : 'border-neon-cyan text-slate-200';
    toast.className = `toast-msg flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-charcoal/95 border ${borderCol} shadow-lg text-xs font-mono`;
    toast.innerHTML = `
      <span>${type === 'error' ? '⚠️' : '⚡'}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  // 5. Backend Status & Ollama Prober
  async function checkOllamaStatus() {
    try {
      const resp = await fetch('/api/status');
      const data = await resp.json();

      if (data.online) {
        ollamaPulseDot.className = "w-2.5 h-2.5 rounded-full bg-neon-emerald animate-pulse shadow-[0_0_8px_#10B981]";
        ollamaStatusText.textContent = `Ollama Online (${data.model_count} models)`;
        ollamaStatusText.className = "text-xs font-mono text-neon-emerald";
        ollamaLatencyBadge.textContent = `${data.latency_ms} ms`;
        ollamaLatencyBadge.className = "text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-neon-emerald border border-emerald-800/60";

        if (data.models && data.models.length > 0) {
          modelCountLabel.textContent = `${data.models.length} installed`;
          const currentVal = modelSelect.value;
          modelSelect.innerHTML = "";
          data.models.forEach(modelName => {
            const opt = document.createElement('option');
            opt.value = modelName;
            opt.textContent = modelName;
            if (modelName === currentVal || modelName.includes("llama3")) {
              opt.selected = true;
            }
            modelSelect.appendChild(opt);
          });
        }
      } else {
        ollamaPulseDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
        ollamaStatusText.textContent = "Offline Simulation Mode";
        ollamaStatusText.className = "text-xs font-mono text-amber-400";
        ollamaLatencyBadge.textContent = "Standby";
        ollamaLatencyBadge.className = "text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60";
        modelCountLabel.textContent = "Standby mode";
      }
    } catch (err) {
      ollamaPulseDot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
      ollamaStatusText.textContent = "Backend Connection Offline";
      ollamaLatencyBadge.textContent = "Error";
    }
  }

  // 6. Settings & Sessions Synchronization
  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();
      if (settings.temperature !== undefined) {
        temperatureSlider.value = settings.temperature;
        tempValue.textContent = settings.temperature;
      }
      if (settings.model && modelSelect) {
        modelSelect.value = settings.model;
      }
      if (settings.auto_tts !== undefined) {
        updateTTSUI(settings.auto_tts);
      }
      if (settings.voice_rate !== undefined) {
        voiceRateSlider.value = settings.voice_rate;
        rateValue.textContent = `${settings.voice_rate}x`;
        speechEngine.setRate(settings.voice_rate);
      }
      if (settings.voice_pitch !== undefined) {
        voicePitchSlider.value = settings.voice_pitch;
        pitchValue.textContent = settings.voice_pitch;
        speechEngine.setPitch(settings.voice_pitch);
      }
    } catch (err) {
      console.warn("Could not load backend settings:", err);
    }
  }

  async function saveSetting(key, val) {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: val })
      });
    } catch (err) {
      console.warn("Error saving setting:", err);
    }
  }

  async function loadSessions() {
    try {
      const res = await fetch('/api/sessions');
      const sessions = await res.json();
      renderSessionList(sessions);
      if (sessions.length > 0) {
        if (!sessions.find(s => s.id === currentSessionId)) {
          currentSessionId = sessions[0].id;
        }
        await loadSessionMessages(currentSessionId);
      }
    } catch (err) {
      console.warn("Error loading sessions:", err);
    }
  }

  function renderSessionList(sessions) {
    if (!sessionList) return;
    sessionList.innerHTML = "";

    sessions.forEach(sess => {
      const item = document.createElement('div');
      const isActive = sess.id === currentSessionId;
      item.className = `group flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs font-mono transition border ${
        isActive 
          ? 'bg-neon-purple/15 border-neon-purple/50 text-white font-medium shadow-[0_0_10px_rgba(155,81,224,0.2)]' 
          : 'bg-obsidian/70 border-charcoal-border hover:border-slate-700 text-slate-300'
      }`;

      item.innerHTML = `
        <div class="flex items-center space-x-2 truncate">
          <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-neon-purple' : 'bg-slate-600'}"></span>
          <span class="truncate">${sess.title || 'Untitled Session'}</span>
        </div>
        <button class="delete-session-btn opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition" title="Delete session">
          ✕
        </button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-session-btn')) {
          e.stopPropagation();
          deleteSession(sess.id);
          return;
        }
        if (currentSessionId !== sess.id) {
          currentSessionId = sess.id;
          renderSessionList(sessions);
          loadSessionMessages(sess.id);
        }
      });

      sessionList.appendChild(item);
    });
  }

  async function loadSessionMessages(sessionId) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) return;
      activeSessionData = await res.json();
      
      if (activeChatTitle) {
        activeChatTitle.textContent = activeSessionData.title || "Aura Stream Feed";
      }

      chatMessages.innerHTML = "";
      (activeSessionData.messages || []).forEach(msg => {
        const rendered = chatRenderer.renderMessage(msg, (text) => {
          speechEngine.speak(text);
        });
        chatMessages.appendChild(rendered);
      });

      scrollToBottom();
    } catch (err) {
      console.warn("Failed to load session messages:", err);
    }
  }

  async function createNewSession() {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: "New Conversation" })
      });
      const newSess = await res.json();
      currentSessionId = newSess.id;
      await loadSessions();
      showToast("Created fresh conversation session", "info");
    } catch (err) {
      showToast("Could not create session", "error");
    }
  }

  async function deleteSession(sessionId) {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      await loadSessions();
      showToast("Session removed", "info");
    } catch (err) {
      showToast("Failed to delete session", "error");
    }
  }

  async function clearAllSessions() {
    if (!confirm("Are you sure you want to clear all conversation history?")) return;
    try {
      await fetch('/api/history', { method: 'DELETE' });
      currentSessionId = 'default-session';
      await loadSessions();
      showToast("All conversation sessions cleared", "info");
    } catch (err) {
      showToast("Failed to clear history", "error");
    }
  }

  // 7. Textarea Auto-Resize & Scrolling
  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // 8. Streaming Chat Submission
  async function handleSendMessage(customPrompt = null) {
    const text = customPrompt || chatInput.value.trim();
    if (!text || isGenerating) return;

    chatInput.value = "";
    autoResizeTextarea(chatInput);
    document.getElementById('speech-transcript-preview').textContent = "";

    // 1. Render User Message Instantly
    const userMsgObj = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    chatMessages.appendChild(chatRenderer.renderMessage(userMsgObj));
    scrollToBottom();

    // 2. Prepare Assistant Streaming Message Shell
    isGenerating = true;
    sphere.setState('thinking');
    updateSendButton(true);

    const assistantMsgId = `asst-${Date.now()}`;
    const assistantContainer = document.createElement('div');
    assistantContainer.id = `msg-${assistantMsgId}`;
    assistantContainer.className = "flex flex-col space-y-1 items-start transition-all";
    
    assistantContainer.innerHTML = `
      <div class="flex items-center space-x-2 text-[10px] font-mono text-slate-400 px-1">
        <span class="text-neon-purple font-semibold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-neon-purple animate-ping"></span> AURA
        </span>
        <span>Streaming...</span>
      </div>
      <div class="message-bubble assistant-bubble text-slate-200 markdown-body streaming-cursor">
        <span class="text-slate-400 font-mono text-xs">Synthesizing thoughts...</span>
      </div>
    `;
    chatMessages.appendChild(assistantContainer);
    scrollToBottom();

    const bubble = assistantContainer.querySelector('.message-bubble');
    let accumulatedText = "";
    let startTime = Date.now();
    let tokenCount = 0;

    abortController = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: currentSessionId,
          model: modelSelect ? modelSelect.value : 'llama3',
          temperature: parseFloat(temperatureSlider.value) || 0.7,
          system_prompt: activeSystemPrompt
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.replace('data: ', '').trim();
            if (!jsonStr) continue;
            try {
              const data = JSON.parse(jsonStr);
              if (data.token) {
                accumulatedText += data.token;
                tokenCount++;
                bubble.innerHTML = chatRenderer.parseMarkdown(accumulatedText);
                scrollToBottom();

                // Live Speed Indicator
                const elapsedSec = (Date.now() - startTime) / 1000;
                const tokPerSec = (tokenCount / (elapsedSec || 0.1)).toFixed(1);
                tokenStreamSpeed.textContent = `Streaming: ${tokPerSec} tok/s`;
              }
              if (data.done) {
                if (data.full_response) accumulatedText = data.full_response;
              }
            } catch (err) {
              console.warn("SSE parse error:", err);
            }
          }
        }
      }

      // Finish streaming UI
      bubble.classList.remove('streaming-cursor');
      bubble.innerHTML = chatRenderer.parseMarkdown(accumulatedText);
      
      // Update session title & list
      await loadSessions();

      // Trigger Offline TTS if active
      if (speechEngine.isTTSActive) {
        speechEngine.speak(accumulatedText, () => {
          sphere.setState('idle');
        });
      } else {
        sphere.setState('idle');
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        bubble.classList.remove('streaming-cursor');
        bubble.innerHTML = `<span class="text-rose-400 font-mono text-xs">⚠️ Connection error: ${err.message}</span>`;
        sphere.setState('idle');
      }
    } finally {
      isGenerating = false;
      updateSendButton(false);
      tokenStreamSpeed.textContent = `Offline Latency: ~0ms`;
    }
  }

  function updateSendButton(generating) {
    if (generating) {
      sendBtn.innerHTML = `<svg class="w-4 h-4 text-rose-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>`;
      sendBtn.title = "Stop generating";
    } else {
      sendBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
      sendBtn.title = "Send message";
    }
  }

  function updateMicUI(listening) {
    const micRipple = document.getElementById('mic-ripple');
    const micIcon = document.getElementById('mic-icon');
    const micInstruction = document.getElementById('mic-instruction');

    if (listening) {
      if (micBtn) micBtn.classList.add('border-neon-emerald', 'shadow-[0_0_30px_rgba(16,185,129,0.6)]');
      if (micRipple) micRipple.style.opacity = '1';
      if (micIcon) micIcon.classList.add('text-neon-emerald');
      if (micInstruction) micInstruction.textContent = "Listening... Speak clearly to Aura";
    } else {
      if (micBtn) micBtn.classList.remove('border-neon-emerald', 'shadow-[0_0_30px_rgba(16,185,129,0.6)]');
      if (micRipple) micRipple.style.opacity = '0';
      if (micIcon) micIcon.classList.remove('text-neon-emerald');
      if (micInstruction) micInstruction.textContent = "Click microphone to speak or type in the chat feed";
    }
  }

  function updateTTSUI(active) {
    if (active) {
      ttsIcon.textContent = "🔊";
      ttsQuickLabel.textContent = "VOICE ON";
      quickTtsToggle.classList.remove('border-charcoal-border', 'text-slate-500');
      quickTtsToggle.classList.add('border-neon-cyan', 'text-neon-cyan');
    } else {
      ttsIcon.textContent = "🔇";
      ttsQuickLabel.textContent = "VOICE OFF";
      quickTtsToggle.classList.remove('border-neon-cyan', 'text-neon-cyan');
      quickTtsToggle.classList.add('border-charcoal-border', 'text-slate-500');
    }
  }

  // 9. Event Listeners Wire-up
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isGenerating) {
      if (abortController) abortController.abort();
      return;
    }
    handleSendMessage();
  });

  chatInput.addEventListener('input', () => {
    autoResizeTextarea(chatInput);
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Voice Mic Buttons
  micBtn.addEventListener('click', () => {
    speechEngine.toggleListening();
  });

  inlineMicBtn.addEventListener('click', () => {
    speechEngine.toggleListening();
  });

  // Quick Voice Toggle
  quickTtsToggle.addEventListener('click', () => {
    const nowActive = speechEngine.toggleTTS();
    updateTTSUI(nowActive);
    saveSetting('auto_tts', nowActive);
    showToast(`Voice Output ${nowActive ? 'Enabled' : 'Muted'}`, 'info');
  });

  // Persona Presets Click Handlers
  document.querySelectorAll('.persona-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.persona-btn').forEach(b => {
        b.className = "persona-btn px-2 py-1.5 rounded-lg text-[10px] font-mono border border-charcoal-border bg-charcoal text-slate-300 hover:border-neon-purple text-left";
      });
      btn.className = "persona-btn active px-2 py-1.5 rounded-lg text-[10px] font-mono border border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan text-left";
      
      const pKey = btn.dataset.persona;
      activeSystemPrompt = PERSONA_PROMPTS[pKey] || PERSONA_PROMPTS.empathetic;
      saveSetting('system_prompt', activeSystemPrompt);
      showToast(`Persona switched to: ${btn.textContent.trim()}`, 'info');
    });
  });

  // Quick Model Switcher Pills
  document.querySelectorAll('.model-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const modelName = pill.dataset.model;
      if (modelSelect) {
        // Add if not present
        if (!Array.from(modelSelect.options).some(o => o.value === modelName)) {
          const opt = document.createElement('option');
          opt.value = modelName;
          opt.textContent = modelName;
          modelSelect.appendChild(opt);
        }
        modelSelect.value = modelName;
        saveSetting('model', modelName);
        showToast(`Selected model: ${modelName}`, 'info');
      }
    });
  });

  // Quick Prompt Suggestion Pills
  document.querySelectorAll('.quick-prompt-btn').forEach(pill => {
    pill.addEventListener('click', () => {
      const promptText = pill.querySelector('span:last-child').textContent;
      chatInput.value = promptText;
      handleSendMessage(promptText);
    });
  });

  // Temperature Slider
  temperatureSlider.addEventListener('input', (e) => {
    tempValue.textContent = e.target.value;
  });
  temperatureSlider.addEventListener('change', (e) => {
    saveSetting('temperature', parseFloat(e.target.value));
  });

  // Voice Select Dropdown
  if (voiceSelect) {
    voiceSelect.addEventListener('change', (e) => {
      speechEngine.setVoice(e.target.value);
      saveSetting('selected_voice', e.target.value);
    });
  }

  // Voice Rate & Pitch
  voiceRateSlider.addEventListener('input', (e) => {
    rateValue.textContent = `${e.target.value}x`;
    speechEngine.setRate(e.target.value);
  });
  voiceRateSlider.addEventListener('change', (e) => {
    saveSetting('voice_rate', parseFloat(e.target.value));
  });

  voicePitchSlider.addEventListener('input', (e) => {
    pitchValue.textContent = e.target.value;
    speechEngine.setPitch(e.target.value);
  });
  voicePitchSlider.addEventListener('change', (e) => {
    saveSetting('voice_pitch', parseFloat(e.target.value));
  });

  // Voice Test & Stop
  testVoiceBtn.addEventListener('click', () => {
    speechEngine.speak("Hello! I am Aura, your offline empathetic AI companion. Speech synthesis is running smoothly on your laptop.");
  });

  stopVoiceBtn.addEventListener('click', () => {
    speechEngine.stopSpeaking();
  });

  // Ollama Refresh Button
  refreshOllamaBtn.addEventListener('click', () => {
    checkOllamaStatus();
    showToast("Refreshed Ollama engine status", "info");
  });

  // Sessions Buttons
  newSessionBtn.addEventListener('click', () => createNewSession());
  clearHistoryBtn.addEventListener('click', () => clearAllSessions());
  clearCurrentChatBtn.addEventListener('click', async () => {
    if (!confirm("Clear messages in the current session?")) return;
    try {
      await fetch(`/api/sessions/${currentSessionId}`, { method: 'DELETE' });
      await createNewSession();
    } catch (err) {
      console.warn(err);
    }
  });

  // Model Pull Handler
  const pullModelBtn = document.getElementById('pull-model-btn');
  const pullModelInput = document.getElementById('pull-model-input');
  const pullProgressBarContainer = document.getElementById('pull-progress-bar-container');
  const pullProgressFill = document.getElementById('pull-progress-fill');
  const pullProgressText = document.getElementById('pull-progress-text');
  const pullPercentText = document.getElementById('pull-percent-text');
  const pullStatusBadge = document.getElementById('pull-status-badge');

  async function handlePullModel(modelName) {
    const target = modelName || (pullModelInput ? pullModelInput.value.trim() : "");
    if (!target) {
      showToast("Enter a model name to download (e.g. llama3.2:1b)", "error");
      return;
    }

    if (pullProgressBarContainer) pullProgressBarContainer.classList.remove('hidden');
    if (pullStatusBadge) {
      pullStatusBadge.textContent = "Downloading...";
      pullStatusBadge.className = "text-[9px] font-mono text-neon-cyan";
    }
    if (pullModelBtn) pullModelBtn.disabled = true;

    try {
      const resp = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: target })
      });

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', '').trim());
              if (data.status) {
                if (pullProgressText) pullProgressText.textContent = data.status;
              }
              if (data.total && data.completed) {
                const percent = Math.round((data.completed / data.total) * 100);
                if (pullProgressFill) pullProgressFill.style.width = `${percent}%`;
                if (pullPercentText) pullPercentText.textContent = `${percent}%`;
              }
            } catch (err) {}
          }
        }
      }

      if (pullStatusBadge) {
        pullStatusBadge.textContent = "Installed!";
        pullStatusBadge.className = "text-[9px] font-mono text-neon-emerald";
      }
      showToast(`Model ${target} successfully downloaded and installed!`, "info");
      await checkOllamaStatus();
    } catch (err) {
      if (pullStatusBadge) {
        pullStatusBadge.textContent = "Error";
        pullStatusBadge.className = "text-[9px] font-mono text-rose-400";
      }
      showToast(`Download error: ${err.message}`, "error");
    } finally {
      if (pullModelBtn) pullModelBtn.disabled = false;
      setTimeout(() => {
        if (pullProgressBarContainer) pullProgressBarContainer.classList.add('hidden');
        if (pullStatusBadge) {
          pullStatusBadge.textContent = "Ready";
          pullStatusBadge.className = "text-[9px] font-mono text-slate-500";
        }
      }, 5000);
    }
  }

  if (pullModelBtn) {
    pullModelBtn.addEventListener('click', () => handlePullModel());
  }
  if (pullModelInput) {
    pullModelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handlePullModel();
    });
  }

  // Export Session to Markdown
  exportSessionBtn.addEventListener('click', async () => {
    try {
      const res = await fetch(`/api/export/${currentSessionId}?format=markdown`);
      const data = await res.json();
      const blob = new Blob([data.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `aura_session_${currentSessionId}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Conversation exported to Markdown", "info");
    } catch (err) {
      showToast("Export failed", "error");
    }
  });

  // Mobile Left Panel Slide Toggle
  if (toggleSettingsBtn && leftPanel) {
    toggleSettingsBtn.addEventListener('click', () => {
      leftPanel.classList.toggle('-translate-x-full');
    });
  }
  if (closeLeftPanel && leftPanel) {
    closeLeftPanel.addEventListener('click', () => {
      leftPanel.classList.add('-translate-x-full');
    });
  }

  // 10. Startup Sequences
  checkOllamaStatus();
  loadSettings();
  loadSessions();
  
  // Periodic ping every 12 seconds
  setInterval(checkOllamaStatus, 12000);
});
