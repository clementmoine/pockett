export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const { seedCustomProviders } = await import("@/lib/custom-providers");
    const n = await seedCustomProviders();
    console.log(`[custom-providers] seeded ${n}`);
  } catch (err) {
    console.warn("[custom-providers] seed failed", err);
  }

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
