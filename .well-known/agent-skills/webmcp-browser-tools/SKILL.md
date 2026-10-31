---
name: webmcp-browser-tools
description: When to use: Use this skill when operating inside an AI-enabled web browser or automated agent to discover, invoke, and navigate radustoian.com using client-side WebMCP tools.
---

# WebMCP Browser Agent Tools Skill

## When to Use This Skill

Use this skill when:
- Operating inside an AI-enabled web browser, headless browser automation, or client-side agent on `https://radustoian.com`.
- Navigating page sections smoothly or scrolling to specific content blocks (`navigateToSection`).
- Browsing multi-card client case studies or testimonial carousels programmatically (`showCarouselSlide`).
- Extracting structured case studies, testimonials, contact links, publications, speaking engagements, and credentials via `document.modelContext` without DOM scraping.
- Triggering or pre-filling the interactive on-page AI chat widget (`askChatbot`).

Do NOT use this skill when:
- Operating as an external server-side or CLI agent without browser execution capabilities (use `mcp-server-tools` instead).

## Protocol Overview

`radustoian.com` implements the [WebMCP specification](https://webmachinelearning.github.io/webmcp/) via `document.modelContext.registerTool` (with fallback to `navigator.modelContext`). Tools are registered client-side upon page load and provide structured programmatic access to page data without DOM scraping.

All WebMCP tools are marked with `readOnly: true`, `readOnlyHint: true`, `idempotentHint: true`, and `destructiveHint: false`.

---

## Registered Tool Inventory

### Navigation & Carousels
1. **`navigateToSection`**
   - **Parameters:** `{ "section": "top" | "about" | "expertise" | "insights" | "projects" | "testimonials" | "speaking" | "skills" | "connect" }`
   - **Behavior:** Smoothly scrolls the viewport to the target section (or instantly if `prefers-reduced-motion` is active) and returns section heading (with fallback for headingless sections like `#about`) and text.
2. **`showCarouselSlide`**
   - **Parameters:**
     - `carousel`: `"caseStudies"` | `"testimonials"`
     - `action`: `"next"` | `"previous"` | `"goto"`
     - `index` (optional integer): 1-based slide index when `action` is `"goto"`.
   - **Behavior:** Operates the multi-card carousel, waits for CSS transition completion (`transitionend`), and returns visible slide objects and boundary states (`atStart`, `atEnd`).

### Structured Data Extraction
3. **`listCaseStudies`** (alias: `getCaseStudies`)
   - **Parameters:** `{}`
   - **Returns:** Full array of client case study cards (John Lewis Partnership, University of Surrey, Virgin Atlantic, JLP Smart Careers) with titles, metric highlights, and direct `url` / `link` fields.
4. **`listTestimonials`** (alias: `getTestimonials`)
   - **Parameters:** `{}`
   - **Returns:** Verified client testimonials including person name, organizational role, and complete recommendation quotes.
5. **`getContactLinks`**
   - **Parameters:** `{}`
   - **Returns:** Deduplicated list of official profile and outreach links (LinkedIn, Substack, GitHub, X) with `url` and `link` fields.
6. **`listPublications`** (alias: `getPublications`)
   - **Parameters:** `{ "platform": "all" | "substack" | "linkedin" }` (optional)
   - **Returns:** Main publications, topics, summaries, and specifically identifies all direct links to Radu's articles on Substack (`/p/` article links) with `url` and `link` fields.
7. **`listSpeakingEngagements`** (aliases: `getSpeakingEngagements`, `getSpeakingEngagement`)
   - **Parameters:** `{ "format": string }` (optional keyword filter)
   - **Returns:** Speaking engagements, masterclasses (BrightonSEO), podcast guest spots, panel sessions, and open-source contributions (OJCP RFC) with normalized direct `url` and `link` fields, `eventUrl`, and `resource` media links (YouTube, Speaker Deck, GitHub).
8. **`listCertificatesAndSkills`** (alias: `getCertificatesAndSkills`)
   - **Parameters:** `{}`
   - **Returns:** Professional credentials (Google Cloud GenAI Leader, Intro to GenAI, BigQuery), skill tags, and external profile links to all skills and certifications on LinkedIn, Credly, and Google Skills.

### Conversational Chat
9. **`askChatbot`** (aliases: `askAIAboutRadu`, `askAiAboutRadu`, `openChatbot`, `openChat`, `askAboutRadu`, `ask_chatbot`)
   - **Parameters:** `{ "question": string }` (optional)
   - **Behavior:** Opens the interactive conversational AI chat dialog on the page, ensures the chat window is visible, and focuses the chat input box ready for the user to type their question (with optional pre-filled question text).
