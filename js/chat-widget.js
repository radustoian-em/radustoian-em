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
  const PERSISTENT_QUOTA_KEY = 'nlweb_query_quota_v2';
  const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000; // 24-hour rolling window across tabs
  const LIMIT_REACHED_MESSAGE = "You've reached the free limit of 5 questions about Radu. If you're interested to find out more reach out on LinkedIn https://www.linkedin.com/in/radustoian";
  let lastSubmitTime = 0;

  // Typewriter Speed Configuration: 5 words per second (200ms per word)
  const WORDS_PER_SECOND = 5;
  const WORD_TICK_MS = 1000 / WORDS_PER_SECOND;

  // Persistent + session query counter helpers
  function getSessionQueryCount() {
    let sessionCount = 0;
    let persistentCount = 0;
    const now = Date.now();

    try {
      sessionCount = parseInt(sessionStorage.getItem(SESSION_QUERY_COUNT_KEY) || '0', 10) || 0;
    } catch (e) {}

    try {
      const raw = localStorage.getItem(PERSISTENT_QUOTA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.windowStart === 'number' && (now - parsed.windowStart < QUOTA_WINDOW_MS)) {
          persistentCount = parseInt(parsed.count || '0', 10) || 0;
        } else {
          localStorage.removeItem(PERSISTENT_QUOTA_KEY);
        }
      }
    } catch (e) {}

    return Math.max(sessionCount, persistentCount);
  }

  function incrementSessionQueryCount() {
    const now = Date.now();
    const count = getSessionQueryCount() + 1;

    try {
      sessionStorage.setItem(SESSION_QUERY_COUNT_KEY, count.toString());
    } catch (e) {}

    try {
      let windowStart = now;
      const raw = localStorage.getItem(PERSISTENT_QUOTA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.windowStart === 'number' && (now - parsed.windowStart < QUOTA_WINDOW_MS)) {
          windowStart = parsed.windowStart;
        }
      }
      localStorage.setItem(PERSISTENT_QUOTA_KEY, JSON.stringify({ count, windowStart }));
    } catch (e) {}

    return count;
  }

  // Icons SVG definitions
  const ICONS = {
    sparkle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    citation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    maximize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`,
    restore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="10" y1="14" x2="3" y2="21"></line></svg>`
  };

  // State
  let isOpen = false;
  let isMaximized = false;
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

  // Helper: Detect whether a URL points to radustoian.com (including anchors, relative paths, and current hostname)
  function isInternalUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim();
    if (clean.startsWith('#')) return true;
    if (clean.startsWith('/') && !clean.startsWith('//')) return true;
    try {
      const parsed = new URL(clean, window.location.href);
      return (
        parsed.hostname === 'radustoian.com' ||
        parsed.hostname === 'www.radustoian.com' ||
        parsed.hostname === window.location.hostname
      );
    } catch {
      return /^(https?:\/\/)?(www\.)?radustoian\.com/i.test(clean);
    }
  }

  // Helper: Create a Grounded Source chip element
  function createSourceChip(src) {
    const chip = document.createElement('a');
    chip.className = 'nlweb-source-chip';
    chip.href = src.url;
    const isInternal = isInternalUrl(src.url);
    if (isInternal) {
      chip.target = '_self';
    } else {
      chip.target = '_blank';
      chip.rel = 'noopener noreferrer';
    }
    const name = src.name || src.url.replace(/^https?:\/\//, '');
    chip.innerHTML = `<span>${escapeHtml(name)}</span>${isInternal ? '' : ' ↗'}`;
    return chip;
  }

  // Helper: Create "Searching ..." collapsible dropdown showing Gemini query fan-outs
  function createFanOutDropdown(queries, language) {
    if (!Array.isArray(queries) || queries.length === 0) return null;

    const details = document.createElement('details');
    details.className = 'nlweb-fanout';

    const summary = document.createElement('summary');
    summary.className = 'nlweb-fanout-summary';
    const langTag = language && language !== 'en'
      ? `<span class="nlweb-fanout-badge">${escapeHtml(language.toUpperCase())} → EN</span>`
      : '';
    summary.innerHTML = `
      <span class="nlweb-fanout-label">
        <span class="nlweb-fanout-icon">${ICONS.search}</span>
        <span>Searching ...</span>
        <span class="nlweb-fanout-count">${queries.length} ${queries.length === 1 ? 'query' : 'queries'}</span>
        ${langTag}
      </span>
      <span class="nlweb-fanout-chevron">${ICONS.chevron}</span>
    `;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'nlweb-fanout-body';

    const list = document.createElement('ul');
    list.className = 'nlweb-fanout-list';
    queries.forEach((q) => {
      const li = document.createElement('li');
      li.className = 'nlweb-fanout-item';
      li.innerHTML = `<span class="nlweb-fanout-item-icon">${ICONS.search}</span><span>${escapeHtml(q)}</span>`;
      list.appendChild(li);
    });
    body.appendChild(list);
    details.appendChild(body);

    return details;
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
      const isInternal = isInternalUrl(url);
      const targetAttr = isInternal ? 'target="_self"' : 'target="_blank" rel="noopener noreferrer"';
      const arrow = isInternal ? '' : ' ↗';
      return `<a href="${url}" ${targetAttr} class="nlweb-link">${title}${arrow}</a>`;
    });

    // Bare URLs (not already inside an anchor tag)
    text = text.replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, (match, prefix, url) => {
      const isInternal = isInternalUrl(url);
      const targetAttr = isInternal ? 'target="_self"' : 'target="_blank" rel="noopener noreferrer"';
      const arrow = isInternal ? '' : ' ↗';
      return `${prefix}<a href="${url}" ${targetAttr} class="nlweb-link">${url}${arrow}</a>`;
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
          <button class="nlweb-icon-btn" id="nlwebMaximizeBtn" title="Maximise chat" aria-label="Maximise chat">
            <span style="width: 16px; height: 16px; display: inline-flex;">${ICONS.maximize}</span>
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
        if (msg.fanOutQueries && msg.fanOutQueries.length > 0) {
          const fanoutDropdown = createFanOutDropdown(msg.fanOutQueries, msg.language);
          if (fanoutDropdown) {
            const fanoutSlot = document.createElement('div');
            fanoutSlot.className = 'nlweb-fanout-slot';
            fanoutSlot.appendChild(fanoutDropdown);
            bubble.appendChild(fanoutSlot);
          }
        }

        const queryForMsg = msg.query || (index > 0 && messages[index - 1]?.role === 'user' ? messages[index - 1].content : '');
        const leadDiv = document.createElement('div');
        leadDiv.className = 'nlweb-lead-content';
        if (!queryForMsg) {
          leadDiv.innerHTML = renderMarkdown(msg.content);
        } else {
          leadText = extractSmartAnswer(msg.content, queryForMsg) || msg.content;
          leadDiv.innerHTML = renderMarkdown(leadText);
        }
        bubble.appendChild(leadDiv);
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
          list.appendChild(createSourceChip(src));
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
      dialog.style.height = '';
      launcher.focus();
    }
  }

  // Maximise / Restore Toggle
  function toggleMaximize(forceState) {
    const dialog = document.getElementById('nlwebChatDialog');
    const maxBtn = document.getElementById('nlwebMaximizeBtn');
    if (!dialog) return;

    isMaximized = (typeof forceState === 'boolean') ? forceState : !isMaximized;

    if (isMaximized) {
      dialog.classList.add('is-maximized');
      if (maxBtn) {
        maxBtn.title = 'Restore chat';
        maxBtn.setAttribute('aria-label', 'Restore chat');
        maxBtn.innerHTML = `<span style="width: 16px; height: 16px; display: inline-flex;">${ICONS.restore}</span>`;
      }
    } else {
      dialog.classList.remove('is-maximized');
      dialog.style.height = '';
      if (maxBtn) {
        maxBtn.title = 'Maximise chat';
        maxBtn.setAttribute('aria-label', 'Maximise chat');
        maxBtn.innerHTML = `<span style="width: 16px; height: 16px; display: inline-flex;">${ICONS.maximize}</span>`;
      }
    }

    const container = document.getElementById('nlwebMessages');
    if (container) {
      const lastAgentRow = container.querySelector('.nlweb-msg-row.is-agent:last-of-type');
      if (lastAgentRow && messages.length > 1) {
        const userRow = lastAgentRow.previousElementSibling;
        let targetTop = lastAgentRow.offsetTop - 12;
        if (userRow && userRow.offsetHeight < 70 && container.clientHeight > 220) {
          targetTop = userRow.offsetTop - 10;
        }
        container.scrollTop = Math.max(0, targetTop);
      } else {
        container.scrollTop = 0;
      }
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

  // Helper: Create live agent message bubble when fan-out queries or first token chunk arrives
  function createLiveAgentBubble(fanOutQueries = [], language = 'en') {
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

    const fanoutSlot = document.createElement('div');
    fanoutSlot.className = 'nlweb-fanout-slot';
    if (Array.isArray(fanOutQueries) && fanOutQueries.length > 0) {
      const dropdown = createFanOutDropdown(fanOutQueries, language);
      if (dropdown) fanoutSlot.appendChild(dropdown);
    }
    bubble.appendChild(fanoutSlot);

    const leadContent = document.createElement('div');
    leadContent.className = 'nlweb-lead-content';
    leadContent.innerHTML = '<span class="nlweb-typing-cursor" aria-hidden="true"></span>';
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

    return { container, row, bubble, fanoutSlot, leadContent, prevScrollBehavior };
  }

  // Helper: Finalize live agent message bubble with sources, fan-outs, copy action, and session persistence
  function finalizeLiveAgentBubble(liveBubble, targetText, sources, userQuestion, fanOutQueries = [], language = 'en') {
    isStreaming = false;
    const cleanFanOut = isRefusalResponse(targetText) ? [] : (Array.isArray(fanOutQueries) ? [...fanOutQueries] : []);

    if (!liveBubble || !liveBubble.container) {
      messages.push({
        role: 'agent',
        content: targetText,
        query: userQuestion,
        sources: sources,
        fanOutQueries: cleanFanOut,
        language: language
      });
      saveHistory();
      updateSendBtnState();
      return;
    }

    const { container, row, bubble, fanoutSlot, leadContent, prevScrollBehavior } = liveBubble;

    // Restore normal smooth scroll behavior
    container.style.scrollBehavior = prevScrollBehavior || '';

    // Ensure fanoutSlot matches final state (clear on refusal, populate if not already rendered)
    if (fanoutSlot) {
      if (cleanFanOut.length === 0) {
        fanoutSlot.innerHTML = '';
      } else if (!fanoutSlot.hasChildNodes()) {
        const dropdown = createFanOutDropdown(cleanFanOut, language);
        if (dropdown) fanoutSlot.appendChild(dropdown);
      }
    }

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
        list.appendChild(createSourceChip(src));
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
      sources: sources,
      fanOutQueries: cleanFanOut,
      language: language
    });
    saveHistory();

    // Requirement 3: Do NOT automatically scroll to the end of the answer!
    // Stay at the top of the answer and the user can scroll down to see the full answer.
    updateSendBtnState();
  }

  // Stream agent response word-by-word with typewriter effect at 5 words per second (used for NLWeb answers, guardrails, and JSON fallback)
  function streamAgentResponse(targetText, sources, userQuestion, fanOutQueries = [], language = 'en') {
    return new Promise((resolve) => {
      const cleanFanOut = isRefusalResponse(targetText) ? [] : fanOutQueries;
      const liveBubble = createLiveAgentBubble(cleanFanOut, language);
      if (!liveBubble) {
        messages.push({
          role: 'agent',
          content: targetText,
          query: userQuestion,
          sources: sources,
          fanOutQueries: cleanFanOut,
          language: language
        });
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
          finalizeLiveAgentBubble(liveBubble, targetText, sources, userQuestion, cleanFanOut, language);
          resolve();
        }
      }, WORD_TICK_MS);
    });
  }

  // Guardrail check: Prevent prompt injections asking to ignore system settings
  function isPromptInjection(text) {
    if (!text) return false;
    const injectionPatterns = [
      /ignore\s+(all\s+|any\s+)?(previous|prior|above|system|prompt|developer)\s+(instructions?|prompts?|rules?|commands?|settings?|guidelines?)/i,
      /\b(bypass|override|disable|forget)\s+(the\s+|all\s+|your\s+)?(rules?|filters?|instructions?|guardrails?|settings?|constraints?)\b/i,
      /\b(act\s+as\s+dan|dan\s+mode|developer\s+mode|jailbreak|sudo\s+mode)\b/i,
      /\bdisregard\s+(all\s+|any\s+|your\s+)?(previous\s+|prior\s+)?(instructions?|rules?|prompts?|settings?)\b/i,
      /\b(new\s+instructions?:|system\s+prompt:|you\s+are\s+now\s+a\s+different)\b/i
    ];
    return injectionPatterns.some(pattern => pattern.test(text));
  }

  // Guardrail check: Prevent prompt extraction / leakage attempts
  function isPromptLeakageAttempt(text) {
    if (!text) return false;
    const leakagePatterns = [
      /\b(repeat|show|display|reveal|print|output|recite|state|dump|translate|summarize|summarise)\s+(your\s+|the\s+|all\s+)?(initial\s+|system\s+|secret\s+|developer\s+|hidden\s+|internal\s+)?(instructions?|prompts?|system\s+message|guidelines?|rules?)\b/i,
      /\b(what\s+are|what're|tell\s+me)\s+your\s+(instructions?|system\s+instructions?|system\s+prompt|rules?|hidden\s+rules?|operating\s+guidelines?)\b/i,
      /\bprint\s+(the\s+|everything\s+)?(text\s+)?above\b/i,
      /\b(tell\s+me|show\s+me)\s+what\s+(was\s+written|you\s+were\s+told)\s+above\b/i
    ];
    return leakagePatterns.some(pattern => pattern.test(text));
  }

  // Guardrail check: Prevent harassment, hate speech, sexually explicit, or dangerous requests
  // Client-side pre-filter aligned with server-side Gemini safetySettings (BLOCK_MEDIUM_AND_ABOVE)
  function isAbusiveOrDangerous(text) {
    if (!text) return false;
    const dangerousPatterns = [
      /\b(build|make|create|write|generate)\s+(a\s+|an\s+)?(bomb|explosive|weapon|poison|malware|ransomware|keylogger|exploit)\b/i,
      /\b(how\s+to\s+kill|commit\s+suicide|harm\s+myself|self[\s-]harm)\b/i,
      /\b(fuck|fucking|bitch|bastard|asshole|cunt|dickhead|motherfucker)\b/i,
      /\b(porn|pornography|sexually\s+explicit|nsfw|erotic)\b/i
    ];
    return dangerousPatterns.some(pattern => pattern.test(text));
  }

  // Guardrail check: Prevent off-topic coding, math, or creative writing task abuse
  function isOffTopicTaskAttempt(text) {
    if (!text) return false;
    const taskPatterns = [
      /\b(write|generate|create|debug|fix)\s+(a\s+|an\s+|me\s+|some\s+)?(python|javascript|typescript|java|c\+\+|rust|go|html|css|sql|bash|shell|code|script|program|function|regex|poem|haiku|sonnet|essay|story|song|recipe)\b/i,
      /\b(solve\s+this|calculate\s+the|translate\s+this\s+into)\b/i
    ];
    return taskPatterns.some(pattern => pattern.test(text));
  }

  // Guardrail check: Only answer questions about Radu or his portfolio work (supports any language)
  function isQueryAboutRadu(question, prev = '') {
    if (!question) return false;
    const q = question.trim();
    const directRef = /\b(radu('s)?|stoian|you|your|yours|yourself|he|him|his|tu|toi|te|vous|votre|vos|el|lui|tău|dumneavoastră|il|son|sa|ses|su|sus|usted|ustedes|er|ihm|ihn|sein|seine|du|dir|dich|dein|deine|sie|ihnen|ihr|euch|ele|dele|suo|sua|suoi)\b|radustoian/i;
    const portfolioDomainRef = /\b(ojcp|open\s*job\s*context|brighton\s*seo|talent\s*attraction|employer\s*brand(ing)?|brand\s*health|webmcp|nlweb|case\s*stud(y|ies)|testimonial|testimonials|recommendation|recommendations|endorsement|endorsements|certification|certifications|credential|credentials|alma\s*mater|masterclass|google\s*cloud|genai\s*leader|bigquery|project|projects|proiect(e)?|projet(s)?|proyecto(s)?|projekt(e)?|client|clients|cliente(s)?|kunden|studi|étud|educa|education|degree|degrees|certifica|competen|limbi|langue(s)?|idioma(s)?|sprache(n)?|cariera|carrière|carrera|karriere|experien|experience|expertise|expert|profession|work|role|niche|location|located|live|living|based|locui[\p{L}]*|wohnen|habiter|speak|speaking|talk|talks|presentation|keynote|podcast|articol(e)?|article(s)?|artículo(s)?|publication|publications|director|directeur|direktor|result(s)?|outcome(s)?|metric(s)?|contact|connect|social|bio|biography|background|overview)\b/iu;
    const nonLatinScriptRef = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|\p{Script=Cyrillic}|\p{Script=Arabic}|\p{Script=Greek}|\p{Script=Devanagari}/u;

    if (directRef.test(q) || portfolioDomainRef.test(q) || nonLatinScriptRef.test(q)) {
      return true;
    }

    if (prev && (directRef.test(prev) || portfolioDomainRef.test(prev) || nonLatinScriptRef.test(prev))) {
      const wordCount = q.split(/\s+/).length;
      const followUpRef = /\b(project|client|skill|degree|education|university|school|language|location|live|based|speak|talk|podcast|article|publication|contact|connect|linkedin|github|work|role|experience|result|outcome|metric|more|else|about\s+that|about\s+it|they|them|their)\b/i;
      if (wordCount <= 15 || followUpRef.test(q)) {
        return true;
      }
    }

    return false;
  }

  function isRefusalResponse(text) {
    if (!text) return false;
    return (
      text.includes('only meant to answer') ||
      text.includes('only here to answer') ||
      text.includes('proprietary and confidential') ||
      text.includes('cannot accept prompts asking to ignore') ||
      text.includes('cannot engage with abusive') ||
      text.includes('reached the free limit of 5 questions') ||
      text.includes('Please wait a moment before sending')
    );
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

    // 4. Guardrail Check: Politely refuse any question that is not about Radu or is an off-topic task
    if (isOffTopicTaskAttempt(userQuestion) || !isQueryAboutRadu(userQuestion, prevQuery)) {
      const refusalText = "I am only meant to answer questions about Radu Stoian. Please feel free to ask anything about him, his background, skills, case studies, or projects.";
      await streamAgentResponse(refusalText, [], userQuestion);
      return;
    }

    // Only consume a question from the user's 5-question quota once pre-filters pass
    incrementSessionQueryCount();

    isGenerating = true;
    renderMessages();

    const currentPrev = prevQuery;

    let agentResponseText = '';
    let streamedChunkText = '';
    let liveBubble = null;
    const gatheredSources = [];
    const gatheredFanOut = [];
    let fanOutLang = 'en';
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
        liveBubble = createLiveAgentBubble(gatheredFanOut, fanOutLang);
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
        const err = new Error(`HTTP ${response.status}`);
        if (response.status === 400 || response.status === 403 || response.status === 429) {
          err.noRetry = true;
        }
        throw err;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';

      const processEvent = (evType, evBody) => {
        const dataLines = evBody
          .split('\n')
          .map(line => line.startsWith('data:') ? line.slice(5).replace(/^ /, '') : line);
        const cleanBody = dataLines.join('\n').trim();

        if (evType === 'reset') {
          streamedChunkText = '';
          agentResponseText = '';
          streamWordChunks = [];
          streamWordIndex = 0;
          gatheredSources.length = 0;
          gatheredFanOut.length = 0;
          if (liveBubble && liveBubble.fanoutSlot) {
            liveBubble.fanoutSlot.innerHTML = '';
          }
        } else if (evType === 'fanout') {
          try {
            const fanoutObj = JSON.parse(cleanBody);
            if (Array.isArray(fanoutObj.queries) && fanoutObj.queries.length > 0) {
              gatheredFanOut.length = 0;
              fanoutObj.queries.forEach(q => {
                if (q && typeof q === 'string') gatheredFanOut.push(q);
              });
              fanOutLang = fanoutObj.language || 'en';
              console.info('[NLWeb Fan-Out]', {
                query: userQuestion,
                language: fanOutLang,
                queries: gatheredFanOut,
                bm25Queries: fanoutObj.bm25_queries || gatheredFanOut,
                fromCache: Boolean(fanoutObj.from_cache)
              });
              if (!liveBubble) {
                liveBubble = createLiveAgentBubble(gatheredFanOut, fanOutLang);
              } else if (liveBubble.fanoutSlot) {
                liveBubble.fanoutSlot.innerHTML = '';
                const dropdown = createFanOutDropdown(gatheredFanOut, fanOutLang);
                if (dropdown) liveBubble.fanoutSlot.appendChild(dropdown);
              }
            }
          } catch (e) {
            // Ignore malformed fanout JSON
          }
        } else if (evType === 'chunk') {
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
            if (isRefusalResponse(cleanBody) && cleanBody !== streamedChunkText) {
              streamWordIndex = 0;
              gatheredSources.length = 0;
              gatheredFanOut.length = 0;
              if (liveBubble && liveBubble.fanoutSlot) {
                liveBubble.fanoutSlot.innerHTML = '';
              }
            }
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

      // Only update conversational context if the response was not a refusal
      if (!isRefusalResponse(targetText)) {
        prevQuery = userQuestion;
      }

      // Wait until all words have finished displaying at 5 words per second
      await typewriterPromise;

      if (liveBubble) {
        finalizeLiveAgentBubble(liveBubble, targetText, gatheredSources, userQuestion, gatheredFanOut, fanOutLang);
      } else {
        await streamAgentResponse(targetText, gatheredSources, userQuestion, gatheredFanOut, fanOutLang);
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

      if (streamError && streamError.noRetry) {
        messages.push({
          role: 'agent',
          content: LIMIT_REACHED_MESSAGE,
          sources: []
        });
        return;
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
        const fallbackFanOut = Array.isArray(data.search_queries) ? data.search_queries : [];
        const fallbackLang = data.language || 'en';
        if (fallbackFanOut.length > 0) {
          console.info('[NLWeb Fan-Out]', {
            query: userQuestion,
            language: fallbackLang,
            queries: fallbackFanOut
          });
        }

        const targetText = extractSmartAnswer(summary, userQuestion) || summary;
        if (!isRefusalResponse(targetText)) {
          prevQuery = userQuestion;
        }
        await streamAgentResponse(targetText, sources, userQuestion, fallbackFanOut, fallbackLang);
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

    // Check Question Cap (Maximum 5 questions per session / 24h window)
    const sessionCount = getSessionQueryCount();
    if (sessionCount >= MAX_SESSION_QUESTIONS) {
      await streamAgentResponse(LIMIT_REACHED_MESSAGE, [], text);
      return;
    }

    lastSubmitTime = now;

    // Query NLWeb (increments session count after client-side guardrails pass)
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
    if (isMaximized) toggleMaximize(false);

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
    const maxBtn = document.getElementById('nlwebMaximizeBtn');
    const form = document.getElementById('nlwebInputForm');
    const input = document.getElementById('nlwebTextInput');

    // Launcher click
    launcher.addEventListener('click', () => toggleDialog());

    // Close button
    if (closeBtn) closeBtn.addEventListener('click', () => toggleDialog(false));

    // Reset button
    if (resetBtn) resetBtn.addEventListener('click', handleReset);

    // Maximise / Restore button
    if (maxBtn) maxBtn.addEventListener('click', () => toggleMaximize());

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
          if (isMaximized) {
            dialog.style.height = `${vp.height}px`;
          }
        } else {
          dialog.style.bottom = '';
          dialog.style.maxHeight = '';
          if (isMaximized) {
            dialog.style.height = '';
          }
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

    // Anchor clicks within messages (smooth scrolling for internal hash links)
    const messagesContainer = document.getElementById('nlwebMessages');
    if (messagesContainer) {
      messagesContainer.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (anchor && isInternalUrl(anchor.getAttribute('href') || anchor.href)) {
          try {
            const parsed = new URL(anchor.href, window.location.href);
            if (parsed.pathname === window.location.pathname && parsed.hash) {
              const targetEl = document.querySelector(parsed.hash);
              if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth' });
              }
            }
          } catch {}
        }
      });
    }
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
        if (initialQuery && typeof initialQuery === 'string' && !isGenerating && !isStreaming) {
          const now = Date.now();
          if (now - lastSubmitTime < COOLDOWN_MS) return;

          const cleanQuery = initialQuery.slice(0, MAX_INPUT_CHARS).trim();
          if (!cleanQuery) return;

          messages.push({ role: 'user', content: cleanQuery });
          saveHistory();
          renderMessages();

          const sessionCount = getSessionQueryCount();
          if (sessionCount >= MAX_SESSION_QUESTIONS) {
            streamAgentResponse(LIMIT_REACHED_MESSAGE, [], cleanQuery);
            return;
          }

          lastSubmitTime = now;
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
      toggle: () => toggleDialog(),
      toggleMaximize: (forceState) => toggleMaximize(forceState),
      isMaximized: () => isMaximized
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
