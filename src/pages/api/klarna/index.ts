export const clientIds = {
  EU: "ca89d7d6-f74e-4c4f-9fa9-a28fd13d4074",
  US: "639c2886-026e-452f-b5fc-096683d95b0e",
  AP: "51119b87-8f66-4ef9-973a-60f7034d0a98",
};

export const logoCache: Record<string, string> = {};

export async function toBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  if (logoCache[url]) {
    return logoCache[url];
  }

  const contentType = response.headers.get("content-type") || "image/png";

  return `data:${contentType};base64,${base64}`;
}

export let accessToken: string = "";

export function revokeAccessToken() {
  accessToken = "";
}

export async function getAccessToken() {
  if (accessToken.length !== 0) return accessToken;

  const clientId = clientIds.EU;

  // Gather that by going on https://app.klarna.com/wallet-home-v2
  // Type the line bellow in the console
  // const refreshToken = localStorage.getItem("@KLAPP:signIn:refreshToken");
  const refreshToken = process.env.KLARNA_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error("KLARNA_REFRESH_TOKEN was not declared in env.");
  }

  try {
    const response = await fetch("https://app.klarna.com/fr/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        redirect_uri: "https://app.klarna.com/auth/callback",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh access token");
    }

    const data = await response.json();

    accessToken = data.access_token;

    return accessToken;
  } catch (error) {
    console.error("Error getting access token:", error);
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 300,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 1) throw err;
    revokeAccessToken();
    await new Promise((res) => setTimeout(res, delayMs));
    return retry(fn, retries - 1, delayMs);
  }
}
