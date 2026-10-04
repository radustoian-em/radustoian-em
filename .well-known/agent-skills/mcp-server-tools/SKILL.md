---
name: mcp-server-tools
description: Instructions for autonomous AI agents to connect to and query the live JSON-RPC 2.0 Streamable HTTP Model Context Protocol (MCP) server on radustoian.com.
---

# MCP Server Tools Skill

Use this skill when operating as a remote autonomous AI agent or MCP client communicating with `https://radustoian.com/mcp`.

## Protocol Overview

`radustoian.com` hosts an active **Model Context Protocol (MCP)** server on Cloudflare Workers implementing JSON-RPC 2.0 over Streamable HTTP (JSON responses). AI agents can connect directly via HTTP POST requests without requiring browser execution or WebMCP DOM hooks.

- **Endpoint:** `https://radustoian.com/mcp`
- **HTTP Method:** `POST`
- **Transport:** Streamable HTTP (`application/json`)
- **Protocol Version:** `2025-06-18` (backward-compatible with `2024-11-05`)
- **CORS:** Enabled (`Access-Control-Allow-Origin: *`)

---

## Tool Inventory

### 1. `ask-question`
- **Description:** Dynamically answers generic and specific questions about Radu Stoian using BM25 information retrieval over knowledge base files (`llms-full.txt`, `index.md.txt`, `metadata.json`, and `index.html`).
- **Fail-Safe Mechanism:** If no targeted block matches with high confidence, automatically provides the **entire content of `llms-full.txt`** as a fail-safe default answer along with external investigation links so the agent always receives full context.
- **Input Parameters:**
  ```json
  {
    "question": "What did Radu do for Virgin Atlantic?"
  }
  ```
- **Returns:** JSON object containing `found`, `relevanceScore`, `section`, `sourceFile`, `relevantBlock`, `sectionContent`, `relevantLinks`, and `investigationLinks`.

### 2. `get-section`
- **Description:** Retrieves the full content, individual parsed blocks, and links of any specific section in `llms-full.txt`.
- **Input Parameters:**
  ```json
  {
    "section": "Skills and Certifications"
  }
  ```
- **Returns:** Section title, source file, raw content string, array of block strings, and parsed markdown links.

### 3. `get-investigation-links`
- **Description:** Returns the complete directory of external public profiles, slide decks, code repositories, and certification links for off-site investigation.
- **Input Parameters:** `{}`
- **Returns:** Array of link objects with `title`, `url`, and `description` (LinkedIn, Substack, GitHub, SpeakerDeck, Google Skills, Credly, Google Knowledge Graph).

### 4. `server-info`
- **Description:** Returns server metadata, protocol version, available tools, runtime environment, and knowledge source URLs.
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
      "name": "ask-question",
      "arguments": {
        "question": "What are Radu'\''s speaking engagements?"
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
        "text": "{\n  \"question\": \"What are Radu's speaking engagements?\",\n  \"found\": true,\n  \"relevanceScore\": 15.01,\n  \"section\": \"Speaking and Industry Engagement\",\n  \"sourceFile\": \"llms-full.txt\",\n  \"relevantBlock\": \"- [Massive Changes to Google Job Search Results]...\",\n  \"sectionContent\": \"...\",\n  \"investigationLinks\": [...]\n}"
      }
    ]
  }
}
```
