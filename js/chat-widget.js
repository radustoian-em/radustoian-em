/**
 * NLWeb Conversational AI Chat Widget for radustoian.com
 * Protocol: NLWeb v0.1 (/ask endpoint handled by Cloudflare Worker mcp-server + Gemini)
 * 
 * Features:
 * - Server-side Gemini 3.5 Flash Lite synthesis via the Cloudflare Worker (/ask)
 * - Zero client-side API keys or credentials
 * - Direct grounding against live NLWeb dynamic retrieval engine
 * - Real-time Server-Sent Events (SSE) streaming with non-streaming JSON fallback
 * - Multi-turn conversational context decontextualization (via `prev` parameter)
 * - Grounded Schema.org citation chips and link rendering
 * - Client & server-side safety guardrails and 5-question session limit
 * - Dark glassmorphic UI matching site aesthetic
 * - Full a11y keyboard controls, ARIA attributes, and session persistence
 */

(function initNLWebChatWidget() {
  'use strict';

  // Prevent multiple initializations
  if (document.getElementById('nlwebChatDialog')) return;

  // Resolve endpoint dynamically (works on radustoian.com, preview URLs, and localhost)
  // The Cloudflare Worker (mcp-server) handles both NLWeb retrieval and Gemini API synthesis server-side.
  const isProduction = window.location.hostname === 'radustoian.com' || window.location.hostname === 'www.radustoian.com';
  const NLWEB_BASE_URL = isProduction ? '' : 'https://radustoian.com';
  const ASK_ENDPOINT = `${NLWEB_BASE_URL}/ask`;

  // Storage key for session persistence
  const STORAGE_KEY = 'nlweb_chat_history_v2';

  // Safety & Anti-Abuse Configuration
  const MAX_INPUT_CHARS = 300;
  const MAX_SESSION_QUESTIONS = 5;
  const COOLDOWN_MS = 2500;
  const SESSION_QUERY_COUNT_KEY = 'nlweb_query_count_v1';
  const LIMIT_REACHED_MESSAGE = "You've reached the free limit of 5 questions about Radu. If you're interested to find out more reach out on LinkedIn https://www.linkedin.com/in/radustoian";
  let lastSubmitTime = 0;

  // Typewriter Speed Configuration: 5 words per second (200ms per word)
  const WORDS_PER_SECOND = 5;
  const WORD_TICK_MS = 1000 / WORDS_PER_SECOND;

  // Session query counter helpers
  function getSessionQueryCount() {
    try {
      return parseInt(sessionStorage.getItem(SESSION_QUERY_COUNT_KEY) || '0', 10);
    } catch (e) {
      return 0;
    }
  }

  function incrementSessionQueryCount() {
    try {
      const count = getSessionQueryCount() + 1;
      sessionStorage.setItem(SESSION_QUERY_COUNT_KEY, count.toString());
      return count;
    } catch (e) {
      return 1;
    }
  }

  // Icons SVG definitions
  const ICONS = {
    sparkle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    citation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`
  };

  // State
  let isOpen = false;
  let isGenerating = false;
  let isStreaming = false;
  let streamingTimer = null;
  let activeAbortController = null;
  let prevQuery = '';
  let messages = [];

  // Helper: Update Send Button Enabled State
  function updateSendBtnState() {
    const input = document.getElementById('nlwebTextInput');
    const sendBtn = document.getElementById('nlwebSendBtn');
    if (input && sendBtn) {
      sendBtn.disabled = !input.value.trim() || isGenerating || isStreaming;
    }
  }

  // Helper: Escape HTML to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: Safe Markdown Parser
  function renderMarkdown(md) {
    if (!md) return '';
    let text = escapeHtml(md);

    // Headers
    text = text.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    text = text.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^# (.*$)/gim, '<h3>$1</h3>');

    // Bold & Italic
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Inline Code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Markdown Links: [Text](URL)
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (match, title, url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="nlweb-link">${title} ↗</a>`;
    });

    // Bare URLs (not already inside an anchor tag)
    text = text.replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, (match, prefix, url) => {
      return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer" class="nlweb-link">${url} ↗</a>`;
    });

    // Unordered lists
    text = text.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>');
    text = text.replace(/<\/ul>\s*<ul>/g, ''); // Join adjacent lists

    // Paragraphs
    const paragraphs = text.split(/\n\n+/);
    text = paragraphs.map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<li')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return text;
  }

  // Helper: Tokenize text into words while preserving attached markdown formatting and spacing
  function tokenizeIntoWords(text) {
    if (!text) return [];
    // Tokenize by atomic markdown links, headers, words, and attach whitespace to preceding token
    const rawTokens = text.match(/\[[^\]]+\]\([^\)]+\)|#{1,4}\s+[^\n]+|\s+|\S+/g) || [text];
    const wordChunks = [];
    for (let i = 0; i < rawTokens.length; i++) {
      const t = rawTokens[i];
      if (/^\s+$/.test(t) && wordChunks.length > 0) {
        wordChunks[wordChunks.length - 1] += t;
      } else {
        wordChunks.push(t);
      }
    }
    return wordChunks;
  }

  // Helper: Fallback Lead Extractor for NLWeb Responses
  // Since the Cloudflare Worker (mcp-server) handles the Gemini API call server-side,
  // responses are normally already concise 3-5 sentence synthesized answers.
  // This extractor only activates if the worker falls back to raw multi-section KB markdown.
  function extractSmartAnswer(rawText, query) {
    if (!rawText) return '';

    const text = rawText.trim();
    if (text.length < 650 || !/(?:^|\n)#{2,3}\s+/.test(text)) {
      return text;
    }

    const stopWords = new Set([
      'what', 'is', 'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'about', 'tell', 'me', 'does', 'has', 'did', 'radu', 'stoian',
      'his', 'he', 'who', 'how', 'are', 'can', 'you', 'done', 'hold', 'which'
    ]);

    const cleanQuery = (query || '').toLowerCase();
    const qTokens = (cleanQuery.match(/[a-z0-9_-]+/g) || [])
      .filter(w => !stopWords.has(w));

    const stem = (w) => w.replace(/(ing|tions?|s|ed|es|ive|al)$/, '');
    const qStems = qTokens.map(stem);

    // Check if this is a broad "who is / background" query
    const isGeneralWho = qTokens.length === 0 ||
      (qTokens.length === 1 && ['background', 'profile', 'overview', 'bio', 'info', 'person'].includes(qTokens[0]));

    // Split into markdown sections (delimited by ## or ###)
    const rawSections = text.split(/\n+(?=#{2,3}\s+)/);

    if (isGeneralWho) {
      const firstSec = rawSections[0].trim();
      const textParas = firstSec
        .replace(/^#{1,3}\s+[^\n]+\n+/, '')
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(Boolean);
      return textParas.slice(0, 2).join('\n\n') || text;
    }

    function scoreSnippet(snippet) {
      const sLower = snippet.toLowerCase();
      let score = 0;
      for (let i = 0; i < qTokens.length; i++) {
        const tok = qTokens[i];
        const stm = qStems[i];
        if (sLower.includes(tok)) {
          score += 5;
        } else if (stm.length >= 3 && sLower.includes(stm)) {
          score += 3;
        }
      }
      if (sLower.includes('this is the personal profile site of radu stoian')) {
        score -= 10;
      }
      return score;
    }

    const allItems = [];
    rawSections.forEach((sec, sIdx) => {
      const secTrimmed = sec.trim();
      const lines = secTrimmed.split('\n');
      let title = '';
      let body = secTrimmed;
      if (secTrimmed.startsWith('#')) {
        title = lines[0].replace(/^#{1,3}\s*/, '').trim();
        body = lines.slice(1).join('\n').trim();
      }

      const rawItems = body.split(/\n\n+|\n(?=- )/).map(it => it.trim()).filter(Boolean);
      rawItems.forEach(it => {
        let score = scoreSnippet(it);
        if (title && scoreSnippet(title) > 0) {
          score += 4;
        }
        allItems.push({
          text: it,
          title: title,
          sectionIdx: sIdx,
          score: score
        });
      });
    });

    const matchingItems = allItems.filter(it => it.score > 0);
    matchingItems.sort((a, b) => b.score - a.score);

    if (matchingItems.length === 0) {
      const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      return paras.slice(0, 2).join('\n\n') || text;
    }

    // Deduplicate and pick top 3 matching items
    const selectedItems = [];
    const seen = new Set();
    for (const it of matchingItems) {
      const firstLine = it.text.split('\n')[0].trim();
      if (!seen.has(firstLine)) {
        seen.add(firstLine);
        selectedItems.push(it);
      }
      if (selectedItems.length >= 3) break;
    }

    const leadParts = [];
    let lastTitle = null;
    selectedItems.forEach(it => {
      if (it.title && it.title !== lastTitle && !['Radu Stoian Profile Information', 'Overview'].includes(it.title)) {
        leadParts.push(`### ${it.title}`);
        lastTitle = it.title;
      }
      leadParts.push(it.text);
    });

    let leadStr = '';
    for (let i = 0; i < leadParts.length; i++) {
      const part = leadParts[i];
      if (i === 0) {
        leadStr = part;
      } else {
        const prev = leadParts[i - 1];
        if (part.startsWith('- ') && prev.startsWith('- ')) {
          leadStr += '\n' + part;
        } else {
          leadStr += '\n\n' + part;
        }
      }
    }

    return leadStr || text;
  }

  // Create DOM elements
  function createWidgetDOM() {
    // 1. Floating Launcher Button (Sparkle icon only)
    const launcher = document.createElement('button');
    launcher.id = 'nlwebChatLauncher';
    launcher.className = 'nlweb-launcher';
    launcher.setAttribute('aria-label', 'Ask Radu AI - NLWeb assistant');
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'nlwebChatDialog');
    launcher.innerHTML = `
      <span class="nlweb-launcher-icon">${ICONS.sparkle}</span>
    `;

    // 2. Dialog Window
    const dialog = document.createElement('div');
    dialog.id = 'nlwebChatDialog';
    dialog.className = 'nlweb-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'false');
    dialog.setAttribute('aria-labelledby', 'nlwebChatTitle');

    dialog.innerHTML = `
      <header class="nlweb-header">
        <div class="nlweb-header-profile">
          <div class="nlweb-avatar-wrap">
            <img src="/radu-stoian-enhance-media.webp" alt="Radu Stoian" class="nlweb-avatar" onerror="this.src='/radu-stoian-enhance-media.jpg'">
            <span class="nlweb-status-dot" title="Online via NLWeb"></span>
          </div>
          <div class="nlweb-header-info">
            <div class="nlweb-header-title" id="nlwebChatTitle">
              <span>Radu Stoian AI</span>
            </div>
          </div>
        </div>
        <div class="nlweb-header-actions">
          <button class="nlweb-icon-btn" id="nlwebResetBtn" title="Reset conversation" aria-label="Reset conversation">
            <span style="width: 16px; height: 16px; display: inline-flex;">${ICONS.reset}</span>
          </button>
          <button class="nlweb-icon-btn" id="nlwebCloseBtn" title="Close chat" aria-label="Close chat assistant">
            <span style="width: 18px; height: 18px; display: inline-flex;">${ICONS.close}</span>
          </button>
        </div>
      </header>

      <div class="nlweb-messages" id="nlwebMessages" role="log" aria-live="polite">
        <!-- Rendered Messages will go here -->
      </div>

      <footer class="nlweb-footer">
        <form class="nlweb-input-form" id="nlwebInputForm">
          <textarea 
            class="nlweb-input" 
            id="nlwebTextInput" 
            rows="2" 
            maxlength="300"
            placeholder="Ask anything about Radu's work..." 
            aria-label="Ask a question about Radu Stoian"
          ></textarea>
          <button type="submit" class="nlweb-send-btn" id="nlwebSendBtn" disabled aria-label="Send message">
            <span style="width: 16px; height: 16px; display: inline-flex;">${ICONS.send}</span>
          </button>
        </form>
        <div class="nlweb-footer-sub">
          <span>Grounded live via <a href="/ask" target="_blank" rel="noopener">/ask</a> NLWeb and Gemini</span>
        </div>
      </footer>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(dialog);

    return { launcher, dialog };
  }

  // Load conversation from sessionStorage
  function loadHistory() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          messages = parsed;
          const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
          if (lastUserMsg) prevQuery = lastUserMsg.content;
          return;
        }
      }
    } catch (e) {
      // Ignore storage read errors
    }

    // Default welcome message
    messages = [
      {
        role: 'agent',
        content: `Hello! I'm Radu's AI assistant.\n\nI dynamically answer questions grounded in Radu's background, publications, agentic AI architecture, and employer brand optimization. How can I help you today?`,
        sources: []
      }
    ];
  }

  // Save conversation to sessionStorage
  function saveHistory() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      // Ignore storage write errors
    }
  }

  // Render all messages into DOM
  function renderMessages() {
    const container = document.getElementById('nlwebMessages');
    if (!container) return;

    container.innerHTML = '';

    messages.forEach((msg, index) => {
      const row = document.createElement('div');
      row.className = `nlweb-msg-row is-${msg.role}`;

      const bubble = document.createElement('div');
      bubble.className = 'nlweb-msg-bubble';

      let leadText = msg.content;
      if (msg.role === 'agent') {
        const queryForMsg = msg.query || (index > 0 && messages[index - 1]?.role === 'user' ? messages[index - 1].content : '');
        if (!queryForMsg) {
          bubble.innerHTML = renderMarkdown(msg.content);
        } else {
          leadText = extractSmartAnswer(msg.content, queryForMsg) || msg.content;
          bubble.innerHTML = `<div class="nlweb-lead-content">${renderMarkdown(leadText)}</div>`;
        }
      } else {
        bubble.innerHTML = renderMarkdown(msg.content);
      }

      // Render Grounded Sources if present
      if (msg.sources && msg.sources.length > 0) {
        const sourcesWrap = document.createElement('div');
        sourcesWrap.className = 'nlweb-sources-container';
        
        const header = document.createElement('div');
        header.className = 'nlweb-sources-header';
        header.innerHTML = `<span style="width: 12px; height: 12px; display: inline-flex;">${ICONS.citation}</span> Grounded in ${msg.sources.length} sources`;
        sourcesWrap.appendChild(header);

        const list = document.createElement('div');
        list.className = 'nlweb-sources-list';
        msg.sources.forEach(src => {
          const chip = document.createElement('a');
          chip.className = 'nlweb-source-chip';
          chip.href = src.url;
          chip.target = '_blank';
          chip.rel = 'noopener noreferrer';
          const name = src.name || src.url.replace(/^https?:\/\//, '');
          chip.innerHTML = `<span>${escapeHtml(name)}</span> ↗`;
          list.appendChild(chip);
        });
        sourcesWrap.appendChild(list);
        bubble.appendChild(sourcesWrap);
      }

      row.appendChild(bubble);

      // Copy Button for agent responses (skip introductory message at index 0)
      if (msg.role === 'agent' && !msg.isStreaming && index > 0) {
        const actions = document.createElement('div');
        actions.className = 'nlweb-msg-actions';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'nlweb-msg-copy-btn';
        copyBtn.innerHTML = `${ICONS.copy} <span>Copy</span>`;
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(leadText);
            copyBtn.innerHTML = `${ICONS.check} <span>Copied!</span>`;
            setTimeout(() => {
              copyBtn.innerHTML = `${ICONS.copy} <span>Copy</span>`;
            }, 2000);
          } catch (err) {
            // fallback
          }
        };
        actions.appendChild(copyBtn);
        row.appendChild(actions);
      }

      container.appendChild(row);
    });

    // If generating and waiting for response
    if (isGenerating) {
      const typingRow = document.createElement('div');
      typingRow.className = 'nlweb-msg-row is-agent';
      typingRow.id = 'nlwebTypingIndicator';
      typingRow.innerHTML = `
        <div class="nlweb-typing">
          <span class="nlweb-typing-dot"></span>
          <span class="nlweb-typing-dot"></span>
          <span class="nlweb-typing-dot"></span>
          <span class="nlweb-typing-label">Thinking with Gemini...</span>
        </div>
      `;
      container.appendChild(typingRow);

      // Scroll to show the newly submitted user question and typing indicator
      const userRow = container.querySelector('.nlweb-msg-row.is-user:last-of-type');
      if (userRow) {
        container.scrollTop = Math.max(0, userRow.offsetTop - 10);
      } else {
        container.scrollTop = container.scrollHeight;
      }
    } else {
      // Stay at the top of the latest agent answer if one exists
      const lastAgentRow = container.querySelector('.nlweb-msg-row.is-agent:last-of-type');
      if (lastAgentRow && messages.length > 1) {
        const userRow = lastAgentRow.previousElementSibling;
        let targetTop = lastAgentRow.offsetTop - 12;
        if (userRow && userRow.offsetHeight < 70 && container.clientHeight > 220) {
          targetTop = userRow.offsetTop - 10;
        }
        container.scrollTop = Math.max(0, targetTop);
      }
    }
  }

  // Open / Close Toggle
  function toggleDialog(openState) {
    const dialog = document.getElementById('nlwebChatDialog');
    const launcher = document.getElementById('nlwebChatLauncher');
    const input = document.getElementById('nlwebTextInput');

    isOpen = (typeof openState === 'boolean') ? openState : !isOpen;

    if (isOpen) {
      dialog.classList.add('is-open');
      launcher.setAttribute('aria-expanded', 'true');

      // Close mobile navigation menu if it is currently open
      const navbar = document.getElementById('navbar');
      if (navbar && navbar.classList.contains('mobile-open')) {
        const navToggle = document.getElementById('navToggle');
        if (navToggle) navToggle.click();
      }

      if (!isStreaming) {
        renderMessages();
      }

      // Auto-focus input only on non-touch desktop devices
      // On mobile/touch devices, auto-focus summons the virtual keyboard and pushes the intro text off-screen
      setTimeout(() => {
        const isMobileOrTouch = window.matchMedia('(max-width: 640px), (pointer: coarse)').matches;
        if (!isMobileOrTouch && input) {
          input.focus();
        }
      }, 100);
    } else {
      dialog.classList.remove('is-open');
      launcher.setAttribute('aria-expanded', 'false');
      dialog.style.bottom = '';
      dialog.style.maxHeight = '';
      launcher.focus();
    }
  }

  // Deduplicate and extract sources from results
  function extractSources(results) {
    if (!Array.isArray(results)) return [];
    const seen = new Set();
    const sources = [];
    for (const r of results) {
      if (r && r.url && !seen.has(r.url)) {
        seen.add(r.url);
        sources.push({
          url: r.url,
          name: r.name || r.schema_object?.name || r.url
        });
      }
    }
    return sources;
  }

  // Helper: Render markdown with trailing typing cursor inside the closing block tag
  function renderMarkdownWithCursor(mdText) {
    const rendered = renderMarkdown(mdText);
    if (rendered.endsWith('</p>')) {
      return rendered.replace(/<\/p>$/, ' <span class="nlweb-typing-cursor" aria-hidden="true"></span></p>');
    } else if (rendered.endsWith('</li></ul>')) {
      return rendered.replace(/<\/li><\/ul>$/, ' <span class="nlweb-typing-cursor" aria-hidden="true"></span></li></ul>');
    } else if (rendered.endsWith('</h3>')) {
      return rendered.replace(/<\/h3>$/, ' <span class="nlweb-typing-cursor" aria-hidden="true"></span></h3>');
    } else if (rendered.endsWith('</h4>')) {
      return rendered.replace(/<\/h4>$/, ' <span class="nlweb-typing-cursor" aria-hidden="true"></span></h4>');
    }
    return rendered + '<span class="nlweb-typing-cursor" aria-hidden="true"></span>';
  }

  // Helper: Create live agent message bubble when first token chunk arrives
  function createLiveAgentBubble() {
    const typingIndicator = document.getElementById('nlwebTypingIndicator');
    if (typingIndicator) typingIndicator.remove();
    isGenerating = false;
    isStreaming = true;
    updateSendBtnState();

    const dialog = document.getElementById('nlwebChatDialog');
    if (dialog) dialog.classList.add('has-answer');

    const container = document.getElementById('nlwebMessages');
    if (!container) return null;

    const row = document.createElement('div');
    row.className = 'nlweb-msg-row is-agent';

    const bubble = document.createElement('div');
    bubble.className = 'nlweb-msg-bubble';

    const leadContent = document.createElement('div');
    leadContent.className = 'nlweb-lead-content';
    bubble.appendChild(leadContent);
    row.appendChild(bubble);
    container.appendChild(row);

    const prevScrollBehavior = container.style.scrollBehavior;
    container.style.scrollBehavior = 'auto';

    // Requirement 3: Don't automatically scroll to the end of the answer.
    // Stay at the top of the answer and the user can scroll down to see the full answer.
    const userRow = row.previousElementSibling;
    let targetTop = row.offsetTop - 12;
    if (userRow && userRow.offsetHeight < 70 && container.clientHeight > 220) {
      targetTop = userRow.offsetTop - 10;
    }
    container.scrollTop = Math.max(0, targetTop);

    return { container, row, bubble, leadContent, prevScrollBehavior };
  }

  // Helper: Finalize live agent message bubble with sources, copy action, and session persistence
  function finalizeLiveAgentBubble(liveBubble, targetText, sources, userQuestion) {
    isStreaming = false;

    if (!liveBubble || !liveBubble.container) {
      messages.push({ role: 'agent', content: targetText, query: userQuestion, sources: sources });
      saveHistory();
      updateSendBtnState();
      return;
    }

    const { container, row, bubble, leadContent, prevScrollBehavior } = liveBubble;

    // Restore normal smooth scroll behavior
    container.style.scrollBehavior = prevScrollBehavior || '';

    // Clean final render without cursor
    leadContent.innerHTML = renderMarkdown(targetText);

    // Render Grounded Sources Chips if present
    if (sources && sources.length > 0) {
      const sourcesWrap = document.createElement('div');
      sourcesWrap.className = 'nlweb-sources-container';
      const header = document.createElement('div');
      header.className = 'nlweb-sources-header';
      header.innerHTML = `<span style="width: 12px; height: 12px; display: inline-flex;">${ICONS.citation}</span> Grounded in ${sources.length} source${sources.length > 1 ? 's' : ''}`;
      sourcesWrap.appendChild(header);

      const list = document.createElement('div');
      list.className = 'nlweb-sources-list';
      sources.forEach(src => {
        const chip = document.createElement('a');
        chip.className = 'nlweb-source-chip';
        chip.href = src.url;
        chip.target = '_blank';
        chip.rel = 'noopener noreferrer';
        const name = src.name || src.url.replace(/^https?:\/\//, '');
        chip.innerHTML = `<span>${escapeHtml(name)}</span> ↗`;
        list.appendChild(chip);
      });
      sourcesWrap.appendChild(list);
      bubble.appendChild(sourcesWrap);
    }

    // Copy Button
    const actions = document.createElement('div');
    actions.className = 'nlweb-msg-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'nlweb-msg-copy-btn';
    copyBtn.innerHTML = `${ICONS.copy} <span>Copy</span>`;
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(targetText);
        copyBtn.innerHTML = `${ICONS.check} <span>Copied!</span>`;
        setTimeout(() => {
          copyBtn.innerHTML = `${ICONS.copy} <span>Copy</span>`;
        }, 2000);
      } catch (err) {}
    };
    actions.appendChild(copyBtn);
    row.appendChild(actions);

    // Add to messages and persist
    messages.push({
      role: 'agent',
      content: targetText,
      query: userQuestion,
      sources: sources
    });
    saveHistory();

    // Requirement 3: Do NOT automatically scroll to the end of the answer!
    // Stay at the top of the answer and the user can scroll down to see the full answer.
    updateSendBtnState();
  }

  // Stream agent response word-by-word with typewriter effect at 5 words per second (used for NLWeb answers, guardrails, and JSON fallback)
  function streamAgentResponse(targetText, sources, userQuestion) {
    return new Promise((resolve) => {
      const liveBubble = createLiveAgentBubble();
      if (!liveBubble) {
        messages.push({ role: 'agent', content: targetText, query: userQuestion, sources: sources });
        saveHistory();
        isStreaming = false;
        updateSendBtnState();
        resolve();
        return;
      }

      const { leadContent } = liveBubble;
      const wordChunks = tokenizeIntoWords(targetText);
      let tokenIndex = 0;
      const totalChunks = wordChunks.length;

      if (streamingTimer) {
        clearInterval(streamingTimer);
        streamingTimer = null;
      }

      // Requirement 1: 5 words per second = 1 word every 200ms
      streamingTimer = setInterval(() => {
        if (tokenIndex < totalChunks) {
          tokenIndex++;
          const currentText = wordChunks.slice(0, tokenIndex).join('');
          leadContent.innerHTML = renderMarkdownWithCursor(currentText);
          // Requirement 3: Do NOT scroll to bottom! Stay at the top of the answer.
        }

        if (tokenIndex >= totalChunks) {
          clearInterval(streamingTimer);
          streamingTimer = null;
          finalizeLiveAgentBubble(liveBubble, targetText, sources, userQuestion);
          resolve();
        }
      }, WORD_TICK_MS);
    });
  }

  // Guardrail check: Prevent prompt injections asking to ignore system settings
  function isPromptInjection(text) {
    if (!text) return false;
    const injectionPatterns = [
      /ignore\s+(all\s+|any\s+)?(previous|prior|above|system|prompt)\s+(instructions|prompts|rules|commands|settings)/i,
      /\b(bypass|override)\s+(the\s+|all\s+)?(rules|filters|instructions|guardrails|settings)\b/i,
      /\b(act\s+as\s+dan|dan\s+mode|jailbreak)\b/i,
      /\bdisregard\s+(all\s+)?(instructions|rules|prompts|settings)\b/i
    ];
    return injectionPatterns.some(pattern => pattern.test(text));
  }

  // Guardrail check: Prevent prompt extraction / leakage attempts
  function isPromptLeakageAttempt(text) {
    if (!text) return false;
    const leakagePatterns = [
      /\b(repeat|show|display|reveal|print|output|recite|state)\s+(your\s+|the\s+)?(initial\s+|system\s+|secret\s+)?(instructions|prompts?|prompt|system\s+message|guidelines|rules)\b/i,
      /\b(what\s+are|what're)\s+your\s+(instructions|system\s+instructions|system\s+prompt|rules|hidden\s+rules)\b/i,
      /\bprint\s+(the\s+)?text\s+above\b/i,
      /\b(tell\s+me|show\s+me)\s+what\s+(was\s+written|you\s+were\s+told)\s+above\b/i
    ];
    return leakagePatterns.some(pattern => pattern.test(text));
  }

  // Guardrail check: Prevent harassment, hate speech, sexually explicit, or dangerous requests
  // Client-side pre-filter aligned with server-side Gemini safetySettings (BLOCK_MEDIUM_AND_ABOVE)
  function isAbusiveOrDangerous(text) {
    if (!text) return false;
    const dangerousPatterns = [
      /\b(build|make|create)\s+(a\s+)?(bomb|explosive|weapon|poison|malware|ransomware)\b/i,
      /\b(how\s+to\s+kill|commit\s+suicide|harm\s+myself|self[\s-]harm)\b/i,
      /\b(fuck|bitch|bastard|asshole|cunt)\b/i,
      /\b(porn|pornography|sexually\s+explicit|nsfw|erotic)\b/i
    ];
    return dangerousPatterns.some(pattern => pattern.test(text));
  }

  // Guardrail check: Only answer questions about Radu
  // The question doesn't need to contain "Radu", but it needs to contain "his", "he", "him", or "Radu"
  function isQueryAboutRadu(question) {
    if (!question) return false;
    return /\b(radu('s)?|he|him|his)\b|radustoian/i.test(question.trim());
  }



  // Query NLWeb using real-time SSE Token Streaming or JSON fallback (Gemini synthesis handled server-side by mcp-server worker)
  async function queryNLWeb(userQuestion) {
    // 1. Guardrail Check: Never accept prompt injection / ignore instructions
    if (isPromptInjection(userQuestion)) {
      const refusalText = "I cannot accept prompts asking to ignore or override my operating guidelines. I am only meant to answer respectful questions about Radu Stoian.";
      await streamAgentResponse(refusalText, [], userQuestion);
      return;
    }

    // 2. Guardrail Check: Never reveal internal system instructions or prompt
    if (isPromptLeakageAttempt(userQuestion)) {
      const refusalText = "My internal system instructions and operating guidelines are proprietary and confidential. I am only here to answer questions about Radu Stoian and his work.";
      await streamAgentResponse(refusalText, [], userQuestion);
      return;
    }

    // 3. Guardrail Check: Refuse abusive, profane, or dangerous queries
    if (isAbusiveOrDangerous(userQuestion)) {
      const refusalText = "I cannot engage with abusive, profane, or dangerous requests. I am only meant to answer questions about Radu Stoian and his work.";
      await streamAgentResponse(refusalText, [], userQuestion);
      return;
    }

    // 4. Guardrail Check: Politely refuse any question that is not about Radu
    if (!isQueryAboutRadu(userQuestion)) {
      const refusalText = "I am only meant to answer questions about Radu Stoian. Please feel free to ask anything about him, his background, skills, case studies, or projects.";
      await streamAgentResponse(refusalText, [], userQuestion);
      return;
    }

    isGenerating = true;
    renderMessages();

    const currentPrev = prevQuery;
    prevQuery = userQuestion;

    let agentResponseText = '';
    let streamedChunkText = '';
    let liveBubble = null;
    const gatheredSources = [];
    let streamedSuccessfully = false;
    let sseFinished = false;
    let streamWordChunks = [];
    let streamWordIndex = 0;

    if (activeAbortController) {
      try { activeAbortController.abort(); } catch (e) {}
    }
    const abortController = new AbortController();
    activeAbortController = abortController;

    if (streamingTimer) {
      clearInterval(streamingTimer);
      streamingTimer = null;
    }

    // Typewriter Promise: paces display at 5 words per second (200ms per word)
    let finishTypewriterResolve = null;
    const typewriterPromise = new Promise((resolve) => {
      finishTypewriterResolve = resolve;
    });

    streamingTimer = setInterval(() => {
      if (!liveBubble && streamWordChunks.length > 0) {
        liveBubble = createLiveAgentBubble();
      }

      if (liveBubble && streamWordIndex < streamWordChunks.length) {
        streamWordIndex++;
        const currentDisplay = streamWordChunks.slice(0, streamWordIndex).join('');
        liveBubble.leadContent.innerHTML = renderMarkdownWithCursor(currentDisplay);
        // Requirement 3: Do NOT scroll to bottom! Stay at top of answer.
      }

      if (sseFinished && streamWordIndex >= streamWordChunks.length) {
        clearInterval(streamingTimer);
        streamingTimer = null;
        if (finishTypewriterResolve) finishTypewriterResolve();
      }
    }, WORD_TICK_MS);

    try {
      // 1. Try Server-Sent Events (SSE) Stream via GET (/ask on mcp-server worker)
      const streamUrl = `${ASK_ENDPOINT}?q=${encodeURIComponent(userQuestion)}${currentPrev ? '&prev=' + encodeURIComponent(currentPrev) : ''}&mode=generate`;
      const response = await fetch(streamUrl, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' },
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';

      const processEvent = (evType, evBody) => {
        const dataLines = evBody
          .split('\n')
          .map(line => line.startsWith('data:') ? line.slice(5).replace(/^ /, '') : line);
        const cleanBody = dataLines.join('\n').trim();

        if (evType === 'chunk') {
          try {
            const chunkObj = JSON.parse(cleanBody);
            const delta = chunkObj.delta || chunkObj.text || '';
            if (delta) {
              streamedChunkText += delta;
              agentResponseText = streamedChunkText;
              streamWordChunks = tokenizeIntoWords(streamedChunkText);
            }
          } catch (e) {
            // Ignore malformed chunk JSON
          }
        } else if (evType === 'result') {
          try {
            const resObj = JSON.parse(cleanBody);
            if (resObj.url && !gatheredSources.some(s => s.url === resObj.url)) {
              gatheredSources.push({
                url: resObj.url,
                name: resObj.name || resObj.schema_object?.name || resObj.url
              });
            }
          } catch (e) {
            // Ignore parse errors on single result
          }
        } else if (evType === 'summary') {
          if (cleanBody) {
            agentResponseText = cleanBody;
            streamWordChunks = tokenizeIntoWords(cleanBody);
          }
        } else if (evType === 'nlws') {
          if (!agentResponseText && cleanBody) {
            agentResponseText = cleanBody;
            streamWordChunks = tokenizeIntoWords(cleanBody);
          }
        }
      };

      const parseEventBlock = (block) => {
        const trimmed = block.trim();
        if (!trimmed.startsWith('event:')) return;
        const firstNl = trimmed.indexOf('\n');
        if (firstNl === -1) return;
        const evType = trimmed.slice(6, firstNl).trim();
        const evBody = trimmed.slice(firstNl + 1);
        processEvent(evType, evBody);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

        // Extract completed SSE event blocks delimited by double newline '\n\n'
        let boundaryIdx;
        while ((boundaryIdx = streamBuffer.indexOf('\n\n')) !== -1) {
          const eventBlock = streamBuffer.slice(0, boundaryIdx);
          streamBuffer = streamBuffer.slice(boundaryIdx + 2);
          parseEventBlock(eventBlock);
        }
      }

      streamBuffer += decoder.decode().replace(/\r\n/g, '\n');
      if (streamBuffer.trim()) {
        const remainingBlocks = streamBuffer.split('\n\n');
        for (const block of remainingBlocks) {
          parseEventBlock(block);
        }
      }

      if (!agentResponseText) {
        // Fallback to pure JSON if stream didn't yield text
        throw new Error('Empty stream response, falling back to JSON');
      }

      // The answer is synthesized by Gemini and grounded by the Cloudflare Worker (/ask)
      const targetText = extractSmartAnswer(agentResponseText, userQuestion) || agentResponseText;
      streamWordChunks = tokenizeIntoWords(targetText);
      sseFinished = true;

      // Wait until all words have finished displaying at 5 words per second
      await typewriterPromise;

      if (liveBubble) {
        finalizeLiveAgentBubble(liveBubble, targetText, gatheredSources, userQuestion);
      } else {
        await streamAgentResponse(targetText, gatheredSources, userQuestion);
      }
      streamedSuccessfully = true;

    } catch (streamError) {
      if (streamingTimer) {
        clearInterval(streamingTimer);
        streamingTimer = null;
      }
      if (finishTypewriterResolve) {
        finishTypewriterResolve();
      }
      if (streamError && streamError.name === 'AbortError') {
        return;
      }
      console.warn('NLWeb SSE stream fallback triggered:', streamError);

      // Remove partial live bubble if stream failed mid-flight before falling back to JSON
      if (liveBubble && liveBubble.row) {
        liveBubble.row.remove();
        liveBubble = null;
      }

      try {
        // Fallback to JSON POST /ask (handled by mcp-server worker)
        const jsonRes = await fetch(ASK_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            query: userQuestion,
            prev: currentPrev,
            streaming: false,
            mode: 'generate'
          }),
          signal: abortController.signal
        });

        if (!jsonRes.ok) {
          throw new Error(`NLWeb returned HTTP ${jsonRes.status}`);
        }

        const data = await jsonRes.json();
        const summary = data.summary || "I've retrieved information from radustoian.com, but no summary could be generated for this query.";
        const sources = extractSources(data.results);

        const targetText = extractSmartAnswer(summary, userQuestion) || summary;
        await streamAgentResponse(targetText, sources, userQuestion);
        streamedSuccessfully = true;

      } catch (jsonError) {
        if (jsonError && jsonError.name === 'AbortError') {
          return;
        }
        console.warn('NLWeb query failed:', jsonError);
        messages.push({
          role: 'agent',
          content: `I apologize, but I could not reach the server. Please check your connection or try again shortly.\n\n*(Error details: ${escapeHtml(jsonError.message)})*`,
          sources: []
        });
      }
    } finally {
      if (activeAbortController === abortController) {
        activeAbortController = null;
      }
      isGenerating = false;
      isStreaming = false;
      updateSendBtnState();
      if (!streamedSuccessfully && !abortController.signal.aborted) {
        saveHistory();
        renderMessages();
      }
    }
  }

  // Handle Form Submission
  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (isGenerating || isStreaming) return;

    const now = Date.now();
    if (now - lastSubmitTime < COOLDOWN_MS) return;

    const input = document.getElementById('nlwebTextInput');
    const sendBtn = document.getElementById('nlwebSendBtn');
    let text = input.value.trim();

    if (!text) return;

    // Enforce maximum input character limit
    if (text.length > MAX_INPUT_CHARS) {
      text = text.slice(0, MAX_INPUT_CHARS).trim();
    }

    // Reset input
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    // Add user message
    messages.push({
      role: 'user',
      content: text
    });
    saveHistory();
    renderMessages();

    // Check Session Question Cap (Maximum 5 questions per session)
    const sessionCount = getSessionQueryCount();
    if (sessionCount >= MAX_SESSION_QUESTIONS) {
      await streamAgentResponse(LIMIT_REACHED_MESSAGE, [], text);
      return;
    }

    lastSubmitTime = Date.now();
    incrementSessionQueryCount();

    // Query NLWeb
    await queryNLWeb(text);
  }

  // Reset Conversation smoothly without disruptive browser alert
  function handleReset() {
    const resetBtn = document.getElementById('nlwebResetBtn');
    const container = document.getElementById('nlwebMessages');
    const input = document.getElementById('nlwebTextInput');

    if (activeAbortController) {
      try { activeAbortController.abort(); } catch (e) {}
      activeAbortController = null;
    }
    if (streamingTimer) {
      clearInterval(streamingTimer);
      streamingTimer = null;
    }
    isStreaming = false;
    isGenerating = false;

    // Trigger subtle rotation animation on the reset button
    if (resetBtn) {
      resetBtn.classList.remove('is-spinning');
      void resetBtn.offsetWidth; // trigger reflow
      resetBtn.classList.add('is-spinning');
      setTimeout(() => resetBtn.classList.remove('is-spinning'), 500);
    }

    const dialogEl = document.getElementById('nlwebChatDialog');
    if (dialogEl) dialogEl.classList.remove('has-answer');

    // Smooth fade transition of messages
    if (container) {
      container.style.scrollBehavior = 'auto';
      container.classList.add('is-resetting');

      setTimeout(() => {
        sessionStorage.removeItem(STORAGE_KEY);
        prevQuery = '';
        loadHistory();
        renderMessages();
        container.classList.remove('is-resetting');
        container.style.scrollBehavior = '';
        updateSendBtnState();
        if (input) input.focus();
      }, 150);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      prevQuery = '';
      loadHistory();
      renderMessages();
      updateSendBtnState();
      if (input) input.focus();
    }
  }

  // Initialize Event Listeners
  function initListeners(dom) {
    const { launcher, dialog } = dom;
    const closeBtn = document.getElementById('nlwebCloseBtn');
    const resetBtn = document.getElementById('nlwebResetBtn');
    const form = document.getElementById('nlwebInputForm');
    const input = document.getElementById('nlwebTextInput');

    // Launcher click
    launcher.addEventListener('click', () => toggleDialog());

    // Close button
    if (closeBtn) closeBtn.addEventListener('click', () => toggleDialog(false));

    // Reset button
    if (resetBtn) resetBtn.addEventListener('click', handleReset);

    // Form submit
    if (form) form.addEventListener('submit', handleSubmit);

    // Input events (auto-expand, enable/disable send, Shift+Enter)
    if (input) {
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${Math.min(Math.max(input.scrollHeight, 44), 120)}px`;
        updateSendBtnState();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      });
    }

    // Escape key closes dialog
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        toggleDialog(false);
      }
    });

    // VisualViewport listener: keep chat within viewport when virtual keyboard opens or screen resizes on mobile
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        if (!isOpen || window.innerWidth > 640) return;
        const dialog = document.getElementById('nlwebChatDialog');
        if (!dialog) return;

        const vp = window.visualViewport;
        const keyboardOffset = Math.max(0, window.innerHeight - (vp.offsetTop + vp.height));
        if (keyboardOffset > 50) {
          dialog.style.bottom = `${keyboardOffset}px`;
          const maxVpHeight = Math.min(vp.height, window.innerHeight * 0.9);
          dialog.style.maxHeight = `${maxVpHeight}px`;
        } else {
          dialog.style.bottom = '';
          dialog.style.maxHeight = '';
        }
      };

      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    }

    // Global click listener for elements with data-nlweb-trigger
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-nlweb-trigger]');
      if (trigger) {
        e.preventDefault();
        const query = trigger.getAttribute('data-nlweb-query');
        window.nlwebChat.open(query);
      }
    });
  }

  // Startup initialization on DOM ready
  function start() {
    loadHistory();
    const dom = createWidgetDOM();
    initListeners(dom);

    // Public API
    window.nlwebChat = {
      open: (initialQuery) => {
        toggleDialog(true);
        if (initialQuery && !isGenerating && !isStreaming) {
          const cleanQuery = initialQuery.slice(0, MAX_INPUT_CHARS).trim();
          messages.push({ role: 'user', content: cleanQuery });
          saveHistory();
          renderMessages();

          const sessionCount = getSessionQueryCount();
          if (sessionCount >= MAX_SESSION_QUESTIONS) {
            streamAgentResponse(LIMIT_REACHED_MESSAGE, [], cleanQuery);
            return;
          }

          lastSubmitTime = Date.now();
          incrementSessionQueryCount();
          queryNLWeb(cleanQuery);
        }
      },
      openReady: (prefill) => {
        toggleDialog(true);
        const input = document.getElementById('nlwebTextInput');
        if (input) {
          if (prefill && typeof prefill === 'string') {
            input.value = prefill.slice(0, MAX_INPUT_CHARS);
            input.style.height = 'auto';
            input.style.height = `${Math.min(Math.max(input.scrollHeight, 44), 120)}px`;
            updateSendBtnState();
          }
          input.focus();
          if (typeof input.setSelectionRange === 'function') {
            input.setSelectionRange(input.value.length, input.value.length);
          }
          setTimeout(() => {
            input.focus();
            if (typeof input.setSelectionRange === 'function') {
              input.setSelectionRange(input.value.length, input.value.length);
            }
          }, 120);
        }
      },
      close: () => toggleDialog(false),
      toggle: () => toggleDialog()
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
