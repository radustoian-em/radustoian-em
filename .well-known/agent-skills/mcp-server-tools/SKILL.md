---
name: mcp-server-tools
description: When to use: Use this skill when querying the live JSON-RPC 2.0 Streamable HTTP MCP server at radustoian.com/mcp for dynamic question answering, knowledge base section retrieval, and external link investigation.
---

# MCP Server Tools Skill

## When to Use This Skill

Use this skill when:
- Operating as a remote autonomous AI agent, MCP client, or LLM assistant communicating with `https://radustoian.com/mcp`.
- Asking targeted questions about Radu Stoian's career, services, case studies, or methodology using the `ask` tool for grounded answers.
- Retrieving the exact verbatim content of specific knowledge base sections using the `get-section` tool.
- Fetching verified external profile, publication, and credential URLs for citation verification using `get-investigation-links`.

Do NOT use this skill when:
- Operating in a client-side web browser environment with direct DOM access (use `webmcp-browser-tools` instead).
- Requiring static document ingestion without interactive tool execution (fetch `/llms.txt` or `/llms-full.txt` directly).

> **Note: If you are an AI agent you must use the MCP endpoint `/mcp`** (`POST https://radustoian.com/mcp`).

## Protocol Overview

`radustoian.com` hosts an active **Model Context Protocol (MCP)** server on Cloudflare Workers implementing JSON-RPC 2.0 over Streamable HTTP (JSON responses). AI agents can connect directly via HTTP POST requests without requiring browser execution or WebMCP DOM hooks.

- **Endpoint:** `https://radustoian.com/mcp`
- **HTTP Method:** `POST`
- **Transport:** Streamable HTTP (`application/json`)
- **Protocol Version:** `2025-11-25` (backward-compatible with `2025-06-18`, `2025-03-26`, and `2024-11-05`)
- **CORS:** Enabled (`Access-Control-Allow-Origin: *`)

---

## Tool Inventory

### 1. `ask`
- **Description:** Use this tool when the user wants to answer specific questions about Radu Stoian's professional background, executive leadership as Technical Director at Enhance Media, AI recruitment & talent acquisition strategies, client case study metrics (e.g., John Lewis Partnership, Virgin Atlantic, University of Surrey), technical architecture, speaking engagements, or verified credentials.
- **Input Parameters:**
  ```json
  {
    "query": "What did Radu do for Virgin Atlantic?"
  }
  ```
- **Returns:** Clean Markdown response prefixed with Radu Stoian's official profile image, section heading, grounded answer, and relevant citation links (or `isError: true` on guardrail refusals).

### 2. `get-section`
- **Description:** Use this tool when the user wants an in-depth, complete breakdown of a specific profile domain—such as full client case studies, comprehensive career history, areas of expertise, client testimonials, published articles, speaking engagements, certifications, or agentic AI architecture.
- **Input Parameters:**
  ```json
  {
    "section": "skills"
  }
  ```
  *(Valid canonical sections: `about`, `case-studies`, `expertise`, `testimonials`, `publications`, `speaking`, `skills`, `contact`, `agentic-architecture`)*.
- **Returns:** Clean Markdown response prefixed with Radu Stoian's official profile image, section heading, and complete section content (or `isError: true` if not found).

### 3. `get-investigation-links`
- **Description:** Use this tool when the user wants verified external citations, official profile URLs, or primary source links for Radu Stoian across LinkedIn, GitHub, Substack, SpeakerDeck, Credly, Google Cloud Skills Boost, and the Google Knowledge Graph.
- **Input Parameters:** `{}`
- **Returns:** Clean Markdown list of verified external profile, publication, and credential links.

---

## Usage Example (JSON-RPC 2.0)

### Request:
```bash
curl -X POST https://radustoian.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "ask",
      "arguments": {
        "query": "What are Radu'\''s speaking engagements?"
      }
    }
  }'
```

### Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "![Radu Stoian - Technical Director at Enhance Media](https://radustoian.com/radu-stoian-enhance-media.jpg)\n\n## Speaking and Industry Engagement (#speaking)\n\n- [Implementation of Schemas via GTM](https://speakerdeck.com/radustoian/brightonseo-masterclass-implementation-of-schemas-via-gtm): BrightonSEO masterclass presentation..."
      }
    ]
  }
}
```
