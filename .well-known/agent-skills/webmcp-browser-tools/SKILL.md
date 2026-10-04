---
name: webmcp-browser-tools
description: Instructions for in-browser AI agents to discover, invoke, and navigate radustoian.com using client-side WebMCP tools.
---

# WebMCP Browser Agent Tools Skill

Use this skill when operating inside an AI-enabled web browser or automated agent environment connected to `https://radustoian.com`.

## Protocol Overview

`radustoian.com` implements the [WebMCP specification](https://webmachinelearning.github.io/webmcp/) via `document.modelContext.registerTool` (with fallback to `navigator.modelContext`). Tools are registered client-side upon page load and provide structured programmatic access to page data without DOM scraping.

All WebMCP tools are marked with `readOnlyHint: true`.

---

## Registered Tool Inventory

### Navigation & Carousels
1. **`navigateToSection`**
   - **Parameters:** `{ "section": "top" | "about" | "expertise" | "insights" | "projects" | "testimonials" | "speaking" | "skills" | "connect" }`
   - **Behavior:** Smoothly scrolls the viewport to the target section (or instantly if `prefers-reduced-motion` is active) and returns section heading and text.
2. **`showCarouselSlide`**
   - **Parameters:**
     - `carousel`: `"caseStudies"` | `"testimonials"`
     - `action`: `"next"` | `"previous"` | `"goto"`
     - `index` (optional integer): 1-based slide index when `action` is `"goto"`.
   - **Behavior:** Operates the multi-card carousel, waits for CSS transition completion (`transitionend`), and returns visible slide objects and boundary states (`atStart`, `atEnd`).

### Structured Data Extraction
3. **`listCaseStudies`**
   - **Parameters:** `{}`
   - **Returns:** Full array of client case study cards (John Lewis Partnership, University of Surrey, Virgin Atlantic, JLP Smart Careers) with titles, metric highlights, and case study URLs.
4. **`listTestimonials`**
   - **Parameters:** `{}`
   - **Returns:** Verified client testimonials including person name, organizational role, and complete recommendation quotes.
5. **`getContactLinks`**
   - **Parameters:** `{}`
   - **Returns:** Deduplicated list of official profile and outreach links (LinkedIn, Substack, GitHub, X).
6. **`listPublications`**
   - **Parameters:** `{ "platform": "all" | "substack" | "linkedin" }` (optional)
   - **Returns:** Main publications, topics, summaries, and specifically identifies all direct links to Radu's articles on Substack (`/p/` article links).
7. **`listSpeakingEngagements`**
   - **Parameters:** `{ "format": string }` (optional keyword filter)
   - **Returns:** Speaking engagements, masterclasses (BrightonSEO), podcast guest spots, panel sessions, and open-source contributions (OJCP RFC) with event URLs and media links (YouTube, Speaker Deck, GitHub).
8. **`listCertificatesAndSkills`**
   - **Parameters:** `{}`
   - **Returns:** Professional credentials (Google Cloud GenAI Leader, Intro to GenAI, BigQuery), skill tags, and external profile links to all skills and certifications on LinkedIn and Google Skills.
