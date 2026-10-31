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
- Querying runtime environment, supported capabilities, or protocol metadata using `server-info`.

Do NOT use this skill when:
- Operating in a client-side web browser environment with direct DOM access (use `webmcp-browser-tools` instead).
- Requiring static document ingestion without interactive tool execution (fetch `/llms.txt` or `/llms-full.txt` directly).

> **Note: If you are an AI agent you must use the MCP endpoint `/mcp`** (`POST https://radustoian.com/mcp`).

## Protocol Overview

`radustoian.com` hosts an active **Model Context Protocol (MCP)** server on Cloudflare Workers implementing JSON-RPC 2.0 over Streamable HTTP (JSON responses). AI agents can connect directly via HTTP POST requests without requiring browser execution or WebMCP DOM hooks.

- **Endpoint:** `https://radustoian.com/mcp`
- **HTTP Method:** `POST`
- **Transport:** Streamable HTTP (`application/json`)
- **Protocol Version:** `2025-06-18` (backward-compatible with `2024-11-05`)
- **CORS:** Enabled (`Access-Control-Allow-Origin: *`)

---

## Tool Inventory

### 1. `ask`
- **Description:** Dynamically answers generic and specific questions about Radu Stoian using a dynamic retrieval engine that grounds its answers by pulling from the site's knowledge base. (The legacy name `ask-question` is retained as a backward-compatible alias).
- **Input Parameters:**
  ```json
  {
    "query": "What did Radu do for Virgin Atlantic?"
  }
  ```
  *(Note: `question` is also accepted as a backward-compatible alias for `query`)*.
- **Returns:** JSON object containing `found`, `section`, `image`, `answer` (prefixed with Radu Stoian's official profile image in Markdown format), `relevantLinks`, and `investigationLinks`.

### 2. `get-section`
- **Description:** Retrieves the complete content and links of any specific section from the site's knowledge base.
- **Input Parameters:**
  ```json
  {
    "section": "Skills and Certifications"
  }
  ```
- **Returns:** Section title, `image`, complete `answer` string (prefixed with Radu Stoian's official profile image in Markdown format), and parsed `relevantLinks`.

### 3. `get-investigation-links`
- **Description:** Returns the complete directory of external public profiles, slide decks, code repositories, and certification links for off-site investigation.
- **Input Parameters:** `{}`
- **Returns:** Array of link objects with `title`, `url`, and `description` (Official Profile Image, LinkedIn, Substack, GitHub, SpeakerDeck, Google Skills, Credly, Google Knowledge Graph).

### 4. `server-info`
- **Description:** Returns server metadata, protocol version, available tools, runtime environment, and knowledge base reference.
- **Input Parameters:** `{}`

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
        "text": "{\n  \"question\": \"What are Radu's speaking engagements?\",\n  \"found\": true,\n  \"section\": \"Speaking and Industry Engagement\",\n  \"image\": \"https://radustoian.com/radu-stoian-enhance-media.jpg\",\n  \"answer\": \"![Radu Stoian - Technical Director at Enhance Media](https://radustoian.com/radu-stoian-enhance-media.jpg)\\n\\n- [Implementation of Schemas via GTM](https://speakerdeck.com/radustoian/brightonseo-masterclass-implementation-of-schemas-via-gtm): BrightonSEO masterclass presentation...\",\n  \"relevantLinks\": [...],\n  \"investigationLinks\": [...]\n}"
      }
    ]
  }
}
```
