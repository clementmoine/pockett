export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { hasKlarnaRefreshToken } = await import("@/lib/klarna-config");
  const { klarnaSession } = await import("@/lib/session");

  if (!hasKlarnaRefreshToken()) {
    console.warn(
      "[klarna] aucun refresh token — Connect Klarna dans l’app.",
    );
    return;
  }

  const result = await klarnaSession.ensureReady();
  if (result.ok) console.log("[klarna] auth ready");
  else console.warn(`[klarna] auth failed: ${result.error}`);
}
