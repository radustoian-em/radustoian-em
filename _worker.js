export default {
  async fetch(request, env, ctx) {
    // Fetch the original request from your Cloudflare Pages assets
    const response = await env.ASSETS.fetch(request);

    // If the asset returns a 404 Not Found, redirect to the homepage
    if (response.status === 404) {
      return Response.redirect("https://radustoian.com/", 301);
    }

    // Otherwise, return the normal file/page (e.g., your images, llms.txt, or valid pages)
    return response;
  },
};