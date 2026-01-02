export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  // Credenziali configurate su Cloudflare Pages env vars (metteremo dopo)
  const allowedEmail = String(env.ALLOWED_EMAIL || "").trim().toLowerCase();
  const allowedPassword = String(env.GATE_PASSWORD || "");

  if (!allowedEmail || !allowedPassword) {
    return new Response(JSON.stringify({ ok: false, error: "Server not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (email !== allowedEmail || password !== allowedPassword) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid credentials" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // MVP cookie (nel prossimo step lo rendiamo firmato/secure)
  const cookie = [
    `fa_session=1`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=1209600" // 14 giorni
    // "Secure" verrà aggiunto nel prossimo step (https only)
  ].join("; ");

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}
