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
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      body = await request.json();
    } catch {}
  } else {
    try {
      const text = await request.text();
      const params = new URLSearchParams(text);
      for (const [k, v] of params.entries()) {
        body[k] = v;
      }
    } catch {}
  }

  const scope = body.scope || "read:profile read:ai";
  const accessToken = "rs_at_" + crypto.randomUUID().replace(/-/g, "");
  const refreshToken = "rs_rt_" + crypto.randomUUID().replace(/-/g, "");

  return new Response(JSON.stringify({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 86400,
    scope: scope,
    refresh_token: refreshToken
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
