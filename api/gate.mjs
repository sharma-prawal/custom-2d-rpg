import crypto from "node:crypto";

/**
 * Shared gate verifier. Copied verbatim into every app — do not edit per-app.
 *
 * .mjs is deliberate: it is always ESM regardless of whether the project has a
 * package.json with "type": "module" (the Vite apps) or none at all (the static
 * apps), so one identical file works across every stack.
 *
 * Accepts either:
 *   { grant }    a one-hop token minted by the dashboard for THIS app
 *   { password } typed into this app's own lock screen (direct visits)
 *
 * Returns only { ok }. Never echoes the password, the secret, or why it failed.
 */

const GRANT_PREFIX = "grant|";

const env = (name) => process.env[name] ?? "";

/** Same window as the dashboard session. Sent to the client so the per-tab unlock
 *  expires in step with it instead of lasting for the life of the tab. */
function sessionSeconds() {
  const n = Number(process.env.GATE_SESSION_MINUTES);
  return (Number.isFinite(n) && n > 0 ? Math.floor(n) : 10) * 60;
}

/**
 * timingSafeEqual throws on length mismatch, and that throw is itself a length
 * oracle — so hash both sides to a fixed 32 bytes first.
 */
function constantTimeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a), "utf8").digest();
  const hb = crypto.createHash("sha256").update(String(b), "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

function verifyGrant(token) {
  const secret = env("GATE_SECRET");
  const audience = env("GATE_AUDIENCE");
  // Fail closed: missing config must never mean "let everyone in".
  if (!secret || !audience || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;

  const [, encoded, signature] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(GRANT_PREFIX + encoded)
    .digest("base64url");
  if (!constantTimeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
      return false;
    }
    if (typeof payload.aud !== "string") return false;
    // Audience binding: a grant minted for another app is refused here.
    return constantTimeEqual(payload.aud, audience);
  } catch {
    return false;
  }
}

function verifyPassword(submitted) {
  const expected = env("GATE_PASSWORD");
  if (!expected || typeof submitted !== "string" || submitted.length === 0) return false;
  return constantTimeEqual(submitted, expected);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false });
    return;
  }

  let body = request.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }

  const ok = body?.grant ? verifyGrant(body.grant) : verifyPassword(body?.password);

  // Same shape and similar timing for every rejection.
  if (!ok) await new Promise((r) => setTimeout(r, 300 + Math.random() * 150));

  response.status(ok ? 200 : 401).json(ok ? { ok, ttl: sessionSeconds() } : { ok });
}
