export async function onRequest(context) {
  const cookie = context.request.headers.get("Cookie") || "";
  const hasSession = /fa_session=/.test(cookie);

  // Per ora: se c'è il cookie, diciamo "authenticated".
  // Nel prossimo step firmiamo/verifichiamo il cookie (sicuro) e aggiungiamo email.
  return new Response(
    JSON.stringify({
      authenticated: hasSession,
      email: hasSession ? "mario_palermo97@live.it" : null
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
