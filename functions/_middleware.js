// Cloudflare Pages Middleware: markdown-for-agents
// Route: / (Runs automatically on all requests to radustoian.com)
//
// Provides edge content negotiation for AI agents, advertises discovery
// endpoints (REST API, OpenAPI, MCP server, server-card, ARD), redirects MCP
// streaming clients, and serves high-fidelity markdown representations.

const API_URL = 'https://radustoian.com/api';
const OPENAPI_URL = 'https://radustoian.com/openapi.json';
const MCP_URL = 'https://radustoian.com/mcp';
const MCP_SERVER_CARD_URL = 'https://radustoian.com/.well-known/mcp/server-card.json';
const ARD_URL = 'https://radustoian.com/.well-known/ard.json';

// Authoritative Link header for Homepage HTML (site-wide identity & discovery)
const HOMEPAGE_HTML_LINK_HEADER = [
  '</index.md.txt>; rel="alternate"; type="text/markdown"',
  '<https://radustoian.com/llms-full.txt>; rel="describedby"; type="text/markdown"',
  '<https://radustoian.com/metadata.json>; rel="describedby"; type="application/json"',
  '<' + API_URL + '>; rel="service"; type="application/json"',
  '<' + OPENAPI_URL + '>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '<' + MCP_URL + '>; rel="service"; type="application/json"',
  '<' + MCP_SERVER_CARD_URL + '>; rel="mcp-server-card"; type="application/json"',
  '<' + ARD_URL + '>; rel="ard"; type="application/json"'
].join(', ');

// Authoritative Link header for Agentic Architecture HTML (STRICTLY points to its markdown version)
const AGENTIC_HTML_LINK_HEADER = '</agentic-architecture-mcp-llms.md.txt>; rel="alternate"; type="text/markdown"';

// Authoritative Link header for Homepage Markdown representations
const HOMEPAGE_MARKDOWN_LINK_HEADER = [
  '<https://radustoian.com/>; rel="canonical"',
  '<' + API_URL + '>; rel="service"; type="application/json"',
  '<' + OPENAPI_URL + '>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '<' + MCP_URL + '>; rel="service"; type="application/json"',
  '<' + MCP_SERVER_CARD_URL + '>; rel="mcp-server-card"; type="application/json"'
].join(', ');

// Authoritative Link header for Agentic Architecture Markdown representations (STRICTLY points to canonical HTML)
const AGENTIC_MARKDOWN_LINK_HEADER = '<https://radustoian.com/agentic-architecture-mcp-llms.html>; rel="canonical"';

// Authoritative Link header for XML Sitemap
const SITEMAP_LINK_HEADER = '<https://radustoian.com/llms.txt>; rel="describedby"; type="text/markdown"';

/**
 * Fetch an internal asset from Cloudflare Pages static asset storage
 */
