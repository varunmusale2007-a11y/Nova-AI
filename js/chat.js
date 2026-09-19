/**
 * Aura Markdown Renderer and Chat Stream Handler
 * Converts markdown text into structured cyberpunk UI components with syntax code boxes & copy buttons
 */

class ChatRenderer {
  constructor() {
    this.setupGlobalEvents();
  }

  setupGlobalEvents() {
    // Event delegation for copy buttons
    document.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.code-copy-btn');
      if (copyBtn) {
        const codeBlock = copyBtn.closest('.code-box-wrapper').querySelector('pre code');
        if (codeBlock) {
          navigator.clipboard.writeText(codeBlock.innerText).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `<span>✓</span> <span>Copied!</span>`;
            copyBtn.classList.add('text-neon-emerald', 'border-neon-emerald');
            setTimeout(() => {
              copyBtn.innerHTML = originalHTML;
              copyBtn.classList.remove('text-neon-emerald', 'border-neon-emerald');
            }, 2000);
          }).catch(err => {
            console.error("Copy failed:", err);
          });
        }
      }
    });
  }

  escapeHTML(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  parseMarkdown(text) {
    if (!text) return "";

    let processed = text;

    // 1. Extract and format multi-line code blocks
    const codeBlocks = [];
    processed = processed.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `__CODE_BLOCK_${codeBlocks.length}__`;
      const language = lang.trim() || 'plaintext';
      const escapedCode = this.escapeHTML(code.trimEnd());
      
      const blockHTML = `
        <div class="code-box-wrapper">
          <div class="code-box-header">
            <span class="flex items-center gap-1.5 font-mono text-neon-cyan uppercase">
              <span class="w-1.5 h-1.5 rounded-full bg-neon-cyan"></span>
              ${language}
            </span>
            <button class="code-copy-btn" title="Copy code snippet">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              <span>Copy</span>
            </button>
          </div>
          <pre><code>${escapedCode}</code></pre>
        </div>
      `;
      codeBlocks.push(blockHTML);
      return id;
    });

    // 2. Headings
    processed = processed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    processed = processed.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    processed = processed.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 3. Blockquotes
    processed = processed.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // 4. Bold & Italic
    processed = processed.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
    processed = processed.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    processed = processed.replace(/__(.*?)__/gim, '<strong>$1</strong>');
    processed = processed.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    processed = processed.replace(/_(.*?)_/gim, '<em>$1</em>');

    // 5. Inline Code
    processed = processed.replace(/`([^`]+)`/g, (m, code) => `<code>${this.escapeHTML(code)}</code>`);

    // 6. Markdown Tables
    processed = processed.replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').slice(1, -1);
      const isHeaderSeparator = cells.every(c => /^[\s-:]+$/.test(c));
      if (isHeaderSeparator) return '';
      const cellHTML = cells.map(c => `<td class="border border-charcoal-border px-2.5 py-1 text-xs">${c.trim()}</td>`).join('');
      return `<tr class="hover:bg-slate-800/40">${cellHTML}</tr>`;
    });
    // Wrap table rows in table if present
    if (processed.includes('<tr')) {
      processed = processed.replace(/(<tr[\s\S]*?<\/tr>)+/g, '<div class="overflow-x-auto my-3"><table class="w-full border-collapse border border-charcoal-border text-left">$1</table></div>');
    }

    // 7. Unordered Lists
    processed = processed.replace(/^\s*[-*+]\s+(.*$)/gim, '<li>$1</li>');
    processed = processed.replace(/(<li>.*<\/li>(\n|$))+/gim, '<ul>$&</ul>');

    // 8. Ordered Lists
    processed = processed.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

    // 9. Links
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-neon-cyan hover:underline">$1</a>');

    // 10. Paragraphs and Line Breaks
    const paragraphs = processed.split(/\n{2,}/);
    processed = paragraphs.map(p => {
      p = p.trim();
      if (!p) return "";
      if (p.startsWith('<h1>') || p.startsWith('<h2>') || p.startsWith('<h3>') || p.startsWith('<ul>') || p.startsWith('<ol>') || p.startsWith('<blockquote>') || p.startsWith('<div class="overflow-x-auto') || p.startsWith('__CODE_BLOCK_')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    // 11. Restore Code Blocks
    codeBlocks.forEach((blockHTML, index) => {
      processed = processed.replace(`__CODE_BLOCK_${index}__`, blockHTML);
    });

    return processed;
  }

  renderMessage(msg, onSpeakClick) {
    const isUser = msg.role === 'user';
    const msgDiv = document.createElement('div');
    msgDiv.id = `msg-${msg.id || Date.now()}`;
    msgDiv.className = `flex flex-col space-y-1 ${isUser ? 'items-end' : 'items-start'} transition-all`;

    // Header label
    const headerDiv = document.createElement('div');
    headerDiv.className = "flex items-center space-x-2 text-[10px] font-mono text-slate-400 px-1";
    
    if (isUser) {
      headerDiv.innerHTML = `
        <span>${msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}</span>
        <span class="text-neon-cyan font-semibold">YOU</span>
      `;
    } else {
      headerDiv.innerHTML = `
        <span class="text-neon-purple font-semibold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-neon-purple"></span> AURA
        </span>
        <span>${msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}</span>
      `;
    }

    // Content Bubble
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isUser ? 'user-bubble text-slate-100' : 'assistant-bubble text-slate-200'} markdown-body`;
    bubble.innerHTML = this.parseMarkdown(msg.content);

    // Assistant message toolbar (Voice Replay, Copy message)
    const toolbar = document.createElement('div');
    toolbar.className = `flex items-center space-x-2 pt-1 px-1 text-[10px] font-mono text-slate-500 opacity-80 hover:opacity-100 ${isUser ? 'justify-end' : 'justify-start'}`;

    if (!isUser) {
      const voiceBtn = document.createElement('button');
      voiceBtn.className = "hover:text-neon-cyan transition flex items-center gap-1";
      voiceBtn.innerHTML = "<span>🔊</span> Speak";
      voiceBtn.title = "Listen to Aura's response";
      voiceBtn.addEventListener('click', () => {
        if (onSpeakClick) onSpeakClick(msg.content);
      });
      toolbar.appendChild(voiceBtn);
    }

    const copyRawBtn = document.createElement('button');
    copyRawBtn.className = "hover:text-neon-purple transition flex items-center gap-1";
    copyRawBtn.innerHTML = "<span>📋</span> Copy";
    copyRawBtn.title = "Copy message text";
    copyRawBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(msg.content);
      copyRawBtn.innerHTML = "<span>✓</span> Copied";
      setTimeout(() => { copyRawBtn.innerHTML = "<span>📋</span> Copy"; }, 1500);
    });
    toolbar.appendChild(copyRawBtn);

    msgDiv.appendChild(headerDiv);
    msgDiv.appendChild(bubble);
    msgDiv.appendChild(toolbar);

    return msgDiv;
  }
}

window.ChatRenderer = ChatRenderer;
