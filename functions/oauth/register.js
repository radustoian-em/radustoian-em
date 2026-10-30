export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept"
    }
  });
}

export async function onRequestPost(context) {
  const { request } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {}

  const clientId = "gemini_mcp_" + crypto.randomUUID().slice(0, 8);
  const clientSecret = crypto.randomUUID().replace(/-/g, "");

  return new Response(JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: body.client_name || "Gemini Custom MCP",
    redirect_uris: body.redirect_uris || [],
    grant_types: ["authorization_code", "client_credentials", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: "read:profile read:ai"
  }), {
    status: 201,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