async function getAsset(context, relativePath) {
  const url = new URL(relativePath, context.request.url);
  if (context.env && context.env.ASSETS && typeof context.env.ASSETS.fetch === 'function') {
    return await context.env.ASSETS.fetch(new Request(url));
  }
  return await fetch(url);
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const accept = request.headers.get('Accept') || '';
  const path = url.pathname;

  const wantsMarkdown =
    accept.includes('text/markdown') ||
    (accept.includes('text/*') && !accept.includes('text/html'));

  // MCP Streamable HTTP transport: clients send Accept: application/json, text/event-stream
  const wantsMcp =
    accept.includes('application/json') &&
    accept.includes('text/event-stream');

  // MCP client hitting a non-/mcp path — redirect to the MCP endpoint
  if (wantsMcp && path !== '/mcp') {
    return new Response(null, {
      status: 307,
      headers: {
        'location': MCP_URL,
        'link': '<' + MCP_URL + '>; rel="service"; type="application/json", <' + MCP_SERVER_CARD_URL + '>; rel="mcp-server-card"; type="application/json"',
      },
    });
  }

  // 1. Direct Markdown fetch
  if (path === '/index.md.txt' || path === '/.md.txt') {
    const resp = await context.next();
    if (!resp.ok) return resp;
    const body = await resp.text();
    const headers = new Headers(resp.headers);

    headers.set('content-type', 'text/markdown; charset=utf-8');
    headers.set('vary', 'accept');
    headers.set('content-signal', 'ai-train=yes, search=yes, ai-input=yes');
    headers.set('link', HOMEPAGE_MARKDOWN_LINK_HEADER);
    headers.set('x-markdown-tokens', '4773');
    headers.set('x-original-tokens', '10588');

    return new Response(body, { status: 200, headers });
  }

  if (path === '/agentic-architecture-mcp-llms.md.txt' || path === '/agentic-architecture-mcp-llms.md') {
    const resp = await context.next();
    if (!resp.ok) return resp;
    const body = await resp.text();
    const headers = new Headers(resp.headers);

    headers.set('content-type', 'text/markdown; charset=utf-8');
    headers.set('vary', 'accept');
    headers.set('content-signal', 'ai-train=yes, search=yes, ai-input=yes');
    headers.set('link', AGENTIC_MARKDOWN_LINK_HEADER);
    headers.set('x-markdown-tokens', '3209');
    headers.set('x-original-tokens', '10060');

    return new Response(body, { status: 200, headers });
  }

  // 2. Content negotiation: Page requested with Accept: text/markdown
  const isHomepage = path === '/' || path === '' || path === '/index.html';
  if (isHomepage && wantsMarkdown) {
    const mdResp = await getAsset(context, '/index.md.txt');
    if (mdResp.ok) {
      const body = await mdResp.text();
      const headers = new Headers(mdResp.headers);

      headers.set('content-type', 'text/markdown; charset=utf-8');
      headers.set('vary', 'accept');
      headers.set('content-signal', 'ai-train=yes, search=yes, ai-input=yes');
      headers.set('link', HOMEPAGE_MARKDOWN_LINK_HEADER);
      headers.set('x-markdown-tokens', '4773');
      headers.set('x-original-tokens', '10588');

      return new Response(body, { status: 200, headers });
    }
  }

  const isAgenticPage = path === '/agentic-architecture-mcp-llms' || path === '/agentic-architecture-mcp-llms.html';
  if (isAgenticPage && wantsMarkdown) {
    const mdResp = await getAsset(context, '/agentic-architecture-mcp-llms.md.txt');
    if (mdResp.ok) {
      const body = await mdResp.text();
      const headers = new Headers(mdResp.headers);

      headers.set('content-type', 'text/markdown; charset=utf-8');
      headers.set('vary', 'accept');
      headers.set('content-signal', 'ai-train=yes, search=yes, ai-input=yes');
      headers.set('link', AGENTIC_MARKDOWN_LINK_HEADER);
      headers.set('x-markdown-tokens', '3209');
      headers.set('x-original-tokens', '10060');

      return new Response(body, { status: 200, headers });
    }
  }

  // 3. Default: Pass through to Cloudflare Pages static origin
  const resp = await context.next();

  // Authoritative Link header for /sitemap.xml (intercepted before generic .xml fast path)
  if (path === '/sitemap.xml') {
    const newHeaders = new Headers(resp.headers);
    newHeaders.set('link', SITEMAP_LINK_HEADER);

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: newHeaders,
    });
  }

  // Fast path: Don't modify or bloat headers for static media/assets
  if (/\.(css|js|jpg|jpeg|png|webp|svg|ico|webmanifest|xml)$/i.test(path)) {
    return resp;
  }

  // For HTML responses: apply clean, authoritative headers
  if (isAgenticPage) {
    const newHeaders = new Headers(resp.headers);

    // Strictly points to the page's markdown representation
    newHeaders.set('link', AGENTIC_HTML_LINK_HEADER);

    // Ensure Vary: Accept
    newHeaders.set('vary', 'accept');

    // Align Referrer-Policy with HTML
    newHeaders.set('referrer-policy', 'strict-origin-when-cross-origin');

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: newHeaders,
    });
  }

  if (isHomepage || path.endsWith('.html')) {
    const newHeaders = new Headers(resp.headers);

    // Overwrite Link completely — eliminates duplicates and preserves rel="alternate"
    newHeaders.set('link', HOMEPAGE_HTML_LINK_HEADER);

    // Ensure Vary: Accept
    newHeaders.set('vary', 'accept');

    // Align Referrer-Policy with HTML
    newHeaders.set('referrer-policy', 'strict-origin-when-cross-origin');

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: newHeaders,
    });
  }

  return resp;
}
