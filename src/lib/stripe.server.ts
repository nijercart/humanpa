/**
 * Minimal Stripe REST client over fetch — the official SDK is heavier than we
 * need and this keeps the Worker bundle clean.
 */

export function requireStripeKey(): string {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Payments aren't configured yet. Add your Stripe secret key.");
  return key;
}

function encode(form: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export async function stripePost<T = Record<string, unknown>>(
  path: string,
  form: Record<string, string | number | undefined>,
): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireStripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encode(form),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = body["error"] as { message?: string } | undefined;
    throw new Error(error?.message ?? `Stripe request failed (${response.status}).`);
  }
  return body as T;
}

/** Verify a Stripe webhook signature (v1 scheme) without pulling in the SDK. */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [k, v] = part.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    }),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
