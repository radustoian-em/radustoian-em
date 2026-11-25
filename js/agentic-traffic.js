(() => {
  "use strict";

  const STORAGE_KEY = "radustoian_dashboard_token_v1";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  const CLASS_COLORS = {
    USER_DRIVEN_AGENT: "#a855f7",
    AUTOMATED_AGENT_CRAWLER: "#38bdf8",
    HUMAN_INTERACTIVE: "#34d399"
  };

  const INTENT_PALETTE = [
    "#a855f7",
    "#38bdf8",
    "#34d399",
    "#f59e0b",
    "#f472b6",
    "#818cf8"
  ];

  const CHART_MONTH_DAY_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const CHART_FULL_DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const CHART_MONTH_YEAR_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

  const state = {
    token: "",
    remember: false,
    window: "30",
    days: 30,
    data: null,
    agentFilter: "all",
    callPurpose: "all",
    actionEventsCache: new Map(),
    askHistory: [],
    askLoading: false,
    filteredMcp: [],
    filteredChat: [],
    filteredWebmcp: [],
    filteredSessions: [],
    loading: false
  };

  let activateCallTypeTab = () => {};

  const els = {};

  function resolveAnalyticsEndpoint() {
    const host = window.location.hostname;
    if (host === "radustoian.com" || host === "www.radustoian.com") {
      return "/api/v1/analytics";
    }
    return "https://radustoian.com/api/v1/analytics";
  }

  function resolveAnalyticsAskEndpoint() {
    const host = window.location.hostname;
    if (host === "radustoian.com" || host === "www.radustoian.com") {
      return "/api/v1/analytics/ask";
    }
    return "https://radustoian.com/api/v1/analytics/ask";
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

  function trafficClassLabel(cls) {
    switch (cls) {
      case "USER_DRIVEN_AGENT": return "User-Driven AI Agent";
      case "AUTOMATED_AGENT_CRAWLER": return "Automated Bot / Crawler";
      case "HUMAN_INTERACTIVE": return "Human Visitor (Chat)";
      default: return cls || "Unknown";
    }
  }

  function trafficClassPillClass(cls) {
    switch (cls) {
      case "USER_DRIVEN_AGENT": return "pill pill-violet";
      case "AUTOMATED_AGENT_CRAWLER": return "pill pill-sky";
      case "HUMAN_INTERACTIVE": return "pill pill-green";
      default: return "pill pill-amber";
    }
  }

  function intentLabel(intent) {
    switch (intent) {
      case "capability_discovery": return "Capability / Directory Scan";
      case "directory_scan": return "MCP Directory / Registry Scan";
      case "research_bot": return "Research Bot / Academic Crawler";
      case "bulk_crawl": return "Bulk Crawl / Research Bot";
      case "prompt_grounded_qa": return "Question Answering (Q&A)";
      case "targeted_section_lookup": return "Targeted Section Lookup";
      case "ui_navigation": return "In-Browser UI Action (WebMCP)";
      case "oauth_handshake": return "OAuth Handshake";
      case "session_termination": return "Session Termination";
      case "citation_verification": return "Citation / Link Check";
      default: return intent || "Other";
    }
  }

  function truncate(str, max = 90) {
    const s = String(str || "").trim();
    if (!s) return "—";
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1)}…`;
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
    state.actionEventsCache.clear();
    state.askHistory = [];
    state.askLoading = false;
    resetAskThread();
    clearStoredToken();
    els.tokenInput.value = "";
    els.dashboardView.hidden = true;
    els.authGate.hidden = false;
    showDashBanner("");
    showAuthError(message);
    els.tokenInput.focus();
  }

  function formatWindowLabel(winVal) {
    const val = String(winVal ?? "30").trim().toLowerCase();
    if (val === "1h") return "Last 1 hour";
    if (val === "today") return "Today (UTC)";
    if (val === "yesterday") return "Yesterday (UTC)";
    const days = Number.parseInt(val, 10);
    return Number.isFinite(days) ? `Last ${days} days` : "Last 30 days";
  }

  function formatChartAxisLabel(raw, granularity, idx, totalLen, prevDayKey) {
    const str = String(raw || "").trim();
    if (!str) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const ms = Date.parse(`${str}T00:00:00Z`);
      if (Number.isFinite(ms)) return CHART_MONTH_DAY_FMT.format(new Date(ms));
    }
    if (/^\d{4}-\d{2}$/.test(str)) {
      const ms = Date.parse(`${str}-01T00:00:00Z`);
      if (Number.isFinite(ms)) return CHART_MONTH_YEAR_FMT.format(new Date(ms));
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
      const ms = Date.parse(str);
      if (Number.isFinite(ms)) {
        const d = new Date(ms);
        const hhmm = d.toISOString().slice(11, 16);
        const dayKey = d.toISOString().slice(0, 10);
        if (idx === 0 || totalLen <= 4 || dayKey !== prevDayKey || granularity === "day") {
          return `${CHART_MONTH_DAY_FMT.format(d)} ${hhmm}`;
        }
        return hhmm;
      }
    }
    return str;
  }

  function formatChartTooltipDate(raw, granularity) {
    const str = String(raw || "").trim();
    if (!str) return "—";
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const ms = Date.parse(`${str}T00:00:00Z`);
      if (Number.isFinite(ms)) return CHART_FULL_DATE_FMT.format(new Date(ms));
    }
    if (/^\d{4}-\d{2}$/.test(str)) {
      const ms = Date.parse(`${str}-01T00:00:00Z`);
      if (Number.isFinite(ms)) return CHART_MONTH_YEAR_FMT.format(new Date(ms));
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
      const ms = Date.parse(str);
      if (Number.isFinite(ms)) {
        const d = new Date(ms);
        if (granularity === "day") return CHART_FULL_DATE_FMT.format(d);
        return `${CHART_FULL_DATE_FMT.format(d)} · ${d.toISOString().slice(11, 16)} UTC`;
      }
    }
    return str;
  }

  async function fetchAnalytics({ refresh = false } = {}) {
    if (!state.token || state.loading) return;
    state.loading = true;
    els.refreshBtn.disabled = true;
    els.unlockBtn.disabled = true;
    els.refreshBtn.textContent = "Loading...";
    showDashBanner("");

    const base = resolveAnalyticsEndpoint();
    const qs = new URLSearchParams({ window: state.window });
    if (/^\d+$/.test(state.window)) {
      qs.set("days", String(state.days));
    }
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

      state.actionEventsCache.clear();
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
    renderDailyChart(data.dailySeries || [], data);
    renderReasonDonut(data.breakdowns?.trafficClasses || [], data.kpis?.totalCalls || 0);
    renderIntentBars(data.breakdowns?.intents || []);
    renderAgents();
    populateCallPurposeSelect(data);
    renderHorizontalBars(els.mcpDiscoveryBars, data.breakdowns?.mcpActions || [], 10, (x) => x);
    setCallPurposeFilter(state.callPurpose, { autoSelectTab: false });
    renderAdvancedSection(data);
  }

  function renderHeaderAndKpis(data) {
    const k = data.kpis || {};
    els.datasetBadge.textContent = data.dataset || "BigQuery";
    const ttlSec = Number(data.cacheTtlSec) || 300;
    const ttlLabel = ttlSec < 60 ? `${ttlSec}s` : `${Math.round(ttlSec / 60)}m`;
    els.cacheBadge.textContent = data.cacheStatus === "hit" ? `Edge Cache (${ttlLabel})` : "Fresh BQ Query";
    const windowDisplay = data.windowLabel || formatWindowLabel(state.window);
    els.updatedBadge.textContent = `Updated ${formatTimestampUtc(data.generatedAt)} UTC · Window: ${windowDisplay}`;

    els.kpiAgenticCalls.textContent = formatNumber(k.agenticCalls);
    els.kpiAgenticCallsSub.textContent = `${k.agenticSharePct ?? 0}% of ${formatNumber(k.totalCalls)} total calls (${formatNumber(k.humanChatCalls)} human chat)`;

    els.kpiUniqueAgents.textContent = formatNumber(k.uniqueAgents);
    els.kpiUniqueAgentsSub.textContent = `${formatNumber(k.agentSessions)} agent sessions (${formatNumber(k.uniqueSessions)} total)`;

    els.kpiReasonSplit.textContent = `${k.automatedSharePct ?? 0}% Bots`;
    els.kpiReasonSplitSub.textContent = `${formatNumber(k.automatedCrawlerCalls)} automated vs ${formatNumber(k.userDrivenAgentCalls)} user-driven`;

    els.kpiInteractive.textContent = formatNumber(k.interactiveTotalCount);
    els.kpiInteractiveSub.textContent = `Chat: ${formatNumber(k.chatbotQuestionsCount)} · MCP Q/Tools: ${formatNumber(k.mcpToolCallsCount)} · WebMCP: ${formatNumber(k.webmcpToolCallsCount)}`;
  }

  function showTooltip(event, lines) {
    clearNode(els.chartTooltip);
    for (let i = 0; i < lines.length; i++) {
      const div = el("div", i === 0 ? "cell-main" : "");
      div.style.fontSize = i === 0 ? "0.81rem" : "0.75rem";
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

  function renderDailyChart(series, meta = {}) {
    const granularity = meta.seriesGranularity || (state.window === "1h" ? "5min" : (state.window === "today" || state.window === "yesterday" ? "hour" : "day"));
    const windowLabel = meta.windowLabel || formatWindowLabel(state.window);

    if (els.dailyChartTitle) {
      els.dailyChartTitle.textContent = granularity === "5min"
        ? "Traffic Trend — Last 1 Hour"
        : granularity === "hour"
          ? `Hourly Traffic Trend — ${windowLabel}`
          : "Daily Traffic Trend";
    }
    if (els.dailyChartSub) {
      const unitWord = granularity === "5min" ? "5-minute bucket" : granularity === "hour" ? "hour bar" : "day bar";
      els.dailyChartSub.textContent = `Hover or focus any ${unitWord} to inspect User-Driven AI Agents, Automated Bots, and Human Chatbot visits`;
    }

    clearNode(els.dailyChartStage);
    if (!series.length) {
      els.dailyChartStage.appendChild(el("div", "empty-state", "No events recorded in the selected window yet."));
      return;
    }

    const width = 900;
    const height = 250;
    const margin = { top: 14, right: 24, bottom: 34, left: 46 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    const maxTotal = Math.max(
      1,
      ...series.map((d) => {
        const stacked =
          (Number(d.user_driven_calls) || 0) +
          (Number(d.automated_calls) || 0) +
          (Number(d.human_calls) || 0) +
          (Number(d.other_calls) || 0);
        return Math.max(stacked, Number(d.total_calls) || 0);
      })
    );

    const svg = svgEl("svg", {
      viewBox: `0 0 ${width} ${height}`,
      class: "chart-svg",
      role: "img",
      "aria-label": granularity === "day" ? "Daily traffic trend bar chart" : `${windowLabel} traffic trend bar chart`
    });

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
    const barW = Math.min(54, Math.max(8, step * 0.56));
    const segments = [
      ["user_driven_calls", "User-Driven AI Agents", CLASS_COLORS.USER_DRIVEN_AGENT],
      ["automated_calls", "Automated Bots", CLASS_COLORS.AUTOMATED_AGENT_CRAWLER],
      ["human_calls", "Human Chatbot", CLASS_COLORS.HUMAN_INTERACTIVE],
      ["other_calls", "Other", "#f59e0b"]
    ];

    const labelEvery = Math.max(1, Math.ceil(series.length / 8));
    let lastLabelX = -Infinity;
    let prevDayKey = "";

    series.forEach((day, idx) => {
      const x = margin.left + idx * step + (step - barW) / 2;
      let cursorY = margin.top + plotH;
      let drawnHeight = 0;

      for (const [field, , color] of segments) {
        const count = Number(day[field]) || 0;
        if (count <= 0) continue;
        const segH = Math.max(3, (count / maxTotal) * plotH);
        cursorY -= segH;
        drawnHeight += segH;
        svg.appendChild(svgEl("rect", {
          x: x.toFixed(2),
          y: cursorY.toFixed(2),
          width: barW.toFixed(2),
          height: segH.toFixed(2),
          rx: "2",
          fill: color
        }));
      }

      if (drawnHeight === 0 && (Number(day.total_calls) || 0) > 0) {
        const fallbackH = Math.max(3, ((Number(day.total_calls) || 0) / maxTotal) * plotH);
        svg.appendChild(svgEl("rect", {
          x: x.toFixed(2),
          y: (margin.top + plotH - fallbackH).toFixed(2),
          width: barW.toFixed(2),
          height: fallbackH.toFixed(2),
          rx: "2",
          fill: CLASS_COLORS.AUTOMATED_AGENT_CRAWLER
        }));
      }

      const hit = svgEl("rect", {
        x: (margin.left + idx * step).toFixed(2),
        y: margin.top,
        width: step.toFixed(2),
        height: plotH,
        fill: "transparent",
        tabindex: "0"
      });

      const formattedDate = formatChartTooltipDate(day.event_date, granularity);
      const lines = [
        `${formattedDate} · ${formatNumber(day.total_calls)} calls (${formatNumber(day.unique_sessions)} sessions)`,
        `Automated Bots: ${formatNumber(day.automated_calls)} · User-Driven AI: ${formatNumber(day.user_driven_calls)}`,
        `Human Chatbot: ${formatNumber(day.human_calls)} · Tokens: ${formatCompact(day.tokens_delivered)}`
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

      const centerX = x + barW / 2;
      const isCandidate = idx % labelEvery === 0 || idx === series.length - 1;
      const dayKey = String(day.event_date || "").slice(0, 10);
      if (isCandidate && centerX - lastLabelX >= 68) {
        const dateLabel = svgEl("text", {
          x: centerX.toFixed(2),
          y: height - 10,
          "text-anchor": "middle",
          fill: "#9494ad",
          "font-size": "11",
          "font-family": "ui-monospace, monospace"
        });
        dateLabel.textContent = formatChartAxisLabel(day.event_date, granularity, idx, series.length, prevDayKey);
        svg.appendChild(dateLabel);
        lastLabelX = centerX;
        prevDayKey = dayKey;
      }
    });

    els.dailyChartStage.appendChild(svg);
  }

  function renderReasonDonut(trafficClasses, fallbackTotal) {
    clearNode(els.reasonDonutContainer);
    if (!trafficClasses.length) {
      els.reasonDonutContainer.appendChild(el("div", "empty-state", "No caller classification data in window."));
      return;
    }

    const total = trafficClasses.reduce((acc, row) => acc + (Number(row.calls) || 0), 0) || fallbackTotal;
    const wrap = el("div", "donut-layout");
    const svgBox = el("div", "donut-wrap");
    const size = 164;
    const cx = 82;
    const cy = 82;
    const r = 60;
    const circumference = 2 * Math.PI * r;

    const svg = svgEl("svg", {
      viewBox: `0 0 ${size} ${size}`,
      class: "chart-svg",
      role: "img",
      "aria-label": "Caller reason donut chart"
    });

    let offset = 0;
    trafficClasses.forEach((item, idx) => {
      const value = Number(item.calls) || 0;
      const frac = total > 0 ? value / total : 0;
      const dashLen = frac * circumference;
      const color = CLASS_COLORS[item.label] || INTENT_PALETTE[idx % INTENT_PALETTE.length];
      svg.appendChild(svgEl("circle", {
        cx,
        cy,
        r,
        fill: "none",
        stroke: color,
        "stroke-width": "22",
        "stroke-dasharray": `${dashLen.toFixed(2)} ${circumference.toFixed(2)}`,
        "stroke-dashoffset": (-offset).toFixed(2),
        transform: `rotate(-90 ${cx} ${cy})`
      }));
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
    trafficClasses.forEach((item, idx) => {
      const row = el("div", "donut-row");
      const left = el("span", "legend-item");
      const swatch = el("span", "swatch");
      swatch.style.background = CLASS_COLORS[item.label] || INTENT_PALETTE[idx % INTENT_PALETTE.length];
      left.appendChild(swatch);
      left.appendChild(document.createTextNode(trafficClassLabel(item.label)));

      const pct = total > 0 ? Math.round(((Number(item.calls) || 0) / total) * 1000) / 10 : 0;
      const right = el("span", "hbar-nums", `${formatNumber(item.calls)} (${pct}%) · ${formatNumber(item.sessions)} sess`);
      row.appendChild(left);
      row.appendChild(right);
      legend.appendChild(row);
    });

    wrap.appendChild(legend);
    els.reasonDonutContainer.appendChild(wrap);
  }

  function renderHorizontalBars(container, rows, limit = 10, labelFormatter = (x) => x) {
    clearNode(container);
    const items = rows.slice(0, limit);
    if (!items.length) {
      container.appendChild(el("div", "empty-state", "No breakdown records for this dimension."));
      return;
    }

    const maxCalls = Math.max(1, ...items.map((r) => Number(r.calls) || 0));
    for (const item of items) {
      const displayLabel = labelFormatter(item.label || "Unknown");
      const row = el("div", "hbar-row");
      const meta = el("div", "hbar-meta");
      const lbl = el("span", "hbar-label", displayLabel);
      lbl.title = displayLabel;

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

  function renderIntentBars(intents) {
    renderHorizontalBars(els.intentBars, intents, 10, intentLabel);
  }

  function renderAgents() {
    clearNode(els.agentsList);
    const allAgents = state.data?.agents || [];
    const totalCallsAll = Number(state.data?.kpis?.totalCalls) || 0;
    const term = els.agentSearch.value.trim().toLowerCase();
    const filter = state.agentFilter;

    const filtered = allAgents.filter((a) => {
      if (filter === "agents" && a.isHuman) return false;
      if (filter === "user_driven" && a.primaryClass !== "USER_DRIVEN_AGENT") return false;
      if (filter === "automated" && a.primaryClass !== "AUTOMATED_AGENT_CRAWLER") return false;
      if (!term) return true;
      const hay = [a.name, trafficClassLabel(a.primaryClass), intentLabel(a.primaryIntent), ...a.actions.map((x) => x.label)]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });

    els.agentsCountBadge.textContent = `${filtered.length} shown`;

    if (!filtered.length) {
      const empty = el("div", "glass empty-state", "No agents match this filter.");
      els.agentsList.appendChild(empty);
      return;
    }

    for (const agent of filtered) {
      const details = el("details", "agent-card");
      const summary = el("summary", "agent-summary");

      // Col 1: Identity & Reason
      const identity = el("div", "agent-identity");
      const nameRow = el("div", "agent-name-row");
      nameRow.appendChild(el("span", "agent-name", agent.name));
      nameRow.appendChild(el("span", trafficClassPillClass(agent.primaryClass), trafficClassLabel(agent.primaryClass)));
      identity.appendChild(nameRow);

      const metaParts = [
        intentLabel(agent.primaryIntent),
        `${formatNumber(agent.sessions)} sessions`
      ];
      if (agent.avgLatencyMs !== null && agent.avgLatencyMs !== undefined) {
        metaParts.push(`${agent.avgLatencyMs}ms avg`);
      }
      identity.appendChild(el("div", "agent-meta", metaParts.join(" · ")));
      summary.appendChild(identity);

      // Col 2: Top Call Types & Action Chips
      const chipsWrap = el("div", "agent-chips");
      for (const action of (agent.actions || []).slice(0, 3)) {
        chipsWrap.appendChild(el("span", "chip", `${action.label} (${formatNumber(action.calls)})`));
      }
      if ((agent.actions || []).length > 3) {
        chipsWrap.appendChild(el("span", "chip", `+${agent.actions.length - 3} more`));
      }
      summary.appendChild(chipsWrap);

      // Col 3: Total calls & Chevron
      const stats = el("div", "agent-stats");
      const pct = totalCallsAll > 0 ? Math.round((agent.totalCalls / totalCallsAll) * 1000) / 10 : 0;
      stats.appendChild(el("span", "agent-calls-big", formatNumber(agent.totalCalls)));
      stats.appendChild(el("span", "agent-pct", `${pct}%`));
      stats.appendChild(el("span", "chev", "▶"));
      summary.appendChild(stats);

      details.appendChild(summary);

      // Expanded body: Exact Call Types & Actions breakdown for this agent
      const body = el("div", "agent-body");

      const ctCol = el("div");
      ctCol.appendChild(el("h4", "mini-title", "Call Types Used"));
      const ctList = el("div", "mini-list");
      for (const ct of agent.callTypes || []) {
        const row = el("div", "mini-row");
        row.appendChild(el("span", "", ct.label));
        const ctPct = agent.totalCalls > 0 ? Math.round((ct.calls / agent.totalCalls) * 100) : 0;
        row.appendChild(el("span", "hbar-nums", `${formatNumber(ct.calls)} (${ctPct}%)`));
        ctList.appendChild(row);
      }
      ctCol.appendChild(ctList);
      body.appendChild(ctCol);

      const actCol = el("div");
      actCol.appendChild(el("h4", "mini-title", "Specific Actions / Endpoints Called (click to inspect)"));
      const actList = el("div", "mini-list");
      for (const act of (agent.actions || []).slice(0, 12)) {
        const actDetails = el("details", "action-card");
        const actSummary = el("summary", "action-summary");

        const left = el("div");
        left.appendChild(el("div", "cell-main", act.label));
        left.appendChild(el("div", "cell-sub", `${act.callType} · ${intentLabel(act.intentCategory)}`));
        actSummary.appendChild(left);

        const right = el("span", "hbar-nums");
        const lat = act.avgLatencyMs !== null && act.avgLatencyMs !== undefined ? ` · ${act.avgLatencyMs}ms` : "";
        right.appendChild(document.createTextNode(`${formatNumber(act.calls)} calls${lat}`));
        right.appendChild(el("span", "action-chev", "▶"));
        actSummary.appendChild(right);

        const eventsBody = el("div", "action-events-body");
        actDetails.appendChild(actSummary);
        actDetails.appendChild(eventsBody);

        actDetails.addEventListener("toggle", () => {
          if (actDetails.open) {
            loadAndRenderActionEvents(agent, act, eventsBody);
          }
        });

        actList.appendChild(actDetails);
      }
      actCol.appendChild(actList);
      body.appendChild(actCol);

      details.appendChild(body);
      els.agentsList.appendChild(details);
    }
  }

  function formatActionEventRequest(ev) {
    if (ev.raw_query) return ev.raw_query;
    if (ev.resource_uri) return `${ev.rpc_method || ev.http_method || "READ"} ${ev.resource_uri}`;
    const base = `${ev.http_method || "POST"} ${ev.http_path || "/"}`;
    const extras = [ev.rpc_method, ev.tool_name].filter(Boolean);
    return extras.length ? `${base} (${extras.join(" · ")})` : base;
  }

  function renderActionEventsList(container, events) {
    clearNode(container);
    if (!events || !events.length) {
      container.appendChild(el("div", "cell-sub", "No recorded calls found for this action in the selected window."));
      return;
    }

    for (const ev of events) {
      const card = el("div", "event-item");

      const head = el("div", "event-item-head");
      const metaLeft = el("div", "cell-sub");
      metaLeft.style.marginTop = "0";
      const bits = [
        `${formatTimestampUtc(ev.event_timestamp)} UTC`,
        ev.request_duration_ms !== null && ev.request_duration_ms !== undefined ? `${ev.request_duration_ms} ms` : null,
        ev.country && ev.country !== "unknown" ? ev.country : null
      ].filter(Boolean);
      metaLeft.appendChild(document.createTextNode(bits.join(" · ")));

      const metaRight = el("div");
      metaRight.style.display = "inline-flex";
      metaRight.style.alignItems = "center";
      metaRight.style.gap = "8px";
      if (ev.guardrail_blocked) {
        metaRight.appendChild(el("span", "pill pill-rose", "Blocked"));
      } else if (ev.is_error) {
        metaRight.appendChild(el("span", "pill pill-rose", `Error ${ev.error_code || ev.http_status || ""}`.trim()));
      } else if (ev.matched_kb) {
        metaRight.appendChild(el("span", "pill pill-green", "KB Hit"));
      } else {
        metaRight.appendChild(el("span", "pill pill-sky", `HTTP ${ev.http_status ?? 200}`));
      }

      const fullBtn = el("button", "btn btn-sm btn-ghost", "Full Detail");
      fullBtn.type = "button";
      fullBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetailDialog(ev);
      });
      metaRight.appendChild(fullBtn);

      head.appendChild(metaLeft);
      head.appendChild(metaRight);
      card.appendChild(head);

      const reqRow = el("div", "event-kv");
      reqRow.appendChild(el("span", "event-label", "Request"));
      reqRow.appendChild(el("div", "event-val", formatActionEventRequest(ev)));
      card.appendChild(reqRow);

      const answerText = ev.is_error && ev.error_message
        ? ev.error_message
        : truncate(ev.response_preview, 240);
      if (answerText && answerText !== "—") {
        const ansRow = el("div", "event-kv");
        ansRow.appendChild(el("span", "event-label", "Answer"));
        ansRow.appendChild(el("div", "event-val", answerText));
        card.appendChild(ansRow);
      }

      container.appendChild(card);
    }
  }

  async function loadAndRenderActionEvents(agent, act, container) {
    const cacheKey = `${state.window}::${agent.name}::${act.label}::${act.callType}::${act.intentCategory}`;
    if (state.actionEventsCache.has(cacheKey)) {
      renderActionEventsList(container, state.actionEventsCache.get(cacheKey));
      return;
    }

    clearNode(container);
    container.appendChild(el("div", "cell-sub", "Loading recent requests & answers..."));

    const qs = new URLSearchParams({
      window: state.window,
      agent: agent.name,
      action: act.label,
      callType: act.callType || "",
      intent: act.intentCategory || "",
      limit: "25"
    });
    if (/^\d+$/.test(state.window)) {
      qs.set("days", String(state.days));
    }

    try {
      const resp = await fetch(`${resolveAnalyticsEndpoint()}/events?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Authorization": `Bearer ${state.token}`
        }
      });

      const payload = await resp.json().catch(() => null);
      if (resp.status === 401) {
        lockDashboard(payload?.message || "Session expired or invalid token.");
        return;
      }
      if (!resp.ok || !payload) {
        if (!container.isConnected) return;
        clearNode(container);
        container.appendChild(el("div", "alert", payload?.message || `Failed to load calls (HTTP ${resp.status}).`));
        return;
      }

      const events = payload.events || [];
      state.actionEventsCache.set(cacheKey, events);
      if (!container.isConnected) return;
      renderActionEventsList(container, events);
    } catch (err) {
      if (!container.isConnected) return;
      clearNode(container);
      container.appendChild(el("div", "alert", `Network error loading calls: ${err?.message || err}`));
    }
  }

  function findChannelEntry(channels, prefix) {
    return (channels || []).find((c) => String(c.label || "").toLowerCase().includes(prefix.toLowerCase()));
  }

  function matchesCallPurpose(row) {
    if (state.callPurpose === "all") return true;
    return (row?.intent_category || "capability_discovery") === state.callPurpose;
  }

  function populateCallPurposeSelect(data) {
    const prev = state.callPurpose || "all";
    const purposes = new Set(["prompt_grounded_qa"]);
    for (const item of data.breakdowns?.intents || []) {
      if (item.label) purposes.add(item.label);
    }
    for (const item of data.breakdowns?.channelIntents || []) {
      if (item.intent) purposes.add(item.intent);
    }
    for (const bucket of Object.values(data.callTypeDetails || {})) {
      for (const r of bucket || []) {
        if (r.intent_category) purposes.add(r.intent_category);
      }
    }

    clearNode(els.ctPurposeSelect);
    const allOpt = el("option", "", "All Purposes");
    allOpt.value = "all";
    els.ctPurposeSelect.appendChild(allOpt);

    const ordered = [
      "prompt_grounded_qa",
      ...[...purposes].filter((p) => p !== "prompt_grounded_qa").sort((a, b) => collator.compare(intentLabel(a), intentLabel(b)))
    ];
    for (const p of ordered) {
      const opt = el("option", "", intentLabel(p));
      opt.value = p;
      els.ctPurposeSelect.appendChild(opt);
    }

    state.callPurpose = prev === "all" || purposes.has(prev) ? prev : "all";
    els.ctPurposeSelect.value = state.callPurpose;
  }

  function setCallPurposeFilter(purpose, { autoSelectTab = true } = {}) {
    state.callPurpose = purpose || "all";
    els.ctPurposeSelect.value = state.callPurpose;

    for (const btn of els.ctPurposeBar.querySelectorAll("button.seg-btn")) {
      const active = btn.dataset.purpose === state.callPurpose;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }

    const data = state.data;
    if (!data) return;

    const counts = renderCallTypeCards(data);
    applyMcpFilter();
    applyChatFilter();
    applyWebmcpFilter();
    renderNlwebTable((data.callTypeDetails?.nlweb || []).filter(matchesCallPurpose));
    renderRestTable((data.callTypeDetails?.rest || []).filter(matchesCallPurpose));
    renderMarkdownTable((data.callTypeDetails?.markdown || []).filter(matchesCallPurpose));

    if (els.mcpDiscoverySection) {
      els.mcpDiscoverySection.hidden = state.callPurpose === "prompt_grounded_qa";
    }

    if (autoSelectTab && state.callPurpose !== "all" && counts) {
      const tabOrder = [
        ["tab-ct-mcp", counts.mcp],
        ["tab-ct-chatbot", counts.chatbot],
        ["tab-ct-webmcp", counts.webmcp],
        ["tab-ct-nlweb", counts.nlweb],
        ["tab-ct-rest", counts.rest],
        ["tab-ct-markdown", counts.markdown]
      ];
      const activeBtn = document.querySelector('.ct-tabs-grid [role="tab"][aria-selected="true"]');
      const activeEntry = tabOrder.find(([id]) => activeBtn && activeBtn.id === id);
      if (!activeEntry || activeEntry[1] === 0) {
        const firstNonEmpty = tabOrder.find(([, cnt]) => cnt > 0);
        if (firstNonEmpty) {
          activateCallTypeTab(document.getElementById(firstNonEmpty[0]));
        }
      }
    }
  }

  function setCardEmptyState(tabId, count) {
    const btn = document.getElementById(tabId);
    if (btn) btn.classList.toggle("ct-tab-empty", count === 0);
  }

  function renderCallTypeCards(data) {
    const purpose = state.callPurpose || "all";
    const details = data.callTypeDetails || {};
    const k = data.kpis || {};

    let sourceChannels = data.breakdowns?.channels || [];
    if (purpose !== "all") {
      const ci = (data.breakdowns?.channelIntents || []).filter((x) => x.intent === purpose);
      if (ci.length > 0 || (data.breakdowns?.channelIntents || []).length > 0) {
        sourceChannels = ci.map((x) => ({
          label: x.channel,
          calls: x.calls,
          sessions: x.sessions
        }));
      } else {
        sourceChannels = [
          { label: "Remote MCP (/mcp)", calls: (details.mcp || []).filter(matchesCallPurpose).length, sessions: 0 },
          { label: "On-Site Chatbot (/ask)", calls: (details.chatbot || []).filter(matchesCallPurpose).length, sessions: 0 },
          { label: "In-Browser WebMCP", calls: (details.webmcp || []).filter(matchesCallPurpose).length, sessions: 0 },
          { label: "External NLWeb (/ask, /who)", calls: (details.nlweb || []).filter(matchesCallPurpose).length, sessions: 0 },
          { label: "Public REST API (/api/v1)", calls: (details.rest || []).filter(matchesCallPurpose).length, sessions: 0 },
          { label: "Markdown Content Negotiation", calls: (details.markdown || []).filter(matchesCallPurpose).length, sessions: 0 }
        ];
      }
    }

    const mcp = findChannelEntry(sourceChannels, "Remote MCP");
    const mcpCalls = mcp?.calls || 0;
    const mcpFilteredRows = (details.mcp || []).filter(matchesCallPurpose).length;
    els.cntCtMcp.textContent = formatNumber(mcpCalls);
    els.subCtMcp.textContent = purpose === "all"
      ? `${formatNumber(k.mcpToolCallsCount || mcpFilteredRows)} Q&A / tool calls`
      : `${formatNumber(mcp?.sessions || 0)} sessions`;
    setCardEmptyState("tab-ct-mcp", mcpCalls);

    const chat = findChannelEntry(sourceChannels, "On-Site Chatbot");
    const chatFilteredRows = (details.chatbot || []).filter(matchesCallPurpose).length;
    const chatCalls = chat?.calls || (purpose === "all" ? chatFilteredRows : 0);
    els.cntCtChatbot.textContent = formatNumber(chatCalls);
    els.subCtChatbot.textContent = `${formatNumber(chatFilteredRows)} visitor prompts`;
    setCardEmptyState("tab-ct-chatbot", chatCalls);

    const webmcp = findChannelEntry(sourceChannels, "WebMCP");
    const webmcpFilteredRows = (details.webmcp || []).filter(matchesCallPurpose).length;
    const webmcpCalls = webmcp?.calls || (purpose === "all" ? webmcpFilteredRows : 0);
    els.cntCtWebmcp.textContent = formatNumber(webmcpCalls);
    els.subCtWebmcp.textContent = `${formatNumber(webmcpFilteredRows)} tool invocations`;
    setCardEmptyState("tab-ct-webmcp", webmcpCalls);

    const nlweb = findChannelEntry(sourceChannels, "External NLWeb");
    const nlwebCalls = nlweb?.calls || 0;
    els.cntCtNlweb.textContent = formatNumber(nlwebCalls);
    els.subCtNlweb.textContent = `${formatNumber(nlweb?.sessions || 0)} sessions`;
    setCardEmptyState("tab-ct-nlweb", nlwebCalls);

    const rest = findChannelEntry(sourceChannels, "Public REST API");
    const restCalls = rest?.calls || 0;
    els.cntCtRest.textContent = formatNumber(restCalls);
    els.subCtRest.textContent = `${formatNumber(rest?.sessions || 0)} sessions`;
    setCardEmptyState("tab-ct-rest", restCalls);

    const md = findChannelEntry(sourceChannels, "Markdown");
    const mdCalls = md?.calls || 0;
    els.cntCtMarkdown.textContent = formatNumber(mdCalls);
    els.subCtMarkdown.textContent = `${formatNumber(md?.sessions || 0)} sessions`;
    setCardEmptyState("tab-ct-markdown", mdCalls);

    return { mcp: mcpCalls, chatbot: chatCalls, webmcp: webmcpCalls, nlweb: nlwebCalls, rest: restCalls, markdown: mdCalls };
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

  function appendStatusPill(td, row) {
    if (row.guardrail_blocked) {
      td.appendChild(el("span", "pill pill-rose", "Blocked"));
    } else if (row.matched_kb) {
      td.appendChild(el("span", "pill pill-green", "KB Hit"));
    } else {
      td.appendChild(el("span", "pill pill-amber", "No Match"));
    }
  }

  function applyMcpFilter() {
    const all = (state.data?.callTypeDetails?.mcp || []).filter(matchesCallPurpose);
    const term = els.mcpSearch.value.trim().toLowerCase();
    const filtered = !term ? all : all.filter((r) => [
      r.agent_name,
      r.tool_name,
      r.resource_uri,
      r.call_action_label,
      r.raw_query,
      r.response_preview,
      r.canonical_topic
    ].filter(Boolean).join(" ").toLowerCase().includes(term));

    state.filteredMcp = filtered;
    renderMcpTable(filtered);
  }

  function renderMcpTable(rows) {
    clearNode(els.tbodyMcpCalls);
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", "No MCP questions or tool/resource calls logged in this window.");
      td.colSpan = 7;
      tr.appendChild(td);
      els.tbodyMcpCalls.appendChild(tr);
      return;
    }

    for (const row of rows) {
      const tr = el("tr");
      tr.dataset.clickable = "true";

      const tsMs = Date.parse(row.event_timestamp || "") || 0;
      tr.appendChild(makeCell("Time (UTC)", formatTimestampUtc(row.event_timestamp), { numeric: true, sortValue: tsMs }));

      const tdAgent = makeCell("Agent", null, { sortValue: row.agent_name || "" });
      tdAgent.appendChild(el("div", "cell-main", row.agent_name || "Unknown Agent"));
      tdAgent.appendChild(el("div", "cell-sub", [row.country !== "unknown" ? row.country : null, trafficClassLabel(row.traffic_class)].filter(Boolean).join(" · ")));
      tr.appendChild(tdAgent);

      const toolLabel = row.tool_name || (row.rpc_method === "resources/read" ? "resources/read" : row.call_action_label) || "MCP";
      tr.appendChild(makeCell("Tool / Resource", toolLabel));

      const targetText = row.raw_query || row.resource_uri || row.primary_section || "—";
      const tdTarget = makeCell("Question or Target", null, { sortValue: targetText });
      tdTarget.appendChild(el("div", "cell-main", targetText));
      if (row.canonical_topic) {
        tdTarget.appendChild(el("div", "cell-sub", row.canonical_topic));
      }
      tr.appendChild(tdTarget);

      tr.appendChild(makeCell("Answer Preview", truncate(row.response_preview, 100)));

      const lat = row.request_duration_ms;
      tr.appendChild(makeCell("Latency", lat !== null && lat !== undefined ? `${lat} ms` : "—", { numeric: true, sortValue: lat ?? -1 }));

      const tdInspect = makeCell("Inspect", null);
      const btn = el("button", "btn btn-sm btn-ghost", "View");
      btn.type = "button";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetailDialog(row);
      });
      tdInspect.appendChild(btn);
      tr.appendChild(tdInspect);

      tr.addEventListener("click", () => openDetailDialog(row));
      els.tbodyMcpCalls.appendChild(tr);
    }
  }

  function applyChatFilter() {
    const all = (state.data?.callTypeDetails?.chatbot || []).filter(matchesCallPurpose);
    const term = els.chatSearch.value.trim().toLowerCase();
    const filtered = !term ? all : all.filter((r) => [
      r.raw_query,
      r.prev_query,
      r.canonical_topic,
      r.response_preview,
      r.country
    ].filter(Boolean).join(" ").toLowerCase().includes(term));

    state.filteredChat = filtered;
    renderChatTable(filtered);
  }

  function renderChatTable(rows) {
    clearNode(els.tbodyChatQuestions);
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", "No on-site chatbot questions recorded in this window.");
      td.colSpan = 7;
      tr.appendChild(td);
      els.tbodyChatQuestions.appendChild(tr);
      return;
    }

    for (const row of rows) {
      const tr = el("tr");
      tr.dataset.clickable = "true";

      const tsMs = Date.parse(row.event_timestamp || "") || 0;
      tr.appendChild(makeCell("Time (UTC)", formatTimestampUtc(row.event_timestamp), { numeric: true, sortValue: tsMs }));

      const qText = row.raw_query || row.http_path || "—";
      const tdQ = makeCell("Question Asked", null, { sortValue: qText });
      tdQ.appendChild(el("div", "cell-main", qText));
      const subParts = [
        row.session_turn_index ? `Turn ${row.session_turn_index}` : null,
        row.query_language ? String(row.query_language).toUpperCase() : null,
        row.country && row.country !== "unknown" ? row.country : null
      ].filter(Boolean);
      tdQ.appendChild(el("div", "cell-sub", subParts.join(" · ") || "—"));
      tr.appendChild(tdQ);

      const tdTopic = makeCell("Topic", null, { sortValue: row.canonical_topic || "" });
      tdTopic.appendChild(el("div", "cell-main", row.canonical_topic || "—"));
      if (row.primary_section) tdTopic.appendChild(el("div", "cell-sub", row.primary_section));
      tr.appendChild(tdTopic);

      tr.appendChild(makeCell("Answer Preview", truncate(row.response_preview, 100)));

      const tdStatus = makeCell("Status", null, { sortValue: row.matched_kb ? "KB Hit" : "No Match" });
      appendStatusPill(tdStatus, row);
      tr.appendChild(tdStatus);

      const lat = row.request_duration_ms;
      tr.appendChild(makeCell("Latency", lat !== null && lat !== undefined ? `${lat} ms` : "—", { numeric: true, sortValue: lat ?? -1 }));

      const tdInspect = makeCell("Inspect", null);
      const btn = el("button", "btn btn-sm btn-ghost", "View");
      btn.type = "button";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetailDialog(row);
      });
      tdInspect.appendChild(btn);
      tr.appendChild(tdInspect);

      tr.addEventListener("click", () => openDetailDialog(row));
      els.tbodyChatQuestions.appendChild(tr);
    }
  }

  function applyWebmcpFilter() {
    const all = (state.data?.callTypeDetails?.webmcp || []).filter(matchesCallPurpose);
    const term = els.webmcpSearch.value.trim().toLowerCase();
    const filtered = !term ? all : all.filter((r) => [
      r.agent_name,
      r.tool_name,
      r.raw_query,
      r.canonical_topic,
      r.primary_section,
      r.response_preview
    ].filter(Boolean).join(" ").toLowerCase().includes(term));

    state.filteredWebmcp = filtered;
    renderWebmcpTable(filtered);
  }

  function renderWebmcpTable(rows) {
    clearNode(els.tbodyWebmcpTools);
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", "No in-browser WebMCP tool invocations recorded in this window.");
      td.colSpan = 6;
      tr.appendChild(td);
      els.tbodyWebmcpTools.appendChild(tr);
      return;
    }

    for (const row of rows) {
      const tr = el("tr");
      tr.dataset.clickable = "true";

      const tsMs = Date.parse(row.event_timestamp || "") || 0;
      tr.appendChild(makeCell("Time (UTC)", formatTimestampUtc(row.event_timestamp), { numeric: true, sortValue: tsMs }));

      const toolName = row.tool_name || row.call_action_label || "WebMCP Tool";
      const tdTool = makeCell("WebMCP Tool", null, { sortValue: toolName });
      tdTool.appendChild(el("span", "pill pill-violet", toolName));
      tdTool.appendChild(el("div", "cell-sub", row.agent_name || "WebMCP Browser Agent"));
      tr.appendChild(tdTool);

      tr.appendChild(makeCell("Arguments / Target", row.raw_query || row.primary_section || "—"));

      const tdTopic = makeCell("Topic / Section", null, { sortValue: row.canonical_topic || "" });
      tdTopic.appendChild(el("div", "cell-main", row.canonical_topic || "—"));
      if (row.country && row.country !== "unknown") {
        tdTopic.appendChild(el("div", "cell-sub", row.country));
      }
      tr.appendChild(tdTopic);

      const lat = row.request_duration_ms;
      tr.appendChild(makeCell("Latency", lat !== null && lat !== undefined ? `${lat} ms` : "—", { numeric: true, sortValue: lat ?? -1 }));

      const tdInspect = makeCell("Inspect", null);
      const btn = el("button", "btn btn-sm btn-ghost", "View");
      btn.type = "button";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetailDialog(row);
      });
      tdInspect.appendChild(btn);
      tr.appendChild(tdInspect);

      tr.addEventListener("click", () => openDetailDialog(row));
      els.tbodyWebmcpTools.appendChild(tr);
    }
  }

  function renderNlwebTable(rows) {
    clearNode(els.tbodyNlwebCalls);
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", "No external NLWeb calls recorded in this window.");
      td.colSpan = 7;
      tr.appendChild(td);
      els.tbodyNlwebCalls.appendChild(tr);
      return;
    }

    for (const row of rows) {
      const tr = el("tr");
      tr.dataset.clickable = "true";
      const tsMs = Date.parse(row.event_timestamp || "") || 0;
      tr.appendChild(makeCell("Time (UTC)", formatTimestampUtc(row.event_timestamp), { numeric: true, sortValue: tsMs }));
      tr.appendChild(makeCell("Caller", row.agent_name || "Unknown"));
      tr.appendChild(makeCell("Endpoint", row.http_path || "/ask"));
      tr.appendChild(makeCell("Query", row.raw_query || row.canonical_topic || "—"));
      const tdStatus = makeCell("Status", null);
      appendStatusPill(tdStatus, row);
      tr.appendChild(tdStatus);
      const lat = row.request_duration_ms;
      tr.appendChild(makeCell("Latency", lat !== null && lat !== undefined ? `${lat} ms` : "—", { numeric: true, sortValue: lat ?? -1 }));

      const tdInspect = makeCell("Inspect", null);
      const btn = el("button", "btn btn-sm btn-ghost", "View");
      btn.type = "button";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetailDialog(row);
      });
      tdInspect.appendChild(btn);
      tr.appendChild(tdInspect);

      tr.addEventListener("click", () => openDetailDialog(row));
      els.tbodyNlwebCalls.appendChild(tr);
    }
  }

  function renderRestTable(rows) {
    clearNode(els.tbodyRestCalls);
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", "No Public REST API calls recorded in this window.");
      td.colSpan = 7;
      tr.appendChild(td);
      els.tbodyRestCalls.appendChild(tr);
      return;
    }

    for (const row of rows) {
      const tr = el("tr");
      tr.dataset.clickable = "true";
      const tsMs = Date.parse(row.event_timestamp || "") || 0;
      tr.appendChild(makeCell("Time (UTC)", formatTimestampUtc(row.event_timestamp), { numeric: true, sortValue: tsMs }));
      tr.appendChild(makeCell("Caller", row.agent_name || "Unknown"));
      tr.appendChild(makeCell("Path", `${row.http_method || "GET"} ${row.http_path || "/api"}`));
      tr.appendChild(makeCell("Query / Topic", row.raw_query || row.canonical_topic || "—"));
      tr.appendChild(makeCell("HTTP Status", row.http_status ?? "—", { numeric: true, sortValue: row.http_status ?? 0 }));
      const lat = row.request_duration_ms;
      tr.appendChild(makeCell("Latency", lat !== null && lat !== undefined ? `${lat} ms` : "—", { numeric: true, sortValue: lat ?? -1 }));

      const tdInspect = makeCell("Inspect", null);
      const btn = el("button", "btn btn-sm btn-ghost", "View");
      btn.type = "button";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetailDialog(row);
      });
      tdInspect.appendChild(btn);
      tr.appendChild(tdInspect);

      tr.addEventListener("click", () => openDetailDialog(row));
      els.tbodyRestCalls.appendChild(tr);
    }
  }

  function renderMarkdownTable(rows) {
    clearNode(els.tbodyMarkdownCalls);
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", "No Markdown content negotiation fetches recorded in this window.");
      td.colSpan = 6;
      tr.appendChild(td);
      els.tbodyMarkdownCalls.appendChild(tr);
      return;
    }

    for (const row of rows) {
      const tr = el("tr");
      const tsMs = Date.parse(row.event_timestamp || "") || 0;
      tr.appendChild(makeCell("Time (UTC)", formatTimestampUtc(row.event_timestamp), { numeric: true, sortValue: tsMs }));
      tr.appendChild(makeCell("Agent", row.agent_name || "Unknown"));
      tr.appendChild(makeCell("Resource / Path", row.resource_uri || row.http_path || "—"));
      tr.appendChild(makeCell("Topic", row.canonical_topic || "—"));
      tr.appendChild(makeCell("Tokens", formatCompact(row.estimated_tokens || 0), { numeric: true, sortValue: row.estimated_tokens || 0 }));
      const lat = row.request_duration_ms;
      tr.appendChild(makeCell("Latency", lat !== null && lat !== undefined ? `${lat} ms` : "—", { numeric: true, sortValue: lat ?? -1 }));
      els.tbodyMarkdownCalls.appendChild(tr);
    }
  }

  function renderAdvancedSection(data) {
    const countries = data.breakdowns?.countries || [];
    const sessions = data.sessions?.recent || [];
    els.advancedMetaBadge.textContent = `${formatNumber(sessions.length)} sessions · ${formatNumber(countries.length)} countries`;

    renderHorizontalBars(els.countriesBars, countries, 12, (x) => x);
    populateSessionSegmentFilter(sessions);
    applySessionFilters();
  }

  function populateSessionSegmentFilter(rows) {
    const prev = els.sSegmentFilter.value || "all";
    const classes = new Set();
    for (const r of rows) {
      if (r.session_traffic_class) classes.add(r.session_traffic_class);
    }
    clearNode(els.sSegmentFilter);
    els.sSegmentFilter.appendChild(el("option", "", "All Caller Types")).value = "all";
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
      return [
        r.session_id,
        r.agent_platform,
        r.primary_protocol,
        r.session_traffic_class,
        r.actions_summary,
        r.topics_summary,
        r.questions_summary,
        r.country
      ].filter(Boolean).join(" ").toLowerCase().includes(term);
    });

    state.filteredSessions = filtered;
    renderSessionsTable(filtered);
  }

  function renderSessionsTable(rows) {
    clearNode(els.tbodySessions);
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", "No sessions match the current filters.");
      td.colSpan = 6;
      tr.appendChild(td);
      els.tbodySessions.appendChild(tr);
      return;
    }

    for (const row of rows) {
      const tr = el("tr");
      const endMs = Date.parse(row.session_end || row.session_start || "") || 0;
      tr.appendChild(makeCell("Last Activity (UTC)", formatTimestampUtc(row.session_end || row.session_start), { numeric: true, sortValue: endMs }));

      const tdPlat = makeCell("Agent / Platform", null, { sortValue: row.agent_platform || "" });
      const geoBits = [row.primary_protocol, row.country && row.country !== "unknown" ? row.country : null, row.is_oauth_authenticated ? "OAuth" : null].filter(Boolean);
      tdPlat.appendChild(el("div", "cell-main", row.agent_platform || "Unknown"));
      tdPlat.appendChild(el("div", "cell-sub", geoBits.join(" · ") || "—"));
      tr.appendChild(tdPlat);

      const tdClass = makeCell("Reason Class", null, { sortValue: row.session_traffic_class || "" });
      tdClass.appendChild(el("span", trafficClassPillClass(row.session_traffic_class), trafficClassLabel(row.session_traffic_class)));
      tr.appendChild(tdClass);

      tr.appendChild(makeCell("Calls", `${row.total_calls ?? 0}`, { numeric: true, sortValue: row.total_calls || 0 }));
      tr.appendChild(makeCell("Tokens", formatCompact(row.total_tokens_delivered || 0), { numeric: true, sortValue: row.total_tokens_delivered || 0 }));

      const tdTrail = makeCell("Actions & Questions Trail", null, { sortValue: row.actions_summary || "" });
      tdTrail.appendChild(el("div", "cell-main", truncate(row.questions_summary || row.actions_summary || "—", 120)));
      if (row.topics_summary) {
        tdTrail.appendChild(el("div", "cell-sub", truncate(row.topics_summary, 100)));
      }
      tr.appendChild(tdTrail);

      els.tbodySessions.appendChild(tr);
    }
  }

  function addDetailBlock(container, label, value) {
    if (value === null || value === undefined || value === "") return;
    const block = el("div", "detail-block");
    block.appendChild(el("div", "detail-label", label));
    block.appendChild(el("div", "detail-value", String(value)));
    container.appendChild(block);
  }

  function openDetailDialog(row) {
    clearNode(els.dlgBody);
    els.dlgMetaPill.textContent = `${row.channel_surface || row.protocol || "Call"} · ${formatTimestampUtc(row.event_timestamp)} UTC`;
    els.dlgMetaPill.className = row.guardrail_blocked
      ? "pill pill-rose"
      : row.matched_kb
        ? "pill pill-green"
        : "pill pill-violet";

    els.dlgTitle.textContent = row.raw_query || row.call_action_label || row.tool_name || row.http_path || "Call Detail";

    addDetailBlock(els.dlgBody, "Question / Arguments / Target", row.raw_query || row.resource_uri);
    addDetailBlock(els.dlgBody, "Previous Turn Question", row.prev_query);
    addDetailBlock(els.dlgBody, "Gemini Fanout Search Queries", row.fanout_queries_text);
    addDetailBlock(els.dlgBody, "Matched KB Sections", row.matched_sections_text);
    if (row.guardrail_blocked) {
      addDetailBlock(els.dlgBody, "Guardrail Reason", row.guardrail_reason || "Blocked");
    }
    addDetailBlock(els.dlgBody, "Response Preview", row.response_preview);

    const grid = el("div", "detail-grid");
    addDetailBlock(grid, "Agent / Client", row.agent_name || "Unknown");
    addDetailBlock(grid, "Reason Class", trafficClassLabel(row.traffic_class));
    addDetailBlock(grid, "Call Purpose", intentLabel(row.intent_category));
    addDetailBlock(grid, "Topic / Section", `${row.canonical_topic || "—"} / ${row.primary_section || "—"}`);
    addDetailBlock(grid, "Latency / Tokens", `${row.request_duration_ms ?? "—"} ms · ${row.estimated_tokens ?? 0} tok`);
    addDetailBlock(grid, "BM25 / HTTP Status", `${row.top_bm25_score ?? "—"} · HTTP ${row.http_status ?? 200}`);
    const isBrowserTraffic = row.protocol === "webmcp" || row.traffic_class === "HUMAN_INTERACTIVE";
    const locBits = [
      row.country && row.country !== "unknown" ? row.country : null,
      !isBrowserTraffic && row.as_organization && row.as_organization !== "unknown" ? row.as_organization : null
    ].filter(Boolean);
    addDetailBlock(grid, isBrowserTraffic ? "Country" : "Country / AI Network", locBits.join(" · ") || "—");
    addDetailBlock(grid, "Session ID", row.session_id || "—");
    els.dlgBody.appendChild(grid);

    if (typeof els.detailDialog.showModal === "function") {
      els.detailDialog.showModal();
    }
  }

  function escapeCsvCell(val) {
    const str = String(val === null || val === undefined ? "" : val);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function exportCsv(rows, filenamePrefix) {
    if (!rows || !rows.length) {
      showDashBanner("No rows available in this table to export.", true);
      return;
    }

    const headers = [
      "event_timestamp",
      "agent_name",
      "traffic_class",
      "intent_category",
      "channel_surface",
      "call_action_label",
      "tool_name",
      "raw_query",
      "canonical_topic",
      "primary_section",
      "matched_kb",
      "request_duration_ms",
      "estimated_tokens",
      "country",
      "response_preview"
    ];

    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(headers.map((h) => escapeCsvCell(r[h])).join(","));
    }

    downloadCsvBlob(lines, filenamePrefix);
  }

  function downloadCsvBlob(lines, filenamePrefix) {
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportGenericCsv(columns, rows, filenamePrefix = "analytics-ask-results") {
    if (!rows || !rows.length || !columns || !columns.length) {
      showDashBanner("No rows available in this table to export.", true);
      return;
    }
    const lines = [columns.map((c) => escapeCsvCell(c.label || c.key)).join(",")];
    for (const r of rows) {
      lines.push(columns.map((c) => escapeCsvCell(r?.[c.key])).join(","));
    }
    downloadCsvBlob(lines, filenamePrefix);
  }

  // Accessible Call-Type Tabs (modern-web-guidance tabs pattern)
  function initTabs() {
    const tabBtns = Array.from(document.querySelectorAll('.ct-tabs-grid [role="tab"]'));
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

    activateCallTypeTab = activateTab;

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

  function setAskStatus(visible, message = "") {
    if (!els.askDataStatus) return;
    if (!visible) {
      els.askDataStatus.hidden = true;
      if (els.askDataStatusText) els.askDataStatusText.textContent = "";
      return;
    }
    if (els.askDataStatusText) {
      els.askDataStatusText.textContent = message || "Analyzing question...";
    }
    els.askDataStatus.hidden = false;
  }

  function resetAskThread() {
    state.askHistory = [];
    if (els.askDataThread) clearNode(els.askDataThread);
    if (els.askDataInput) els.askDataInput.value = "";
    setAskStatus(false);
  }

  function parseSseFrames(buffer, onFrame) {
    let rest = buffer.replace(/\r\n/g, "\n");
    let idx;
    while ((idx = rest.indexOf("\n\n")) !== -1) {
      const block = rest.slice(0, idx);
      rest = rest.slice(idx + 2);
      let eventName = "message";
      const dataLines = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (dataLines.length) {
        onFrame(eventName, dataLines.join("\n"));
      }
    }
    return rest;
  }

  async function submitAnalyticsQuestion(rawQuestion) {
    const question = String(rawQuestion || "").trim();
    if (!question || !state.token || state.askLoading) return;

    state.askLoading = true;
    if (els.askDataSubmit) {
      els.askDataSubmit.disabled = true;
      els.askDataSubmit.textContent = "Analyzing...";
    }
    if (els.askDataInput) {
      els.askDataInput.value = "";
      els.askDataInput.disabled = true;
    }
    setAskStatus(true, "Analyzing question and drafting BigQuery SQL...");

    const turnEl = el("div", "ask-turn");
    const promptBar = el("div", "ask-turn-prompt");
    promptBar.appendChild(el("div", "ask-turn-question", question));
    const statusPill = el("span", "pill pill-violet", "Running…");
    promptBar.appendChild(statusPill);
    turnEl.appendChild(promptBar);

    const bodyEl = el("div", "ask-turn-body");
    turnEl.appendChild(bodyEl);
    if (els.askDataThread) {
      els.askDataThread.appendChild(turnEl);
      const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      turnEl.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
    }

    try {
      const resp = await fetch(`${resolveAnalyticsAskEndpoint()}?stream=1`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream, application/json",
          "Authorization": `Bearer ${state.token}`
        },
        body: JSON.stringify({
          question,
          window: state.window,
          days: state.days,
          history: state.askHistory.slice(-6)
        })
      });

      if (resp.status === 401) {
        const errData = await resp.json().catch(() => null);
        lockDashboard(errData?.message || "Invalid dashboard token. Please enter your DASHBOARD_API_KEY.");
        return;
      }

      const contentType = (resp.headers.get("content-type") || "").toLowerCase();
      let surfacePayload = null;

      if (contentType.includes("text/event-stream") && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamErr = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = parseSseFrames(buffer, (evt, dataStr) => {
            let parsed = null;
            try {
              parsed = JSON.parse(dataStr);
            } catch {
              return;
            }
            if (evt === "status" && parsed) {
              setAskStatus(true, parsed.message || "Working...");
              statusPill.textContent = parsed.stage === "querying_bigquery"
                ? "Querying BigQuery…"
                : parsed.stage === "widening_window"
                  ? "Checking broader window…"
                  : parsed.stage === "composing_ui"
                    ? "Analyzing questions & UI…"
                    : parsed.stage === "repairing_sql"
                      ? "Refining SQL…"
                      : parsed.stage === "retrying_analysis"
                        ? "Retrying…"
                        : "Planning query…";
            } else if (evt === "surface" && parsed) {
              surfacePayload = parsed;
            } else if (evt === "error" && parsed) {
              streamErr = new Error(parsed.message || "Analytics query failed.");
            }
          });
        }
        if (streamErr) throw streamErr;
      } else {
        const payload = await resp.json().catch(() => null);
        if (!resp.ok || !payload) {
          throw new Error(payload?.message || `Analytics AI request failed (HTTP ${resp.status}).`);
        }
        surfacePayload = payload;
      }

      if (!surfacePayload) {
        throw new Error("No Generative UI response returned from analytics endpoint.");
      }

      statusPill.className = "pill pill-green";
      statusPill.textContent = `${surfacePayload.queryMeta?.rowCount ?? 0} rows`;

      if (window.AnalyticsA2UIRenderer && typeof window.AnalyticsA2UIRenderer.renderSurface === "function") {
        const rendered = window.AnalyticsA2UIRenderer.renderSurface(surfacePayload, {
          onFollowUp: (q) => submitAnalyticsQuestion(q),
          onRowDetail: (row) => openDetailDialog(row),
          onExportCsv: exportGenericCsv,
          onTooltipShow: showTooltip,
          onTooltipHide: hideTooltip
        });
        bodyEl.appendChild(rendered);
      } else {
        bodyEl.appendChild(el("div", "a2ui-summary", surfacePayload.title || "Answer ready."));
      }

      state.askHistory = [
        ...state.askHistory,
        {
          question,
          sql: surfacePayload.queryMeta?.sql || "",
          summary: surfacePayload.title || ""
        }
      ].slice(-6);
    } catch (err) {
      statusPill.className = "pill pill-rose";
      statusPill.textContent = "Error";
      const errBanner = el("div", "alert ask-error-row");
      errBanner.setAttribute("role", "alert");
      errBanner.appendChild(el("span", "ask-error-msg", err?.message || "Failed to analyze question."));
      const retryBtn = el("button", "btn btn-sm btn-ghost ask-retry-btn", "Retry");
      retryBtn.type = "button";
      retryBtn.setAttribute("aria-label", `Retry question: ${question.slice(0, 80)}`);
      retryBtn.addEventListener("click", () => {
        if (state.askLoading) return;
        turnEl.remove();
        submitAnalyticsQuestion(question);
      });
      errBanner.appendChild(retryBtn);
      bodyEl.appendChild(errBanner);
    } finally {
      state.askLoading = false;
      setAskStatus(false);
      if (els.askDataSubmit) {
        els.askDataSubmit.disabled = false;
        els.askDataSubmit.textContent = "Ask AI Analyst";
      }
      if (els.askDataInput) {
        els.askDataInput.disabled = false;
        els.askDataInput.focus();
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
      const val = String(els.windowSelect.value || "30").trim();
      const parsed = Number.parseInt(val, 10);
      state.window = val;
      state.days = /^\d+$/.test(val) && Number.isFinite(parsed) ? parsed : 1;
      fetchAnalytics({ refresh: false });
    });

    els.refreshBtn.addEventListener("click", () => {
      fetchAnalytics({ refresh: true });
    });

    els.lockBtn.addEventListener("click", () => {
      lockDashboard("");
    });

    for (const btn of els.agentFilterBar.querySelectorAll("button.seg-btn")) {
      btn.addEventListener("click", () => {
        state.agentFilter = btn.dataset.filter || "all";
        for (const b of els.agentFilterBar.querySelectorAll("button.seg-btn")) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        }
        renderAgents();
      });
    }
    els.agentSearch.addEventListener("input", renderAgents);

    for (const btn of els.ctPurposeBar.querySelectorAll("button.seg-btn")) {
      btn.addEventListener("click", () => {
        setCallPurposeFilter(btn.dataset.purpose || "all", { autoSelectTab: true });
      });
    }
    els.ctPurposeSelect.addEventListener("change", () => {
      setCallPurposeFilter(els.ctPurposeSelect.value || "all", { autoSelectTab: true });
    });

    els.mcpSearch.addEventListener("input", applyMcpFilter);
    els.exportMcpBtn.addEventListener("click", () => exportCsv(state.filteredMcp, "mcp-calls"));

    els.chatSearch.addEventListener("input", applyChatFilter);
    els.exportChatBtn.addEventListener("click", () => exportCsv(state.filteredChat, "chatbot-questions"));

    els.webmcpSearch.addEventListener("input", applyWebmcpFilter);
    els.exportWebmcpBtn.addEventListener("click", () => exportCsv(state.filteredWebmcp, "webmcp-tools"));

    els.sSearch.addEventListener("input", applySessionFilters);
    els.sSegmentFilter.addEventListener("change", applySessionFilters);

    els.dlgCloseBtn.addEventListener("click", () => els.detailDialog.close());
    els.detailDialog.addEventListener("click", (e) => {
      if (e.target === els.detailDialog) {
        els.detailDialog.close();
      }
    });

    if (els.askDataForm) {
      els.askDataForm.addEventListener("submit", (e) => {
        e.preventDefault();
        submitAnalyticsQuestion(els.askDataInput?.value || "");
      });
    }
    if (els.askDataInput) {
      els.askDataInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          submitAnalyticsQuestion(els.askDataInput.value);
        }
      });
    }
    if (els.askDataStarters) {
      els.askDataStarters.addEventListener("click", (e) => {
        const chip = e.target.closest("button[data-question]");
        if (chip) {
          submitAnalyticsQuestion(chip.dataset.question || chip.textContent || "");
        }
      });
    }
    if (els.askDataClearBtn) {
      els.askDataClearBtn.addEventListener("click", resetAskThread);
    }
  }

  function cacheElements() {
    const ids = [
      "authGate", "authForm", "tokenInput", "toggleTokenBtn", "rememberTokenChk", "unlockBtn", "authError",
      "dashboardView", "datasetBadge", "cacheBadge", "updatedBadge", "windowSelect", "refreshBtn", "lockBtn", "dashBanner",
      "kpiAgenticCalls", "kpiAgenticCallsSub", "kpiUniqueAgents", "kpiUniqueAgentsSub", "kpiReasonSplit", "kpiReasonSplitSub", "kpiInteractive", "kpiInteractiveSub",
      "dailyChartTitle", "dailyChartSub", "dailyChartStage", "reasonDonutContainer", "intentBars",
      "agentFilterBar", "agentSearch", "agentsCountBadge", "agentsList",
      "ctPurposeBar", "ctPurposeSelect",
      "cntCtMcp", "subCtMcp", "cntCtChatbot", "subCtChatbot", "cntCtWebmcp", "subCtWebmcp",
      "cntCtNlweb", "subCtNlweb", "cntCtRest", "subCtRest", "cntCtMarkdown", "subCtMarkdown",
      "mcpSearch", "exportMcpBtn", "tblMcpCalls", "tbodyMcpCalls", "mcpDiscoverySection", "mcpDiscoveryBars",
      "chatSearch", "exportChatBtn", "tblChatQuestions", "tbodyChatQuestions",
      "webmcpSearch", "exportWebmcpBtn", "tblWebmcpTools", "tbodyWebmcpTools",
      "tblNlwebCalls", "tbodyNlwebCalls", "tblRestCalls", "tbodyRestCalls", "tblMarkdownCalls", "tbodyMarkdownCalls",
      "advancedSection", "advancedMetaBadge", "countriesBars", "sSearch", "sSegmentFilter", "tblSessions", "tbodySessions",
      "askDataSection", "askDataForm", "askDataInput", "askDataSubmit", "askDataClearBtn", "askDataStarters", "askDataStatus", "askDataStatusText", "askDataThread",
      "sortStatus", "chartTooltip", "detailDialog", "dlgMetaPill", "dlgTitle", "dlgCloseBtn", "dlgBody"
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

    if (els.windowSelect) {
      const initialWin = String(els.windowSelect.value || "30").trim();
      const parsedDays = Number.parseInt(initialWin, 10);
      state.window = initialWin;
      state.days = /^\d+$/.test(initialWin) && Number.isFinite(parsedDays) ? parsedDays : 1;
    }

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
