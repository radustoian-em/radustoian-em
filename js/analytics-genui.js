(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      node.setAttribute(k, String(v));
    }
    return node;
  }

  function resolveDataPath(dataModel, pathStr) {
    if (!dataModel || typeof dataModel !== "object") return [];
    const clean = String(pathStr || "/rows").replace(/^\/+/, "");
    if (!clean) return dataModel;
    const parts = clean.split("/");
    let cur = dataModel;
    for (const part of parts) {
      if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
      cur = cur[part];
    }
    return cur;
  }

  const ENUM_DISPLAY_LABELS = {
    USER_DRIVEN_AGENT: "User-Driven AI Agent",
    AUTOMATED_AGENT_CRAWLER: "Automated Bot / Crawler",
    HUMAN_INTERACTIVE: "Human Visitor (Chatbot)",
    prompt_grounded_qa: "Question Answering (Q&A)",
    targeted_section_lookup: "Targeted Section Lookup",
    capability_discovery: "Capability Discovery",
    directory_scan: "MCP Directory / Registry Scan",
    research_bot: "Research Bot / Crawler",
    bulk_crawl: "Bulk Crawl / Automated Sweep",
    ui_navigation: "In-Browser UI Action (WebMCP)",
    citation_verification: "Citation / Link Check",
    oauth_handshake: "OAuth Handshake",
    session_termination: "Session Termination",
    markdown_negotiation: "Markdown Negotiation",
    rest_api: "Public REST API",
    webmcp: "In-Browser WebMCP",
    nlweb: "NLWeb (/ask)",
    mcp: "Remote MCP"
  };

  function humanizeEnumValue(val) {
    if (val === null || val === undefined) return "";
    const str = String(val).trim();
    if (!str) return "";
    return Object.prototype.hasOwnProperty.call(ENUM_DISPLAY_LABELS, str) ? ENUM_DISPLAY_LABELS[str] : str;
  }

  function formatMetricValue(val, fmt = "number") {
    if (val === null || val === undefined || val === "") return "—";
    const num = Number(val);
    if (!Number.isFinite(num)) return String(val);
    if (fmt === "ms") return `${new Intl.NumberFormat().format(Math.round(num * 10) / 10)} ms`;
    if (fmt === "pct") return `${Math.round(num * 10) / 10}%`;
    if (fmt === "tokens") {
      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M tok`;
      if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K tok`;
      return `${new Intl.NumberFormat().format(num)} tok`;
    }
    if (fmt === "compact") {
      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
      if (num >= 10_000) return `${(num / 1_000).toFixed(1)}K`;
    }
    return new Intl.NumberFormat().format(num);
  }

  const CHART_MONTH_DAY_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const CHART_FULL_DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const CHART_MONTH_YEAR_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

  function formatChartDate(raw, { includeYear = false } = {}) {
    const str = String(raw || "").trim();
    if (!str) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const ms = Date.parse(`${str}T00:00:00Z`);
      if (Number.isFinite(ms)) {
        return (includeYear ? CHART_FULL_DATE_FMT : CHART_MONTH_DAY_FMT).format(new Date(ms));
      }
    }
    if (/^\d{4}-\d{2}$/.test(str)) {
      const ms = Date.parse(`${str}-01T00:00:00Z`);
      if (Number.isFinite(ms)) {
        return CHART_MONTH_YEAR_FMT.format(new Date(ms));
      }
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
      const ms = Date.parse(str);
      if (Number.isFinite(ms)) {
        const d = new Date(ms);
        const hhmm = d.toISOString().slice(11, 16);
        return includeYear
          ? `${CHART_FULL_DATE_FMT.format(d)} · ${hhmm} UTC`
          : `${CHART_MONTH_DAY_FMT.format(d)} ${hhmm}`;
      }
    }
    return includeYear ? str : str.slice(0, 12);
  }

  function formatCellValue(val, type) {
    if (val === null || val === undefined || val === "") return "—";
    if (type === "number") {
      const n = Number(val);
      return Number.isFinite(n) ? new Intl.NumberFormat().format(n) : String(val);
    }
    if (type === "date") {
      const str = String(val);
      if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
        const ms = Date.parse(str);
        if (Number.isFinite(ms)) return new Date(ms).toISOString().replace("T", " ").slice(0, 16);
      }
      return str;
    }
    if (typeof val === "boolean") return val ? "Yes" : "No";
    return String(val);
  }

  function renderProvenanceBar(comp) {
    const details = el("details", "a2ui-provenance");
    const summary = el("summary", "a2ui-provenance-summary");

    const left = el("div", "a2ui-provenance-left");
    if (comp.archetypeLabel) {
      left.appendChild(el("span", "pill pill-violet", comp.archetypeLabel));
    }
    if (comp.scopeSummary) {
      left.appendChild(el("span", "a2ui-provenance-scope", comp.scopeSummary));
    }
    if (comp.rowCapReached) {
      left.appendChild(el("span", "pill pill-amber", "Row cap (200) reached on detail step"));
    }
    summary.appendChild(left);

    const right = el("span", "a2ui-provenance-toggle");
    right.appendChild(el("span", "chev", "▸"));
    right.appendChild(document.createTextNode("Definitions & Provenance"));
    summary.appendChild(right);
    details.appendChild(summary);

    const body = el("div", "a2ui-provenance-body");
    if (Array.isArray(comp.viewsUsed) && comp.viewsUsed.length) {
      const viewsRow = el("div", "a2ui-provenance-row");
      viewsRow.appendChild(el("span", "a2ui-provenance-key", "BigQuery Views"));
      viewsRow.appendChild(el("span", "a2ui-provenance-val", comp.viewsUsed.join(", ")));
      body.appendChild(viewsRow);
    }
    if (comp.exclusions) {
      const excRow = el("div", "a2ui-provenance-row");
      excRow.appendChild(el("span", "a2ui-provenance-key", "Default Scope"));
      excRow.appendChild(el("span", "a2ui-provenance-val", comp.exclusions));
      body.appendChild(excRow);
    }
    if (Array.isArray(comp.certifiedMetrics) && comp.certifiedMetrics.length) {
      const metricsWrap = el("div", "a2ui-provenance-metrics");
      metricsWrap.appendChild(el("div", "a2ui-provenance-key", "Certified Metrics Applied"));
      for (const m of comp.certifiedMetrics) {
        const mRow = el("div", "a2ui-provenance-metric");
        mRow.appendChild(el("strong", "", m.label || m.id));
        if (m.formula) {
          mRow.appendChild(el("code", "a2ui-provenance-code", m.formula));
        }
        metricsWrap.appendChild(mRow);
      }
      body.appendChild(metricsWrap);
    }
    details.appendChild(body);
    return details;
  }

  function renderDonutShareChart(comp, dataModel) {
    const rawRows = resolveDataPath(dataModel, comp.dataPath || "/rows");
    const items = Array.isArray(rawRows) ? rawRows.slice(0, 8) : [];
    const card = el("article", "glass panel-card a2ui-card");
    const head = el("div", "panel-head");
    head.appendChild(el("h4", "panel-title", comp.title || "Share Breakdown"));
    card.appendChild(head);

    if (!items.length) {
      card.appendChild(el("div", "empty-state", "No matching rows returned for this breakdown."));
      return card;
    }

    const palette = ["#a855f7", "#38bdf8", "#34d399", "#f59e0b", "#f472b6", "#818cf8", "#2dd4bf", "#fb7185"];
    const total = items.reduce((acc, r) => acc + Math.max(0, Number(r?.[comp.valueField]) || 0), 0);

    const layout = el("div", "donut-layout");
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
      "aria-label": comp.title || "Proportional share donut chart"
    });

    let offset = 0;
    items.forEach((row, idx) => {
      const val = Math.max(0, Number(row?.[comp.valueField]) || 0);
      const frac = total > 0 ? val / total : 0;
      const dashLen = frac * circumference;
      const color = palette[idx % palette.length];
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
      "font-size": "20",
      "font-weight": "700",
      "font-family": "Fraunces, Georgia, serif"
    });
    centerVal.textContent = formatMetricValue(total, "compact");
    svg.appendChild(centerVal);

    const centerSub = svgEl("text", {
      x: cx,
      y: cy + 20,
      "text-anchor": "middle",
      fill: "#9494ad",
      "font-size": "10",
      "letter-spacing": "0.08em"
    });
    centerSub.textContent = String(comp.centerLabel || "TOTAL").slice(0, 14).toUpperCase();
    svg.appendChild(centerSub);

    svgBox.appendChild(svg);
    layout.appendChild(svgBox);

    const legend = el("div", "donut-legend");
    items.forEach((row, idx) => {
      const label = humanizeEnumValue(row?.[comp.labelField] ?? "Unknown");
      const val = Math.max(0, Number(row?.[comp.valueField]) || 0);
      const pct = total > 0 ? Math.round((val / total) * 1000) / 10 : 0;

      const legRow = el("div", "donut-row");
      const left = el("span", "legend-item");
      const swatch = el("span", "swatch");
      swatch.style.background = palette[idx % palette.length];
      left.appendChild(swatch);
      left.appendChild(document.createTextNode(label));

      const right = el("span", "hbar-nums", `${formatMetricValue(val, "number")} (${pct}%)`);
      legRow.appendChild(left);
      legRow.appendChild(right);
      legend.appendChild(legRow);
    });

    layout.appendChild(legend);
    card.appendChild(layout);
    return card;
  }

  function renderStackedBarChart(comp, dataModel, handlers) {
    const rawRows = resolveDataPath(dataModel, comp.dataPath || "/rows");
    const rows = Array.isArray(rawRows) ? rawRows.slice(0, 45) : [];
    const series = Array.isArray(comp.series) ? comp.series : [];

    const card = el("article", "glass panel-card a2ui-card");
    const head = el("div", "panel-head");
    head.appendChild(el("h4", "panel-title", comp.title || "Stacked Breakdown"));

    const legend = el("div", "legend");
    const palette = ["#a855f7", "#38bdf8", "#34d399", "#f59e0b", "#f472b6"];
    series.forEach((s, idx) => {
      const item = el("span", "legend-item");
      const swatch = el("span", "swatch");
      swatch.style.background = s.color || palette[idx % palette.length];
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(humanizeEnumValue(s.label || s.field)));
      legend.appendChild(item);
    });
    head.appendChild(legend);
    card.appendChild(head);

    if (!rows.length || !series.length) {
      card.appendChild(el("div", "empty-state", "Insufficient data points to plot a stacked bar chart."));
      return card;
    }

    const stage = el("div", "chart-stage");
    stage.style.minHeight = "220px";
    const width = 860;
    const height = 228;
    const margin = { top: 14, right: 20, bottom: 34, left: 48 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    const maxY = Math.max(
      1,
      ...rows.map((r) => series.reduce((acc, s) => acc + Math.max(0, Number(r?.[s.field]) || 0), 0))
    );

    const svg = svgEl("svg", {
      viewBox: `0 0 ${width} ${height}`,
      class: "chart-svg",
      role: "img",
      "aria-label": comp.title || "Stacked bar chart"
    });

    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const val = Math.round((maxY / ticks) * i);
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
      lbl.textContent = formatMetricValue(val, "compact");
      svg.appendChild(lbl);
    }

    const step = plotW / rows.length;
    const barW = Math.min(54, Math.max(10, step * 0.56));
    const labelEvery = Math.max(1, Math.ceil(rows.length / 8));
    let lastLabelX = -Infinity;

    rows.forEach((r, idx) => {
      const x = margin.left + idx * step + (step - barW) / 2;
      let cursorY = margin.top + plotH;
      let totalBar = 0;

      series.forEach((s, sIdx) => {
        const count = Math.max(0, Number(r?.[s.field]) || 0);
        if (count <= 0) return;
        totalBar += count;
        const segH = Math.max(2, (count / maxY) * plotH);
        cursorY -= segH;
        svg.appendChild(svgEl("rect", {
          x: x.toFixed(2),
          y: cursorY.toFixed(2),
          width: barW.toFixed(2),
          height: segH.toFixed(2),
          rx: "2",
          fill: s.color || palette[sIdx % palette.length]
        }));
      });

      const hit = svgEl("rect", {
        x: (margin.left + idx * step).toFixed(2),
        y: margin.top,
        width: step.toFixed(2),
        height: plotH,
        fill: "transparent",
        tabindex: "0"
      });

      const rawX = r?.[comp.xField];
      const formattedX = rawX !== undefined && rawX !== null && /^\d{4}-\d{2}/.test(String(rawX))
        ? formatChartDate(rawX, { includeYear: true })
        : humanizeEnumValue(rawX ?? `Item ${idx + 1}`);

      const lines = [
        `${formattedX} · Total: ${formatMetricValue(totalBar, "number")}`,
        ...series.map((s) => `${humanizeEnumValue(s.label || s.field)}: ${formatMetricValue(r?.[s.field] ?? 0, "number")}`)
      ];

      if (typeof handlers.onTooltipShow === "function") {
        hit.addEventListener("mousemove", (e) => handlers.onTooltipShow(e, lines));
        hit.addEventListener("mouseenter", (e) => handlers.onTooltipShow(e, lines));
        hit.addEventListener("focus", () => {
          const rect = hit.getBoundingClientRect();
          handlers.onTooltipShow({ clientX: rect.left + rect.width / 2, clientY: rect.top + 16 }, lines);
        });
      }
      if (typeof handlers.onTooltipHide === "function") {
        hit.addEventListener("mouseleave", handlers.onTooltipHide);
        hit.addEventListener("blur", handlers.onTooltipHide);
      }
      svg.appendChild(hit);

      const centerX = x + barW / 2;
      if ((idx % labelEvery === 0 || idx === rows.length - 1) && centerX - lastLabelX >= 64) {
        const lbl = svgEl("text", {
          x: centerX.toFixed(2),
          y: height - 9,
          "text-anchor": "middle",
          fill: "#9494ad",
          "font-size": "11",
          "font-family": "ui-monospace, monospace"
        });
        const strX = String(rawX ?? "");
        lbl.textContent = /^\d{4}-\d{2}/.test(strX)
          ? formatChartDate(strX, { includeYear: false })
          : humanizeEnumValue(strX).slice(0, 14);
        svg.appendChild(lbl);
        lastLabelX = centerX;
      }
    });

    stage.appendChild(svg);
    card.appendChild(stage);
    return card;
  }

  function renderSessionTimeline(comp, dataModel, handlers) {
    const sessions = Array.isArray(comp.sessions) ? comp.sessions : [];
    const dataRows = resolveDataPath(dataModel, "/rows");
    const rowByEventId = new Map();
    if (Array.isArray(dataRows)) {
      for (const r of dataRows) {
        if (r && r.event_id !== undefined && r.event_id !== null) {
          rowByEventId.set(String(r.event_id), r);
        }
      }
    }

    const card = el("article", "glass panel-card a2ui-card");
    const head = el("div", "panel-head");
    head.appendChild(el("h4", "panel-title", comp.title || "Multi-Turn Session Trails"));
    head.appendChild(el("span", "meta-chip", `${sessions.length} sessions`));
    card.appendChild(head);

    if (!sessions.length) {
      card.appendChild(el("div", "empty-state", "No multi-turn session trails available in this result set."));
      return card;
    }

    const list = el("div", "a2ui-timeline-list");
    for (const s of sessions) {
      const sCard = el("div", "a2ui-timeline-card");
      const sHead = el("div", "a2ui-timeline-head");
      const left = el("div", "a2ui-qmeta");
      const isChatbot = s.actorType === "chatbot";
      left.appendChild(el("span", isChatbot ? "pill pill-green" : "pill pill-violet", isChatbot ? "Website Chatbot" : "AI Agent"));
      left.appendChild(el("strong", "", s.agentLabel || "Unknown Agent"));
      if (s.turnCount) {
        left.appendChild(el("span", "meta-chip", `${s.turnCount} turns`));
      }
      if (s.durationLabel) {
        left.appendChild(el("span", "meta-chip", s.durationLabel));
      }
      sHead.appendChild(left);
      if (s.startedAt) {
        sHead.appendChild(el("span", "cell-sub", `${formatCellValue(s.startedAt, "date")} UTC`));
      }
      sCard.appendChild(sHead);

      const turnsList = el("ol", "a2ui-timeline-turns");
      for (const t of s.turns || []) {
        const li = el("li", "a2ui-timeline-turn");
        const metaRow = el("div", "a2ui-timeline-turn-meta");
        metaRow.appendChild(el("span", "pill pill-sky", `Turn ${t.turnIndex ?? "?"}`));
        if (t.actionLabel) metaRow.appendChild(el("span", "meta-chip", t.actionLabel));
        if (t.topic) metaRow.appendChild(el("span", "meta-chip", t.topic));
        if (t.matchedKb === false) metaRow.appendChild(el("span", "pill pill-amber", "KB Miss"));
        if (t.latencyMs !== null && t.latencyMs !== undefined) {
          metaRow.appendChild(el("span", "cell-sub", `${t.latencyMs} ms`));
        }
        const matchedRow = t.eventId ? rowByEventId.get(String(t.eventId)) : null;
        if (matchedRow && typeof handlers.onRowDetail === "function") {
          const btn = el("button", "btn btn-sm btn-ghost", "Detail");
          btn.type = "button";
          btn.addEventListener("click", () => handlers.onRowDetail(matchedRow));
          metaRow.appendChild(btn);
        }
        li.appendChild(metaRow);
        li.appendChild(el("div", "a2ui-timeline-turn-text", t.queryText || "—"));
        turnsList.appendChild(li);
      }
      sCard.appendChild(turnsList);
      list.appendChild(sCard);
    }

    card.appendChild(list);
    return card;
  }

  function renderGapAuditCard(comp, dataModel, handlers) {
    const items = Array.isArray(comp.gapItems) ? comp.gapItems : [];
    const dataRows = resolveDataPath(dataModel, "/rows");
    const rowByEventId = new Map();
    if (Array.isArray(dataRows)) {
      for (const r of dataRows) {
        if (r && r.event_id !== undefined && r.event_id !== null) {
          rowByEventId.set(String(r.event_id), r);
        }
      }
    }

    const card = el("article", "glass panel-card a2ui-card");
    const head = el("div", "panel-head");
    head.appendChild(el("h4", "panel-title", comp.title || "Knowledge Base & Reliability Gaps"));
    head.appendChild(el("span", "meta-chip", `${items.length} flagged`));
    card.appendChild(head);

    if (!items.length) {
      card.appendChild(el("div", "empty-state", "No KB misses, guardrail blocks, or execution errors found in this set."));
      return card;
    }

    const list = el("div", "a2ui-gap-list");
    for (const item of items) {
      const gCard = el("div", "a2ui-gap-item");
      const gHead = el("div", "a2ui-qhead");
      const left = el("div", "a2ui-qmeta");
      const pillCls = item.reasonType === "kb_miss" || item.reasonType === "slow" ? "pill-amber" : "pill-rose";
      left.appendChild(el("span", `pill ${pillCls}`, item.reasonBadge || "Gap"));
      if (item.agentLabel) left.appendChild(el("span", "meta-chip", item.agentLabel));
      if (item.topic) left.appendChild(el("span", "meta-chip", item.topic));
      gHead.appendChild(left);

      const right = el("div", "a2ui-qactions");
      if (item.timestampUtc) {
        right.appendChild(el("span", "cell-sub", `${formatCellValue(item.timestampUtc, "date")} UTC`));
      }
      const matchedRow = item.eventId ? rowByEventId.get(String(item.eventId)) : null;
      if (matchedRow && typeof handlers.onRowDetail === "function") {
        const btn = el("button", "btn btn-sm btn-ghost", "Full Detail");
        btn.type = "button";
        btn.addEventListener("click", () => handlers.onRowDetail(matchedRow));
        right.appendChild(btn);
      }
      gHead.appendChild(right);
      gCard.appendChild(gHead);
      gCard.appendChild(el("div", "a2ui-qtext", item.questionText || "—"));
      if (item.detail) {
        gCard.appendChild(el("div", "a2ui-qrationale", item.detail));
      }
      list.appendChild(gCard);
    }

    card.appendChild(list);
    return card;
  }

  function renderSummaryCard(comp) {
    const tone = ["info", "positive", "warning", "neutral"].includes(comp.tone) ? comp.tone : "info";
    const card = el("div", `a2ui-summary a2ui-tone-${tone}`);
    if (comp.title) {
      card.appendChild(el("div", "a2ui-summary-title", comp.title));
    }
    card.appendChild(el("p", "a2ui-summary-body", comp.body || ""));
    return card;
  }

  function renderKpiStrip(comp) {
    const grid = el("div", "a2ui-kpi-grid");
    for (const item of comp.items || []) {
      const accent = ["violet", "sky", "emerald", "amber", "rose"].includes(item.accent) ? item.accent : "violet";
      const card = el("article", `kpi-card a2ui-kpi-card a2ui-accent-${accent}`);
      card.appendChild(el("div", "kpi-label", item.label || ""));
      card.appendChild(el("div", "kpi-value", item.value ?? "0"));
      if (item.subtext) {
        card.appendChild(el("div", "kpi-sub", item.subtext));
      }
      grid.appendChild(card);
    }
    return grid;
  }

  function renderBarChart(comp, dataModel) {
    const rows = resolveDataPath(dataModel, comp.dataPath || "/rows");
    const items = Array.isArray(rows) ? rows.slice(0, 20) : [];
    const card = el("article", "glass panel-card a2ui-card");
    const head = el("div", "panel-head");
    const left = el("div");
    left.appendChild(el("h4", "panel-title", comp.title || "Breakdown"));
    head.appendChild(left);
    card.appendChild(head);

    if (!items.length) {
      card.appendChild(el("div", "empty-state", "No matching rows returned for this chart."));
      return card;
    }

    const list = el("div", "hbar-list");
    const maxVal = Math.max(1, ...items.map((r) => Math.max(0, Number(r?.[comp.valueField]) || 0)));

    for (const row of items) {
      const label = humanizeEnumValue(row?.[comp.labelField] ?? "Unknown");
      const val = Number(row?.[comp.valueField]) || 0;
      const barRow = el("div", "hbar-row");
      const meta = el("div", "hbar-meta");
      const lbl = el("span", "hbar-label", label);
      lbl.title = String(label);

      let rightStr = formatMetricValue(val, comp.format || "number");
      if (comp.secondaryField && row?.[comp.secondaryField] !== undefined && row?.[comp.secondaryField] !== null) {
        rightStr += ` · ${row[comp.secondaryField]}`;
      }
      const nums = el("span", "hbar-nums", rightStr);
      meta.appendChild(lbl);
      meta.appendChild(nums);

      const track = el("div", "hbar-track");
      const fill = el("div", "hbar-fill");
      const pct = val <= 0 ? 0 : Math.max(3, Math.round((val / maxVal) * 100));
      fill.style.width = `${pct}%`;
      track.appendChild(fill);

      barRow.appendChild(meta);
      barRow.appendChild(track);
      list.appendChild(barRow);
    }

    card.appendChild(list);
    return card;
  }

  function renderLineChart(comp, dataModel, handlers) {
    const rawRows = resolveDataPath(dataModel, comp.dataPath || "/rows");
    const rows = Array.isArray(rawRows) ? rawRows.slice(0, 120) : [];
    const series = Array.isArray(comp.series) ? comp.series : [];

    const card = el("article", "glass panel-card a2ui-card");
    const head = el("div", "panel-head");
    head.appendChild(el("h4", "panel-title", comp.title || "Trend Over Time"));

    const legend = el("div", "legend");
    for (const s of series) {
      const item = el("span", "legend-item");
      const swatch = el("span", "swatch");
      swatch.style.background = s.color || "#a855f7";
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(s.label || s.field));
      legend.appendChild(item);
    }
    head.appendChild(legend);
    card.appendChild(head);

    if (!rows.length || !series.length) {
      card.appendChild(el("div", "empty-state", "Insufficient data points to plot a trend chart."));
      return card;
    }

    const stage = el("div", "chart-stage");
    stage.style.minHeight = "220px";
    const width = 860;
    const height = 220;
    const margin = { top: 14, right: 18, bottom: 32, left: 48 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    let maxY = 1;
    for (const r of rows) {
      for (const s of series) {
        const v = Number(r?.[s.field]);
        if (Number.isFinite(v) && v > maxY) maxY = v;
      }
    }

    const svg = svgEl("svg", {
      viewBox: `0 0 ${width} ${height}`,
      class: "chart-svg",
      role: "img",
      "aria-label": comp.title || "Time series chart"
    });

    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const val = Math.round((maxY / ticks) * i);
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
      lbl.textContent = formatMetricValue(val, "compact");
      svg.appendChild(lbl);
    }

    const xFor = (idx) => {
      if (rows.length === 1) return margin.left + plotW / 2;
      return margin.left + (plotW * idx) / (rows.length - 1);
    };
    const yFor = (val) => margin.top + plotH - (Math.max(0, Number(val) || 0) / maxY) * plotH;

    series.forEach((s, sIdx) => {
      const color = s.color || "#a855f7";
      const pts = rows.map((r, i) => `${xFor(i).toFixed(2)},${yFor(r?.[s.field]).toFixed(2)}`);

      if (sIdx === 0 && rows.length > 1) {
        const areaPts = [
          `${xFor(0).toFixed(2)},${(margin.top + plotH).toFixed(2)}`,
          ...pts,
          `${xFor(rows.length - 1).toFixed(2)},${(margin.top + plotH).toFixed(2)}`
        ].join(" ");
        svg.appendChild(svgEl("polygon", {
          points: areaPts,
          fill: color,
          "fill-opacity": "0.12"
        }));
      }

      if (rows.length > 1) {
        svg.appendChild(svgEl("polyline", {
          points: pts.join(" "),
          fill: "none",
          stroke: color,
          "stroke-width": "2.4",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }));
      }

      rows.forEach((r, i) => {
        svg.appendChild(svgEl("circle", {
          cx: xFor(i).toFixed(2),
          cy: yFor(r?.[s.field]).toFixed(2),
          r: rows.length > 40 ? "2.5" : "3.8",
          fill: color
        }));
      });
    });

    const stepW = rows.length > 1 ? plotW / (rows.length - 1) : plotW;
    const labelEvery = Math.max(1, Math.ceil(rows.length / 8));
    rows.forEach((r, i) => {
      const hitX = rows.length === 1 ? margin.left : Math.max(margin.left, xFor(i) - stepW / 2);
      const hitW = rows.length === 1 ? plotW : stepW;
      const hit = svgEl("rect", {
        x: hitX.toFixed(2),
        y: margin.top,
        width: hitW.toFixed(2),
        height: plotH,
        fill: "transparent",
        tabindex: "0"
      });
      const rawTooltipX = r?.[comp.xField];
      const formattedTooltipX = rawTooltipX !== undefined && rawTooltipX !== null && /^\d{4}-\d{2}/.test(String(rawTooltipX))
        ? formatChartDate(rawTooltipX, { includeYear: true })
        : String(rawTooltipX ?? `Point ${i + 1}`);
      const lines = [
        formattedTooltipX,
        ...series.map((s) => `${s.label || s.field}: ${formatMetricValue(r?.[s.field], "number")}`)
      ];
      if (typeof handlers.onTooltipShow === "function") {
        hit.addEventListener("mousemove", (e) => handlers.onTooltipShow(e, lines));
        hit.addEventListener("mouseenter", (e) => handlers.onTooltipShow(e, lines));
        hit.addEventListener("focus", () => {
          const rect = hit.getBoundingClientRect();
          handlers.onTooltipShow({ clientX: rect.left + rect.width / 2, clientY: rect.top + 16 }, lines);
        });
      }
      if (typeof handlers.onTooltipHide === "function") {
        hit.addEventListener("mouseleave", handlers.onTooltipHide);
        hit.addEventListener("blur", handlers.onTooltipHide);
      }
      svg.appendChild(hit);

      if (i % labelEvery === 0 || i === rows.length - 1) {
        const lbl = svgEl("text", {
          x: xFor(i).toFixed(2),
          y: height - 9,
          "text-anchor": "middle",
          fill: "#9494ad",
          "font-size": "11",
          "font-family": "ui-monospace, monospace"
        });
        const rawX = String(r?.[comp.xField] ?? "");
        lbl.textContent = formatChartDate(rawX, { includeYear: false });
        svg.appendChild(lbl);
      }
    });

    stage.appendChild(svg);
    card.appendChild(stage);
    return card;
  }

  function renderComparisonGrid(comp) {
    const wrap = el("article", "glass panel-card a2ui-card");
    if (comp.title) {
      const head = el("div", "panel-head");
      head.appendChild(el("h4", "panel-title", comp.title));
      wrap.appendChild(head);
    }

    const grid = el("div", "a2ui-compare-grid");
    for (const item of comp.items || []) {
      const accent = ["violet", "sky", "emerald", "amber", "rose"].includes(item.accent) ? item.accent : "violet";
      const card = el("div", `a2ui-compare-card a2ui-accent-${accent}`);
      const head = el("div", "a2ui-compare-head");
      head.appendChild(el("strong", "", item.label || ""));
      if (item.badge) {
        const pillCls = accent === "sky" ? "pill-sky" : accent === "emerald" ? "pill-green" : accent === "amber" ? "pill-amber" : accent === "rose" ? "pill-rose" : "pill-violet";
        head.appendChild(el("span", `pill ${pillCls}`, item.badge));
      }
      card.appendChild(head);

      const kvList = el("div", "a2ui-compare-metrics");
      for (const m of item.metrics || []) {
        const row = el("div", "a2ui-compare-metric");
        row.appendChild(el("span", "cell-sub", m.label || ""));
        row.appendChild(el("strong", "num-cell", m.value ?? "—"));
        kvList.appendChild(row);
      }
      card.appendChild(kvList);
      grid.appendChild(card);
    }

    wrap.appendChild(grid);
    return wrap;
  }

  function renderQuestionFeed(comp, dataModel, handlers) {
    const items = Array.isArray(comp.questionItems) ? comp.questionItems : [];
    const dataRows = resolveDataPath(dataModel, "/rows");
    const rowByEventId = new Map();
    if (Array.isArray(dataRows)) {
      for (const r of dataRows) {
        if (r && r.event_id !== undefined && r.event_id !== null) {
          rowByEventId.set(String(r.event_id), r);
        }
      }
    }

    const card = el("article", "glass panel-card a2ui-card");
    const head = el("div", "panel-head");
    head.appendChild(el("h4", "panel-title", comp.title || "Questions & Agent Lookups"));
    head.appendChild(el("span", "meta-chip", `${items.length} shown`));
    card.appendChild(head);

    if (!items.length) {
      card.appendChild(el("div", "empty-state", "No questions or agent lookups matched in this set."));
      return card;
    }

    const feed = el("div", "a2ui-qfeed");
    for (const item of items) {
      const qCard = el("div", "a2ui-qcard");
      const qHead = el("div", "a2ui-qhead");

      const leftMeta = el("div", "a2ui-qmeta");
      const isChatbot = item.actorType === "chatbot";
      leftMeta.appendChild(el("span", isChatbot ? "pill pill-green" : "pill pill-violet", isChatbot ? "Website Chatbot" : "AI Agent"));
      if (item.agentLabel) {
        leftMeta.appendChild(el("span", "meta-chip", item.agentLabel));
      }
      if (item.turnType === "Follow-up Turn") {
        leftMeta.appendChild(el("span", "pill pill-amber", "Follow-up"));
      }
      if (item.matchedKb === false) {
        leftMeta.appendChild(el("span", "pill pill-rose", "KB Miss"));
      }
      if (item.personaBadge) {
        leftMeta.appendChild(el("span", "pill pill-sky", item.personaBadge));
      }
      qHead.appendChild(leftMeta);

      const rightMeta = el("div", "a2ui-qactions");
      if (item.timestampUtc) {
        rightMeta.appendChild(el("span", "cell-sub", `${formatCellValue(item.timestampUtc, "date")} UTC`));
      }
      const matchedRow = item.eventId ? rowByEventId.get(String(item.eventId)) : null;
      if (matchedRow && typeof handlers.onRowDetail === "function") {
        const detailBtn = el("button", "btn btn-sm btn-ghost", "Full Detail");
        detailBtn.type = "button";
        detailBtn.addEventListener("click", () => handlers.onRowDetail(matchedRow));
        rightMeta.appendChild(detailBtn);
      }
      qHead.appendChild(rightMeta);
      qCard.appendChild(qHead);

      qCard.appendChild(el("div", "a2ui-qtext", item.questionText || "—"));
      if (item.effectiveQuery) {
        qCard.appendChild(el("div", "a2ui-qeff", `Resolved intent: ${item.effectiveQuery}`));
      }
      if (item.prevContext) {
        qCard.appendChild(el("div", "a2ui-qprev", `Follow-up to: ${item.prevContext}`));
      }
      if (item.rationale) {
        qCard.appendChild(el("div", "a2ui-qrationale", item.rationale));
      }

      if (item.answerSnippet) {
        const ansDetails = el("details", "a2ui-qanswer");
        const ansSummary = el("summary", "a2ui-qanswer-summary");
        ansSummary.appendChild(el("span", "chev", "▸"));
        ansSummary.appendChild(document.createTextNode("Answer preview"));
        ansDetails.appendChild(ansSummary);
        ansDetails.appendChild(el("div", "a2ui-qanswer-body", item.answerSnippet));
        qCard.appendChild(ansDetails);
      }

      feed.appendChild(qCard);
    }

    card.appendChild(feed);
    return card;
  }

  function renderDataTable(comp, dataModel, handlers) {
    const rawRows = resolveDataPath(dataModel, comp.dataPath || "/rows");
    const allRows = Array.isArray(rawRows) ? rawRows : [];
    let rows = allRows;
    if (Array.isArray(comp.eventIds) && comp.eventIds.length > 0 && allRows.length && Object.prototype.hasOwnProperty.call(allRows[0] || {}, "event_id")) {
      const idSet = new Set(comp.eventIds.map((x) => String(x)));
      const subset = allRows.filter((r) => idSet.has(String(r?.event_id)));
      if (subset.length > 0) rows = subset;
    }
    const columns = Array.isArray(comp.columns) && comp.columns.length
      ? comp.columns
      : (rows.length ? Object.keys(rows[0]).slice(0, 10).map((key) => ({ key, label: key.replace(/_/g, " "), type: "text" })) : []);

    const card = el("article", "glass panel-card a2ui-card");
    const head = el("div", "panel-head");
    const titleWrap = el("div");
    titleWrap.appendChild(el("h4", "panel-title", comp.title || `Query Results (${rows.length})`));
    head.appendChild(titleWrap);

    if (rows.length && columns.length && typeof handlers.onExportCsv === "function") {
      const exportBtn = el("button", "btn btn-sm btn-ghost", "Export CSV");
      exportBtn.type = "button";
      exportBtn.addEventListener("click", () => {
        handlers.onExportCsv(columns, rows, "analytics-ask-results");
      });
      head.appendChild(exportBtn);
    }
    card.appendChild(head);

    if (!rows.length || !columns.length) {
      card.appendChild(el("div", "empty-state", "Query returned 0 rows."));
      return card;
    }

    const wrapper = el("div", "table-wrapper");
    const table = el("table", "data-table");
    const thead = el("thead");
    const headTr = el("tr");
    const tbody = el("tbody");

    columns.forEach((col, colIdx) => {
      const th = el("th");
      th.scope = "col";
      th.dataset.col = String(colIdx);
      th.dataset.type = col.type || "text";
      th.setAttribute("data-sortable", "");

      const btn = el("button", "sort-btn");
      btn.type = "button";
      btn.appendChild(el("span", "", col.label || col.key));
      btn.appendChild(el("span", "sort-icon"));
      btn.addEventListener("click", () => {
        const cur = th.getAttribute("aria-sort");
        const nextDir = cur === "ascending" ? "descending" : "ascending";
        for (const h of headTr.querySelectorAll("th[data-sortable]")) {
          if (h === th) h.setAttribute("aria-sort", nextDir);
          else h.removeAttribute("aria-sort");
        }
        const trList = Array.from(tbody.rows);
        trList.sort((a, b) => {
          const valA = a.cells[colIdx]?.dataset.value ?? a.cells[colIdx]?.textContent ?? "";
          const valB = b.cells[colIdx]?.dataset.value ?? b.cells[colIdx]?.textContent ?? "";
          let cmp = 0;
          if (col.type === "number" || col.type === "date") {
            const na = col.type === "date" ? Date.parse(valA) : Number(valA);
            const nb = col.type === "date" ? Date.parse(valB) : Number(valB);
            cmp = (Number.isFinite(na) ? na : -Infinity) - (Number.isFinite(nb) ? nb : -Infinity);
          } else {
            cmp = collator.compare(String(valA).trim(), String(valB).trim());
          }
          return nextDir === "ascending" ? cmp : -cmp;
        });
        for (const tr of trList) tbody.appendChild(tr);
      });

      th.appendChild(btn);
      headTr.appendChild(th);
    });
    thead.appendChild(headTr);
    table.appendChild(thead);

    const hasDetailRow = (r) =>
      r && (r.raw_query !== undefined || r.question_asked !== undefined || r.response_preview !== undefined || r.event_id !== undefined);

    for (const row of rows) {
      const tr = el("tr");
      const canOpenDetail = typeof handlers.onRowDetail === "function" && hasDetailRow(row);
      if (canOpenDetail) {
        tr.dataset.clickable = "true";
        tr.tabIndex = 0;
        const open = () => handlers.onRowDetail(row);
        tr.addEventListener("click", open);
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
      }

      for (const col of columns) {
        const rawVal = row?.[col.key];
        const formatted = (col.type || "text") === "text" && /^(traffic_class|intent_category|protocol)$/i.test(col.key)
          ? humanizeEnumValue(rawVal) || "—"
          : formatCellValue(rawVal, col.type);
        const td = el("td", col.type === "number" ? "num-cell" : "", formatted);
        td.setAttribute("data-label", col.label || col.key);
        if (rawVal !== undefined && rawVal !== null) {
          td.dataset.value = String(rawVal);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
    card.appendChild(wrapper);
    return card;
  }

  function renderFollowUpChips(comp, handlers) {
    const items = Array.isArray(comp.items) ? comp.items.filter(Boolean) : [];
    if (!items.length) return null;

    const wrap = el("div", "a2ui-followups");
    wrap.appendChild(el("span", "a2ui-followups-label", "Suggested follow-ups:"));
    const row = el("div", "a2ui-chips-row");
    for (const text of items) {
      const btn = el("button", "a2ui-chip", text);
      btn.type = "button";
      if (typeof handlers.onFollowUp === "function") {
        btn.addEventListener("click", () => handlers.onFollowUp(text));
      }
      row.appendChild(btn);
    }
    wrap.appendChild(row);
    return wrap;
  }

  function renderSqlAccordion(comp) {
    const queries = Array.isArray(comp.queries) && comp.queries.length
      ? comp.queries
      : [{ step: 1, purpose: "", sql: comp.sql || "", rowCount: comp.rowCount ?? 0, durationMs: comp.durationMs ?? null, repaired: Boolean(comp.repaired) }];
    const fullSqlText = queries.map((q, idx) => (queries.length > 1 ? `-- Step ${q.step || idx + 1}: ${q.purpose || "Query"}\n${q.sql}` : q.sql)).join("\n\n");

    const details = el("details", "a2ui-sql");
    const summary = el("summary", "a2ui-sql-summary");

    const left = el("span", "a2ui-sql-title");
    left.appendChild(el("span", "chev", "▸"));
    left.appendChild(document.createTextNode(queries.length > 1 ? `Executed BigQuery SQL (${queries.length} steps)` : "Executed BigQuery SQL"));
    summary.appendChild(left);

    const right = el("div", "a2ui-sql-meta");
    right.appendChild(el("span", "meta-chip", `${comp.rowCount ?? 0} rows`));
    if (comp.durationMs !== undefined && comp.durationMs !== null) {
      right.appendChild(el("span", "meta-chip", `${comp.durationMs} ms`));
    }
    if (comp.model) {
      right.appendChild(el("span", "meta-chip", comp.model));
    }
    if (comp.repaired) {
      right.appendChild(el("span", "pill pill-amber", "Auto-repaired"));
    }

    const copyBtn = el("button", "btn btn-sm btn-ghost", "Copy SQL");
    copyBtn.type = "button";
    copyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(fullSqlText).then(() => {
          copyBtn.textContent = "Copied";
          setTimeout(() => { copyBtn.textContent = "Copy SQL"; }, 1600);
        }).catch(() => {});
      }
    });
    right.appendChild(copyBtn);
    summary.appendChild(right);
    details.appendChild(summary);

    const stepsWrap = el("div", "a2ui-sql-steps");
    queries.forEach((q, idx) => {
      if (queries.length > 1) {
        const stepHead = el("div", "a2ui-sql-step-head");
        stepHead.appendChild(el("span", "", `Step ${q.step || idx + 1}: ${q.purpose || "BigQuery query"}`));
        stepHead.appendChild(el("span", "meta-chip", `${q.rowCount ?? 0} rows · ${q.durationMs ?? 0} ms`));
        stepsWrap.appendChild(stepHead);
      }
      const pre = el("pre", "a2ui-sql-pre");
      pre.appendChild(el("code", "", q.sql || ""));
      stepsWrap.appendChild(pre);
    });
    details.appendChild(stepsWrap);
    return details;
  }

  function renderSurface(envelope, handlers = {}) {
    const a2ui = envelope?.a2ui || envelope || {};
    const updateComponents = a2ui.updateComponents || {};
    const dataModel = a2ui.updateDataModel?.data || {};
    const list = Array.isArray(updateComponents.components) ? updateComponents.components : [];
    const compMap = new Map();
    for (const c of list) {
      if (c && c.id) compMap.set(c.id, c);
    }

    const rootId = updateComponents.rootId || "root_col";
    const visited = new Set();

    function renderNode(nodeId) {
      if (!nodeId || visited.has(nodeId)) return null;
      const comp = compMap.get(nodeId);
      if (!comp) return null;
      visited.add(nodeId);

      switch (comp.component) {
        case "Column":
        case "Row": {
          const box = el("div", comp.component === "Row" ? "a2ui-row" : "a2ui-col");
          for (const childId of comp.children || []) {
            const childEl = renderNode(childId);
            if (childEl) box.appendChild(childEl);
          }
          return box;
        }
        case "SummaryCard":
          return renderSummaryCard(comp);
        case "ProvenanceBar":
          return renderProvenanceBar(comp);
        case "QuestionFeed":
          return renderQuestionFeed(comp, dataModel, handlers);
        case "KpiStrip":
          return renderKpiStrip(comp);
        case "BarChart":
          return renderBarChart(comp, dataModel);
        case "DonutShareChart":
          return renderDonutShareChart(comp, dataModel);
        case "StackedBarChart":
          return renderStackedBarChart(comp, dataModel, handlers);
        case "LineChart":
          return renderLineChart(comp, dataModel, handlers);
        case "ComparisonGrid":
          return renderComparisonGrid(comp);
        case "SessionTimeline":
          return renderSessionTimeline(comp, dataModel, handlers);
        case "GapAuditCard":
          return renderGapAuditCard(comp, dataModel, handlers);
        case "DataTable":
          return renderDataTable(comp, dataModel, handlers);
        case "FollowUpChips":
          return renderFollowUpChips(comp, handlers);
        case "SqlAccordion":
          return renderSqlAccordion(comp);
        default:
          return null;
      }
    }

    const surfaceEl = el("div", "a2ui-surface");
    const rootEl = renderNode(rootId);
    if (rootEl) {
      surfaceEl.appendChild(rootEl);
    } else {
      surfaceEl.appendChild(el("div", "empty-state", "No renderable UI components in response."));
    }
    return surfaceEl;
  }

  window.AnalyticsA2UIRenderer = {
    renderSurface
  };
})();
