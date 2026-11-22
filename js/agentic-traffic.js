(() => {
  "use strict";

  const STORAGE_KEY = "radustoian_dashboard_token_v1";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  const CLASS_COLORS = {
    interactive_rag_agent: "#a855f7",
    human_visitor: "#34d399",
    discovery_probe: "#f59e0b",
    automated_crawler: "#38bdf8"
  };

  const CHANNEL_PALETTE = [
    "#a855f7",
    "#34d399",
    "#38bdf8",
    "#f59e0b",
    "#f472b6",
    "#818cf8",
    "#94a3b8"
  ];

  const state = {
    token: "",
    remember: false,
    days: 30,
    data: null,
    filteredQuestions: [],
    filteredSessions: [],
    loading: false
  };

  const els = {};

  function resolveAnalyticsEndpoint() {
    const host = window.location.hostname;
    if (host === "radustoian.com" || host === "www.radustoian.com") {
      return "/api/v1/analytics";
    }
    return "https://radustoian.com/api/v1/analytics";
  }

  function formatNumber(val) {
    const num = Number(val);
    if (!Number.isFinite(num)) return "0";
    return new Intl.NumberFormat().format(num);
  }

  function formatCompact(val) {
    const num = Number(val);
    if (!Number.isFinite(num)) return "0";
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 10_000) return `${(num / 1_000).toFixed(1)}K`;
    return formatNumber(num);
  }

  function formatTimestampUtc(iso) {
    if (!iso) return "—";
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return String(iso);
    const d = new Date(ms);
    return d.toISOString().replace("T", " ").slice(0, 16);
  }

  function formatDurationSec(sec) {
    const n = Number(sec);
    if (!Number.isFinite(n) || n <= 0) return "0s";
    if (n < 60) return `${Math.round(n)}s`;
    const mins = Math.floor(n / 60);
    const rem = Math.round(n % 60);
    return `${mins}m ${rem}s`;
  }

  function trafficClassLabel(cls) {
    switch (cls) {
      case "interactive_rag_agent": return "Interactive AI Agent";
      case "human_visitor": return "Human Visitor";
      case "discovery_probe": return "Discovery Probe";
      case "automated_crawler": return "Automated Crawler";
      default: return cls || "Unknown";
    }
  }

  function trafficClassPillClass(cls) {
    switch (cls) {
      case "interactive_rag_agent": return "pill pill-violet";
      case "human_visitor": return "pill pill-green";
      case "discovery_probe": return "pill pill-amber";
      case "automated_crawler": return "pill pill-sky";
      default: return "pill pill-violet";
    }
  }

  function clearNode(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && v !== null) {
        node.setAttribute(k, String(v));
      }
    }
    return node;
  }

  function readStoredToken() {
    try {
      const local = window.localStorage.getItem(STORAGE_KEY);
      if (local) return { token: local, remember: true };
    } catch {
      // Ignore storage access errors
    }
    try {
      const sess = window.sessionStorage.getItem(STORAGE_KEY);
      if (sess) return { token: sess, remember: false };
    } catch {
      // Ignore storage access errors
    }
    return { token: "", remember: false };
  }

  function saveStoredToken(token, remember) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, token);
      if (remember) {
        window.localStorage.setItem(STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }

  function clearStoredToken() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  function showAuthError(msg) {
    if (!msg) {
      els.authError.hidden = true;
      els.authError.textContent = "";
      return;
    }
    els.authError.textContent = msg;
    els.authError.hidden = false;
  }

  function showDashBanner(msg, isInfo = false) {
    if (!msg) {
      els.dashBanner.hidden = true;
      els.dashBanner.textContent = "";
      return;
    }
    els.dashBanner.className = isInfo ? "alert alert-info" : "alert";
    els.dashBanner.textContent = msg;
    els.dashBanner.hidden = false;
  }

  function lockDashboard(message = "") {
    state.token = "";
    state.data = null;
    clearStoredToken();
    els.tokenInput.value = "";
    els.dashboardView.hidden = true;
    els.authGate.hidden = false;
    showDashBanner("");
    showAuthError(message);
    els.tokenInput.focus();
  }

  async function fetchAnalytics({ refresh = false } = {}) {
    if (!state.token || state.loading) return;
    state.loading = true;
    els.refreshBtn.disabled = true;
    els.unlockBtn.disabled = true;
    els.refreshBtn.textContent = "Loading...";
    showDashBanner("");

    const base = resolveAnalyticsEndpoint();
    const qs = new URLSearchParams({ days: String(state.days) });
    if (refresh) qs.set("refresh", "1");

    try {
      const resp = await fetch(`${base}?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Authorization": `Bearer ${state.token}`
        }
      });

      const payload = await resp.json().catch(() => null);

      if (resp.status === 401) {
        const errMsg = payload?.message || "Invalid dashboard token. Please enter your DASHBOARD_API_KEY.";
        lockDashboard(errMsg);
        return;
      }

      if (!resp.ok || !payload) {
        const errMsg = payload?.message || `Analytics request failed (HTTP ${resp.status}).`;
        if (els.dashboardView.hidden) {
          showAuthError(errMsg);
        } else {
          showDashBanner(errMsg);
        }
        return;
      }

      saveStoredToken(state.token, state.remember);
      showAuthError("");
      els.authGate.hidden = true;
      els.dashboardView.hidden = false;

      state.data = payload;
      renderAll(payload);
    } catch (err) {
      const errMsg = `Network error reaching analytics endpoint: ${err?.message || err}`;
      if (els.dashboardView.hidden) {
        showAuthError(errMsg);
      } else {
        showDashBanner(errMsg);
      }
    } finally {
      state.loading = false;
      els.refreshBtn.disabled = false;
      els.unlockBtn.disabled = false;
      els.refreshBtn.textContent = "Refresh";
    }
  }

  function renderAll(data) {
    renderHeaderAndKpis(data);
    renderDailyChart(data.dailySeries || []);
    renderChannelDonut(data.breakdowns?.channels || []);
    renderHorizontalBars(els.actionsBars, data.breakdowns?.actions || [], 8);
    renderHorizontalBars(els.platformsBars, data.breakdowns?.platforms || [], 8);
    renderHorizontalBars(els.topicsBars, data.breakdowns?.topics || [], 8);
    renderHorizontalBars(els.countriesBars, data.breakdowns?.countries || [], 8);
    renderTopQuestions(data.questions?.topRecurring || []);
    populateQuestionSourceFilter(data.questions?.recent || []);
    applyQuestionFilters();
    populateSessionSegmentFilter(data.sessions?.recent || []);
    applySessionFilters();

    const qCount = (data.questions?.recent || []).length;
    const sCount = (data.sessions?.recent || []).length;
    els.tabCountQuestions.textContent = String(qCount);
    els.tabCountSessions.textContent = String(sCount);
  }

  function renderHeaderAndKpis(data) {
    const k = data.kpis || {};
    els.datasetBadge.textContent = data.dataset || "BigQuery";
    els.cacheBadge.textContent = data.cacheStatus === "hit" ? "Edge Cache (5m)" : "Fresh BQ Query";
    els.updatedBadge.textContent = `Updated ${formatTimestampUtc(data.generatedAt)} UTC · Window: ${data.windowDays || state.days}d`;

    els.kpiTotalCalls.textContent = formatNumber(k.totalCalls);
    els.kpiTotalCallsSub.textContent = `${k.aiSharePct ?? 0}% AI (${formatNumber(k.aiAgentCalls)}) · ${formatNumber(k.humanCalls)} Human`;

    els.kpiSessions.textContent = formatNumber(k.uniqueSessions);
    els.kpiSessionsSub.textContent = `${formatNumber(k.engagedSessions)} engaged · ${formatNumber(k.oauthCalls)} OAuth calls`;

    const interactiveTotal = (Number(k.interactiveRagCalls) || 0) + (Number(k.humanChatCalls) || 0);
    els.kpiInteractive.textContent = formatNumber(interactiveTotal);
    els.kpiInteractiveSub.textContent = `Substantive: ${formatNumber(k.substantiveCalls)} · Crawlers: ${formatNumber(k.crawlerCalls)} · Probes: ${formatNumber(k.discoveryCalls)}`;

    els.kpiQuestions.textContent = formatNumber(k.totalQuestionsAsked);
    els.kpiQuestionsSub.textContent = `${formatNumber(k.uniqueQuestionsCount)} unique normalized prompts`;

    const latencyStr = k.avgLatencyMs !== null && k.avgLatencyMs !== undefined ? `${k.avgLatencyMs} ms` : "—";
    els.kpiKbLatency.textContent = `${k.kbMatchRatePct ?? 0}% KB`;
    els.kpiKbLatencySub.textContent = `Avg latency: ${latencyStr} · Cache hit: ${k.cacheHitRatePct ?? 0}%`;

    els.kpiTokens.textContent = formatCompact(k.totalTokensDelivered);
    els.kpiTokensSub.textContent = `Blocked: ${formatNumber(k.guardrailBlockedCalls)} · Errors: ${formatNumber(k.errorCalls)} (${k.errorRatePct ?? 0}%)`;
  }

  function showTooltip(event, lines) {
    clearNode(els.chartTooltip);
    for (let i = 0; i < lines.length; i++) {
      const div = el("div", i === 0 ? "q-primary" : "");
      div.style.fontSize = i === 0 ? "0.8rem" : "0.75rem";
      div.textContent = lines[i];
      els.chartTooltip.appendChild(div);
    }
    els.chartTooltip.hidden = false;
    const pad = 14;
    const rect = els.chartTooltip.getBoundingClientRect();
    let x = (event.clientX || 0) + pad;
    let y = (event.clientY || 0) - rect.height - 10;
    if (x + rect.width > window.innerWidth - 10) x = (event.clientX || 0) - rect.width - pad;
    if (y < 10) y = (event.clientY || 0) + pad;
    els.chartTooltip.style.left = `${Math.max(8, x)}px`;
    els.chartTooltip.style.top = `${Math.max(8, y)}px`;
  }

  function hideTooltip() {
    els.chartTooltip.hidden = true;
  }

  function renderDailyChart(series) {
    clearNode(els.dailyChartStage);
    if (!series.length) {
      els.dailyChartStage.appendChild(el("div", "empty-state", "No events recorded in the selected window yet."));
      return;
    }

    const width = 880;
    const height = 270;
    const margin = { top: 14, right: 16, bottom: 34, left: 46 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    const maxTotal = Math.max(
      1,
      ...series.map((d) =>
        (Number(d.interactive_rag_calls) || 0) +
        (Number(d.human_calls) || 0) +
        (Number(d.discovery_calls) || 0) +
        (Number(d.crawler_calls) || 0) ||
        (Number(d.total_calls) || 0)
      )
    );

    const svg = svgEl("svg", {
      viewBox: `0 0 ${width} ${height}`,
      class: "chart-svg",
      role: "img",
      "aria-label": "Daily traffic volume stacked bar chart"
    });

    // Horizontal grid lines
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const val = Math.round((maxTotal / ticks) * i);
      const y = margin.top + plotH - (plotH * i) / ticks;
      svg.appendChild(svgEl("line", {
        x1: margin.left,
        y1: y,
        x2: width - margin.right,
        y2: y,
        stroke: "rgba(216, 180, 254, 0.12)",
        "stroke-dasharray": i === 0 ? "" : "3,4"
      }));
      const lbl = svgEl("text", {
        x: margin.left - 8,
        y: y + 4,
        "text-anchor": "end",
        fill: "#9494ad",
        "font-size": "11",
        "font-family": "ui-monospace, monospace"
      });
      lbl.textContent = formatCompact(val);
      svg.appendChild(lbl);
    }

    const step = plotW / series.length;
    const barW = Math.max(4, Math.min(28, step * 0.68));
    const segments = [
      ["interactive_rag_calls", "AI Agent RAG", CLASS_COLORS.interactive_rag_agent],
      ["human_calls", "Human", CLASS_COLORS.human_visitor],
      ["discovery_calls", "Discovery", CLASS_COLORS.discovery_probe],
      ["crawler_calls", "Crawler", CLASS_COLORS.automated_crawler]
    ];

    const labelEvery = Math.max(1, Math.ceil(series.length / 8));

    series.forEach((day, idx) => {
      const x = margin.left + idx * step + (step - barW) / 2;
      let cursorY = margin.top + plotH;

      for (const [field, , color] of segments) {
        const count = Number(day[field]) || 0;
        if (count <= 0) continue;
        const segH = (count / maxTotal) * plotH;
        cursorY -= segH;
        svg.appendChild(svgEl("rect", {
          x: x.toFixed(2),
          y: cursorY.toFixed(2),
          width: barW.toFixed(2),
          height: Math.max(1, segH).toFixed(2),
          rx: "2",
          fill: color
        }));
      }

      // Hover target spanning full column height
      const hit = svgEl("rect", {
        x: (margin.left + idx * step).toFixed(2),
        y: margin.top,
        width: step.toFixed(2),
        height: plotH,
        fill: "transparent",
        tabindex: "0"
      });

      const lines = [
        `${day.event_date} · ${formatNumber(day.total_calls)} calls`,
        `Sessions: ${formatNumber(day.unique_sessions)} · Tokens: ${formatCompact(day.tokens_delivered)}`,
        `AI Agent: ${formatNumber(day.interactive_rag_calls)} · Human: ${formatNumber(day.human_calls)}`,
        `Discovery: ${formatNumber(day.discovery_calls)} · Crawler: ${formatNumber(day.crawler_calls)}`
      ];

      hit.addEventListener("mousemove", (e) => showTooltip(e, lines));
      hit.addEventListener("mouseenter", (e) => showTooltip(e, lines));
      hit.addEventListener("mouseleave", hideTooltip);
      hit.addEventListener("focus", () => {
        const r = hit.getBoundingClientRect();
        showTooltip({ clientX: r.left + r.width / 2, clientY: r.top + 20 }, lines);
      });
      hit.addEventListener("blur", hideTooltip);
      svg.appendChild(hit);

      if (idx % labelEvery === 0 || idx === series.length - 1) {
        const dateLabel = svgEl("text", {
          x: (x + barW / 2).toFixed(2),
          y: height - 10,
          "text-anchor": "middle",
          fill: "#9494ad",
          "font-size": "11",
          "font-family": "ui-monospace, monospace"
        });
        dateLabel.textContent = String(day.event_date || "").slice(5);
        svg.appendChild(dateLabel);
      }
    });

    els.dailyChartStage.appendChild(svg);
  }

  function renderChannelDonut(channels) {
    clearNode(els.channelDonutContainer);
    if (!channels.length) {
      els.channelDonutContainer.appendChild(el("div", "empty-state", "No channel data in window."));
      return;
    }

    const total = channels.reduce((acc, row) => acc + (Number(row.calls) || 0), 0);
    const wrap = el("div", "donut-layout");
    const svgBox = el("div", "donut-wrap");
    const size = 170;
    const cx = 85;
    const cy = 85;
    const r = 62;
    const circumference = 2 * Math.PI * r;

    const svg = svgEl("svg", {
      viewBox: `0 0 ${size} ${size}`,
      class: "chart-svg",
      role: "img",
      "aria-label": "Channel surface distribution donut chart"
    });

    let offset = 0;
    const topSlices = channels.slice(0, 6);
    topSlices.forEach((item, idx) => {
      const value = Number(item.calls) || 0;
      const frac = total > 0 ? value / total : 0;
      const dashLen = frac * circumference;
      const ring = svgEl("circle", {
        cx,
        cy,
        r,
        fill: "none",
        stroke: CHANNEL_PALETTE[idx % CHANNEL_PALETTE.length],
        "stroke-width": "22",
        "stroke-dasharray": `${dashLen.toFixed(2)} ${circumference.toFixed(2)}`,
        "stroke-dashoffset": (-offset).toFixed(2),
        transform: `rotate(-90 ${cx} ${cy})`
      });
      svg.appendChild(ring);
      offset += dashLen;
    });

    const centerVal = svgEl("text", {
      x: cx,
      y: cy + 3,
      "text-anchor": "middle",
      fill: "#f8fafc",
      "font-size": "21",
      "font-weight": "700",
      "font-family": "Fraunces, Georgia, serif"
    });
    centerVal.textContent = formatCompact(total);
    svg.appendChild(centerVal);

    const centerSub = svgEl("text", {
      x: cx,
      y: cy + 20,
      "text-anchor": "middle",
      fill: "#9494ad",
      "font-size": "10",
      "letter-spacing": "0.08em"
    });
    centerSub.textContent = "CALLS";
    svg.appendChild(centerSub);

    svgBox.appendChild(svg);
    wrap.appendChild(svgBox);

    const legend = el("div", "donut-legend");
    channels.slice(0, 7).forEach((item, idx) => {
      const row = el("div", "donut-row");
      const left = el("span", "legend-item");
      const swatch = el("span", "swatch");
      swatch.style.background = CHANNEL_PALETTE[idx % CHANNEL_PALETTE.length];
      left.appendChild(swatch);
      left.appendChild(document.createTextNode(item.label || "Other"));

      const pct = total > 0 ? Math.round(((Number(item.calls) || 0) / total) * 100) : 0;
      const right = el("span", "hbar-nums", `${formatNumber(item.calls)} (${pct}%)`);
      row.appendChild(left);
      row.appendChild(right);
      legend.appendChild(row);
    });

    wrap.appendChild(legend);
    els.channelDonutContainer.appendChild(wrap);
  }

  function renderHorizontalBars(container, rows, limit = 8) {
    clearNode(container);
    const items = rows.slice(0, limit);
    if (!items.length) {
      container.appendChild(el("div", "empty-state", "No breakdown records for this dimension."));
      return;
    }

    const maxCalls = Math.max(1, ...items.map((r) => Number(r.calls) || 0));
    for (const item of items) {
      const row = el("div", "hbar-row");
      const meta = el("div", "hbar-meta");
      const lbl = el("span", "hbar-label", item.label || "Unknown");
      lbl.title = item.label || "Unknown";

      const latPart = item.avgLatencyMs !== null && item.avgLatencyMs !== undefined ? ` · ${item.avgLatencyMs}ms` : "";
      const nums = el("span", "hbar-nums", `${formatNumber(item.calls)} calls (${formatNumber(item.sessions)} sess${latPart})`);
      meta.appendChild(lbl);
      meta.appendChild(nums);

      const track = el("div", "hbar-track");
      const fill = el("div", "hbar-fill");
      const pct = Math.max(3, Math.round(((Number(item.calls) || 0) / maxCalls) * 100));
      fill.style.width = `${pct}%`;
      track.appendChild(fill);

      row.appendChild(meta);
      row.appendChild(track);
      container.appendChild(row);
    }
  }

  function makeCell(label, text, { numeric = false, sortValue = null } = {}) {
    const td = el("td", numeric ? "num-cell" : "");
    td.dataset.label = label;
    if (sortValue !== null && sortValue !== undefined) {
      td.dataset.value = String(sortValue);
    }
    if (text !== undefined && text !== null) {
      td.textContent = String(text);
    }
    return td;
  }

  function renderTopQuestions(rows) {
    clearNode(els.tbodyTopQuestions);
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", "No questions logged in this time window.");
      td.colSpan = 7;
      tr.appendChild(td);
      els.tbodyTopQuestions.appendChild(tr);
      return;
    }

    for (const row of rows) {
      const tr = el("tr");
      tr.dataset.clickable = "true";
      tr.title = "Click to filter detailed question log by this prompt";

      const qText = row.sample_question || row.normalized_question || "—";
      const tdQ = makeCell("Question", null, { sortValue: qText });
      const qDiv = el("div", "q-primary", qText);
      const subDiv = el("div", "q-sub", `${row.kb_matched_count || 0} KB matched · ${row.blocked_count || 0} blocked`);
      tdQ.appendChild(qDiv);
      tdQ.appendChild(subDiv);
      tr.appendChild(tdQ);

      tr.appendChild(makeCell("Times Asked", formatNumber(row.times_asked), { numeric: true, sortValue: row.times_asked || 0 }));
      tr.appendChild(makeCell("Sessions", formatNumber(row.unique_sessions), { numeric: true, sortValue: row.unique_sessions || 0 }));
      tr.appendChild(makeCell("Sources", row.sources || "—"));
      tr.appendChild(makeCell("Topic", row.canonical_topic || "—"));
      tr.appendChild(makeCell("Avg BM25", row.avg_bm25_score ?? "—", { numeric: true, sortValue: row.avg_bm25_score ?? -1 }));

      const lastMs = Date.parse(row.last_asked || "") || 0;
      tr.appendChild(makeCell("Last Asked", formatTimestampUtc(row.last_asked), { numeric: true, sortValue: lastMs }));

      tr.addEventListener("click", () => {
        els.qSearch.value = row.normalized_question || row.sample_question || "";
        applyQuestionFilters();
        els.tblRecentQuestions.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      els.tbodyTopQuestions.appendChild(tr);
    }
  }

  function populateQuestionSourceFilter(rows) {
    const prev = els.qSourceFilter.value || "all";
    const sources = new Set();
    for (const r of rows) {
      if (r.question_source) sources.add(r.question_source);
    }
    clearNode(els.qSourceFilter);
    els.qSourceFilter.appendChild(el("option", "", "All Sources")).value = "all";
    for (const s of [...sources].sort((a, b) => collator.compare(a, b))) {
      const opt = el("option", "", s);
      opt.value = s;
      els.qSourceFilter.appendChild(opt);
    }
    els.qSourceFilter.value = sources.has(prev) ? prev : "all";
  }

  function applyQuestionFilters() {
    const all = state.data?.questions?.recent || [];
    const term = els.qSearch.value.trim().toLowerCase();
    const src = els.qSourceFilter.value;
    const status = els.qStatusFilter.value;

    const filtered = all.filter((r) => {
      if (src !== "all" && r.question_source !== src) return false;
      if (status === "matched" && (!r.matched_kb || r.guardrail_blocked)) return false;
      if (status === "missed" && (r.matched_kb || r.guardrail_blocked)) return false;
      if (status === "blocked" && !r.guardrail_blocked) return false;
      if (!term) return true;
      const haystack = [
        r.question_asked,
        r.normalized_question,
        r.canonical_topic,
        r.primary_section,
        r.client_or_platform,
        r.question_source,
        r.fanout_queries_text,
        r.response_preview,
        r.country
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });

    state.filteredQuestions = filtered;
    renderRecentQuestions(filtered);
  }

  function renderRecentQuestions(rows) {
    clearNode(els.tbodyRecentQuestions);
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", "No questions match the current filters.");
      td.colSpan = 8;
      tr.appendChild(td);
      els.tbodyRecentQuestions.appendChild(tr);
      return;
    }

    for (const row of rows) {
      const tr = el("tr");
      tr.dataset.clickable = "true";

      const tsMs = Date.parse(row.event_timestamp || "") || 0;
      tr.appendChild(makeCell("Time (UTC)", formatTimestampUtc(row.event_timestamp), { numeric: true, sortValue: tsMs }));

      const tdQ = makeCell("Question Asked", null, { sortValue: row.question_asked || "" });
      tdQ.appendChild(el("div", "q-primary", row.question_asked || "—"));
      const subBits = [];
      if (row.turn_type) subBits.push(row.turn_type);
      if (row.session_turn_index) subBits.push(`Turn ${row.session_turn_index}`);
      if (row.query_language) subBits.push(row.query_language.toUpperCase());
      if (row.country && row.country !== "unknown") subBits.push(row.country);
      tdQ.appendChild(el("div", "q-sub", subBits.join(" · ") || "—"));
      tr.appendChild(tdQ);

      const srcLabel = row.question_source || "Unknown";
      const clientLabel = row.client_or_platform || row.agent_platform || "Unknown";
      const tdSrc = makeCell("Source / Client", null, { sortValue: `${srcLabel} ${clientLabel}` });
      tdSrc.appendChild(el("div", "q-primary", srcLabel));
      tdSrc.appendChild(el("div", "q-sub", clientLabel));
      tr.appendChild(tdSrc);

      const tdTopic = makeCell("Topic / Section", null, { sortValue: row.canonical_topic || "" });
      tdTopic.appendChild(el("div", "q-primary", row.canonical_topic || "—"));
      tdTopic.appendChild(el("div", "q-sub", row.primary_section || "—"));
      tr.appendChild(tdTopic);

      tr.appendChild(makeCell("BM25", row.top_bm25_score ?? "—", { numeric: true, sortValue: row.top_bm25_score ?? -1 }));
      const lat = row.request_duration_ms;
      tr.appendChild(makeCell("Latency", lat !== null && lat !== undefined ? `${lat} ms` : "—", { numeric: true, sortValue: lat ?? -1 }));

      const tdOutcome = makeCell("Outcome", null);
      if (row.guardrail_blocked) {
        tdOutcome.appendChild(el("span", "pill pill-rose", "Blocked"));
      } else if (row.matched_kb) {
        tdOutcome.appendChild(el("span", "pill pill-green", row.cache_hit_flag === 1 ? "KB + Cache" : "KB Hit"));
      } else {
        tdOutcome.appendChild(el("span", "pill pill-amber", "No KB Match"));
      }
      tr.appendChild(tdOutcome);

      const tdInspect = makeCell("Inspect", null);
      const inspectBtn = el("button", "btn btn-sm btn-ghost", "View");
      inspectBtn.type = "button";
      inspectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openQuestionDialog(row);
      });
      tdInspect.appendChild(inspectBtn);
      tr.appendChild(tdInspect);

      tr.addEventListener("click", () => openQuestionDialog(row));
      els.tbodyRecentQuestions.appendChild(tr);
    }
  }

  function addDetailBlock(container, label, value) {
    if (value === null || value === undefined || value === "") return;
    const block = el("div", "detail-block");
    block.appendChild(el("div", "detail-label", label));
    block.appendChild(el("div", "detail-value", String(value)));
    container.appendChild(block);
  }

  function openQuestionDialog(row) {
    clearNode(els.dlgBody);
    els.dlgMetaPill.textContent = `${row.question_source || "Telemetry"} · ${formatTimestampUtc(row.event_timestamp)} UTC`;
    els.dlgMetaPill.className = row.guardrail_blocked
      ? "pill pill-rose"
      : row.matched_kb
        ? "pill pill-green"
        : "pill pill-amber";

    els.dlgQuestionTitle.textContent = row.question_asked || "Question Telemetry";

    addDetailBlock(els.dlgBody, "Normalized Question", row.normalized_question);
    addDetailBlock(els.dlgBody, "Previous Turn Question", row.previous_turn_question);
    addDetailBlock(els.dlgBody, "Gemini Fanout Search Queries", row.fanout_queries_text);
    addDetailBlock(els.dlgBody, "Matched KB Sections", row.matched_sections_text);
    if (row.guardrail_blocked) {
      addDetailBlock(els.dlgBody, "Guardrail Reason", row.guardrail_reason || "Blocked");
    }
    addDetailBlock(els.dlgBody, "Response Preview", row.response_preview);

    const grid = el("div", "detail-grid");
    addDetailBlock(grid, "Client / Platform", row.client_or_platform || row.agent_platform || "—");
    addDetailBlock(grid, "Traffic Class", trafficClassLabel(row.traffic_class));
    addDetailBlock(grid, "Topic / Primary Section", `${row.canonical_topic || "—"} / ${row.primary_section || "—"}`);
    addDetailBlock(grid, "BM25 / Results", `${row.top_bm25_score ?? "—"} (${row.results_count ?? 0} results)`);
    addDetailBlock(grid, "Latency / Tokens", `${row.request_duration_ms ?? "—"} ms · ${row.estimated_tokens ?? 0} tok`);
    addDetailBlock(grid, "Location / Network", [row.city, row.country, row.as_organization].filter((x) => x && x !== "unknown").join(" · ") || "—");
    addDetailBlock(grid, "Session ID (Turn)", `${row.session_id || "—"} (#${row.session_turn_index ?? 1})`);
    els.dlgBody.appendChild(grid);

    if (typeof els.questionDialog.showModal === "function") {
      els.questionDialog.showModal();
    }
  }

  function populateSessionSegmentFilter(rows) {
    const prev = els.sSegmentFilter.value || "all";
    const classes = new Set();
    for (const r of rows) {
      if (r.session_traffic_class) classes.add(r.session_traffic_class);
    }
    clearNode(els.sSegmentFilter);
    els.sSegmentFilter.appendChild(el("option", "", "All Traffic Classes")).value = "all";
    for (const c of [...classes].sort((a, b) => collator.compare(a, b))) {
      const opt = el("option", "", trafficClassLabel(c));
      opt.value = c;
      els.sSegmentFilter.appendChild(opt);
    }
    els.sSegmentFilter.value = classes.has(prev) ? prev : "all";
  }

  function applySessionFilters() {
    const all = state.data?.sessions?.recent || [];
    const term = els.sSearch.value.trim().toLowerCase();
    const seg = els.sSegmentFilter.value;

    const filtered = all.filter((r) => {
      if (seg !== "all" && r.session_traffic_class !== seg) return false;
      if (!term) return true;
      const haystack = [
        r.session_id,
        r.agent_platform,
        r.primary_protocol,
        r.session_traffic_class,
        r.actions_summary,
        r.topics_summary,
        r.questions_summary,
        r.country,
        r.as_organization
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });

    state.filteredSessions = filtered;
    renderSessions(filtered);
  }

  function renderSessions(rows) {
    clearNode(els.tbodySessions);
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", "No sessions match the current filters.");
      td.colSpan = 7;
      tr.appendChild(td);
      els.tbodySessions.appendChild(tr);
      return;
    }

    for (const row of rows) {
      const tr = el("tr");
      const endMs = Date.parse(row.session_end || row.session_start || "") || 0;
      tr.appendChild(makeCell("Last Activity", formatTimestampUtc(row.session_end || row.session_start), { numeric: true, sortValue: endMs }));

      const tdPlat = makeCell("Platform & Session", null, { sortValue: row.agent_platform || "" });
      const geoBits = [row.primary_protocol, row.country && row.country !== "unknown" ? row.country : null, row.is_oauth_authenticated ? "OAuth" : null].filter(Boolean);
      tdPlat.appendChild(el("div", "q-primary", row.agent_platform || "Unknown"));
      tdPlat.appendChild(el("div", "q-sub", `${geoBits.join(" · ")} · ${(row.session_id || "").slice(0, 12)}`));
      tr.appendChild(tdPlat);

      const tdClass = makeCell("Classification", null, { sortValue: row.session_traffic_class || "" });
      tdClass.appendChild(el("span", trafficClassPillClass(row.session_traffic_class), trafficClassLabel(row.session_traffic_class)));
      if (row.engaged_session_flag === 1) {
        const sub = el("div", "q-sub", "Engaged");
        tdClass.appendChild(sub);
      }
      tr.appendChild(tdClass);

      const callsText = `${row.total_calls ?? 0} (${row.interactive_retrieval_calls ?? 0} subst.)`;
      tr.appendChild(makeCell("Calls", callsText, { numeric: true, sortValue: row.total_calls || 0 }));
      tr.appendChild(makeCell("Duration", formatDurationSec(row.session_duration_sec), { numeric: true, sortValue: row.session_duration_sec || 0 }));
      tr.appendChild(makeCell("Tokens", formatCompact(row.total_tokens_delivered || 0), { numeric: true, sortValue: row.total_tokens_delivered || 0 }));

      const tdTrail = makeCell("Trail", null, { sortValue: row.actions_summary || "" });
      tdTrail.appendChild(el("div", "q-primary", row.questions_summary || row.actions_summary || "—"));
      tdTrail.appendChild(el("div", "q-sub", [row.topics_summary, row.actions_summary && row.questions_summary ? row.actions_summary : null].filter(Boolean).join(" · ") || "—"));
      tr.appendChild(tdTrail);

      els.tbodySessions.appendChild(tr);
    }
  }

  function escapeCsvCell(val) {
    const str = String(val === null || val === undefined ? "" : val);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function exportFilteredQuestionsCsv() {
    const rows = state.filteredQuestions;
    if (!rows.length) {
      showDashBanner("No rows in the filtered question table to export.", true);
      return;
    }

    const headers = [
      "event_timestamp",
      "question_source",
      "client_or_platform",
      "traffic_class",
      "question_asked",
      "normalized_question",
      "canonical_topic",
      "primary_section",
      "top_bm25_score",
      "results_count",
      "matched_kb",
      "guardrail_blocked",
      "request_duration_ms",
      "estimated_tokens",
      "country",
      "session_id"
    ];

    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(headers.map((h) => escapeCsvCell(r[h])).join(","));
    }

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `radustoian-questions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // Accessible Tab Controller (modern-web-guidance tabs pattern)
  function initTabs() {
    const tabBtns = Array.from(document.querySelectorAll('.tabs-bar [role="tab"]'));
    const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

    function activateTab(targetBtn, { moveFocus = false } = {}) {
      if (!targetBtn) return;
      const panelId = targetBtn.dataset.panel;

      for (const btn of tabBtns) {
        const active = btn === targetBtn;
        btn.setAttribute("aria-selected", active ? "true" : "false");
        btn.toggleAttribute("focusgroupstart", active);
        btn.tabIndex = active ? 0 : -1;
      }

      for (const panel of panels) {
        if (panel.id === panelId) {
          panel.removeAttribute("hidden");
        } else {
          panel.setAttribute("hidden", "until-found");
        }
      }

      if (moveFocus) {
        targetBtn.focus();
      }
    }

    for (let i = 0; i < tabBtns.length; i++) {
      const btn = tabBtns[i];
      btn.addEventListener("click", () => activateTab(btn));

      btn.addEventListener("keydown", (e) => {
        let nextIdx = -1;
        if (e.key === "ArrowRight") nextIdx = (i + 1) % tabBtns.length;
        else if (e.key === "ArrowLeft") nextIdx = (i - 1 + tabBtns.length) % tabBtns.length;
        else if (e.key === "Home") nextIdx = 0;
        else if (e.key === "End") nextIdx = tabBtns.length - 1;
        if (nextIdx >= 0) {
          e.preventDefault();
          activateTab(tabBtns[nextIdx], { moveFocus: true });
        }
      });
    }

    // Automatically switch to the matching tab when browser Find-in-Page matches inside a hidden="until-found" panel
    for (const panel of panels) {
      panel.addEventListener("beforematch", () => {
        const ownerBtn = tabBtns.find((btn) => btn.dataset.panel === panel.id);
        if (ownerBtn) {
          activateTab(ownerBtn);
        }
      });
    }
  }

  // Accessible Sortable Table Controller (modern-web-guidance sortable-table pattern)
  function sortTableByHeader(table, th) {
    const tbody = table.tBodies[0];
    if (!tbody) return;
    const rows = Array.from(tbody.rows);
    if (!rows.length || (rows.length === 1 && rows[0].cells.length === 1)) return;

    const colIdx = Number(th.dataset.col);
    const type = th.dataset.type || "text";
    const currentSort = th.getAttribute("aria-sort");
    const nextDir = currentSort === "ascending" ? "descending" : "ascending";

    for (const header of table.querySelectorAll("thead th[data-sortable]")) {
      if (header === th) {
        header.setAttribute("aria-sort", nextDir);
      } else {
        header.removeAttribute("aria-sort");
      }
    }

    rows.sort((a, b) => {
      const cellA = a.cells[colIdx];
      const cellB = b.cells[colIdx];
      const rawA = cellA?.dataset.value ?? cellA?.textContent ?? "";
      const rawB = cellB?.dataset.value ?? cellB?.textContent ?? "";

      let cmp = 0;
      if (type === "number" || type === "date") {
        const numA = Number(rawA);
        const numB = Number(rawB);
        cmp = (Number.isFinite(numA) ? numA : -Infinity) - (Number.isFinite(numB) ? numB : -Infinity);
      } else {
        cmp = collator.compare(String(rawA).trim(), String(rawB).trim());
      }
      return nextDir === "ascending" ? cmp : -cmp;
    });

    const useMoveBefore = typeof tbody.moveBefore === "function";
    for (const row of rows) {
      if (useMoveBefore) {
        tbody.moveBefore(row, null);
      } else {
        tbody.appendChild(row);
      }
    }

    const colName = th.textContent.replace(/[↕▲▼]/g, "").trim();
    els.sortStatus.textContent = `Sorted ${colName} ${nextDir}`;
  }

  function initSortableTables() {
    for (const table of document.querySelectorAll("table.data-table")) {
      table.addEventListener("command", (e) => {
        if (e.command !== "--sort" || !e.source) return;
        const th = e.source.closest("th[data-sortable]");
        if (!th) return;
        e.source.dataset.lastCmdTs = String(performance.now());
        sortTableByHeader(table, th);
      });

      for (const btn of table.querySelectorAll('button.sort-btn[command="--sort"]')) {
        btn.addEventListener("click", () => {
          const last = Number(btn.dataset.lastCmdTs || 0);
          if (performance.now() - last < 80) return;
          const th = btn.closest("th[data-sortable]");
          if (th) sortTableByHeader(table, th);
        });
      }
    }
  }

  function bindEvents() {
    els.authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const entered = els.tokenInput.value.trim();
      if (!entered) {
        showAuthError("Please enter your DASHBOARD_API_KEY token.");
        return;
      }
      state.token = entered;
      state.remember = Boolean(els.rememberTokenChk.checked);
      fetchAnalytics({ refresh: false });
    });

    els.toggleTokenBtn.addEventListener("click", () => {
      const showing = els.tokenInput.type === "text";
      els.tokenInput.type = showing ? "password" : "text";
      els.toggleTokenBtn.textContent = showing ? "Show" : "Hide";
    });

    els.windowSelect.addEventListener("change", () => {
      state.days = Number.parseInt(els.windowSelect.value, 10) || 30;
      fetchAnalytics({ refresh: false });
    });

    els.refreshBtn.addEventListener("click", () => {
      fetchAnalytics({ refresh: true });
    });

    els.lockBtn.addEventListener("click", () => {
      lockDashboard("");
    });

    els.qSearch.addEventListener("input", applyQuestionFilters);
    els.qSourceFilter.addEventListener("change", applyQuestionFilters);
    els.qStatusFilter.addEventListener("change", applyQuestionFilters);
    els.exportQuestionsBtn.addEventListener("click", exportFilteredQuestionsCsv);

    els.sSearch.addEventListener("input", applySessionFilters);
    els.sSegmentFilter.addEventListener("change", applySessionFilters);

    els.dlgCloseBtn.addEventListener("click", () => els.questionDialog.close());
    els.questionDialog.addEventListener("click", (e) => {
      if (e.target === els.questionDialog) {
        els.questionDialog.close();
      }
    });
  }

  function cacheElements() {
    const ids = [
      "authGate", "authForm", "tokenInput", "toggleTokenBtn", "rememberTokenChk", "unlockBtn", "authError",
      "dashboardView", "datasetBadge", "cacheBadge", "updatedBadge", "windowSelect", "refreshBtn", "lockBtn", "dashBanner",
      "kpiTotalCalls", "kpiTotalCallsSub", "kpiSessions", "kpiSessionsSub", "kpiInteractive", "kpiInteractiveSub",
      "kpiQuestions", "kpiQuestionsSub", "kpiKbLatency", "kpiKbLatencySub", "kpiTokens", "kpiTokensSub",
      "tabCountQuestions", "tabCountSessions",
      "dailyChartStage", "channelDonutContainer", "actionsBars", "platformsBars", "topicsBars", "countriesBars",
      "tblTopQuestions", "tbodyTopQuestions", "tblRecentQuestions", "tbodyRecentQuestions",
      "qSearch", "qSourceFilter", "qStatusFilter", "exportQuestionsBtn",
      "tblSessions", "tbodySessions", "sSearch", "sSegmentFilter",
      "sortStatus", "chartTooltip", "questionDialog", "dlgMetaPill", "dlgQuestionTitle", "dlgCloseBtn", "dlgBody"
    ];
    for (const id of ids) {
      els[id] = document.getElementById(id);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    initTabs();
    initSortableTables();
    bindEvents();

    const stored = readStoredToken();
    if (stored.token) {
      state.token = stored.token;
      state.remember = stored.remember;
      els.rememberTokenChk.checked = stored.remember;
      els.tokenInput.value = stored.token;
      fetchAnalytics({ refresh: false });
    }
  });
})();
