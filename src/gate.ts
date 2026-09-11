/**
 * Client gate for the Vite apps. Copied verbatim — do not edit per-app.
 *
 * Integration (src/main.tsx):
 *   import ensureUnlocked from "./gate";
 *   await ensureUnlocked();          // top-level await; Vite ships ESM
 *   createRoot(el).render(<App />);
 *
 * Awaiting before mount means React never renders and the app's own fetches and
 * audio never start while the lock screen is up.
 *
 * Unlock is per-tab (sessionStorage): survives reload and back/forward, but a new
 * tab, a bookmark or a pasted link prompts again.
 */

const KEY = "pu_gate_v2"; // v2 stores an expiry, not a bare flag
const OVERLAY_ID = "pu-gate";

const CSS = `
#${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;
justify-content:center;background:#0f0d12;
font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#${OVERLAY_ID} form{display:flex;flex-direction:column;align-items:center;gap:18px;padding:24px}
#${OVERLAY_ID} input{width:min(78vw,320px);padding:14px 16px;border-radius:2px;
border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.05);color:#f2ece4;
font-size:17px;letter-spacing:.28em;text-align:center;outline:none}
#${OVERLAY_ID} input:focus{border-color:rgba(255,255,255,.5)}
#${OVERLAY_ID} button{background:none;border:0;border-top:1px solid rgba(255,255,255,.25);
padding-top:14px;color:#cbbfae;font-size:11px;letter-spacing:.35em;text-transform:uppercase;cursor:pointer}
#${OVERLAY_ID} button[disabled]{opacity:.4;cursor:default}
#${OVERLAY_ID} p{min-height:18px;margin:0;color:#c98d93;font-size:13px;font-style:italic;
opacity:0;transition:opacity .3s}
#${OVERLAY_ID} p.on{opacity:1}`;

// sessionStorage throws outright in some embedded/private contexts.
//
// The value is an absolute expiry, matching the dashboard's session window, so the
// tab does not stay unlocked for its whole lifetime. Checked on load only — exactly
// like the dashboard cookie, which is inspected per request and never yanks a page
// out from under someone already looking at it.
function remembered(): boolean {
  try {
    const until = parseInt(window.sessionStorage.getItem(KEY) ?? "", 10);
    return Boolean(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function remember(ttlSeconds?: number): void {
  try {
    const secs = ttlSeconds && ttlSeconds > 0 ? ttlSeconds : 600;
    window.sessionStorage.setItem(KEY, String(Date.now() + secs * 1000));
  } catch {
    /* fine — they re-enter on the next load */
  }
}


// Re-lock the moment the window closes, rather than waiting for a refresh.
// Timers are throttled in background tabs, so also re-check whenever the tab
// becomes visible or focused, and on a slow interval as a backstop.
let armed = false;
function armExpiry(): void {
  if (armed) return;
  let until: number;
  try {
    until = parseInt(window.sessionStorage.getItem(KEY) ?? "", 10);
  } catch {
    return;
  }
  if (!until) return;
  armed = true;
  const check = () => {
    if (Date.now() < until) return;
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      /* reload re-prompts either way: the stored value is already expired */
    }
    window.location.reload();
  };
  setTimeout(check, Math.max(0, until - Date.now()) + 250);
  setInterval(check, 15000);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
}

type GateResult = { ok: boolean; ttl?: number };

async function post(payload: Record<string, string>): Promise<GateResult> {
  try {
    const response = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({ ok: false }));
    return data?.ok === true ? (data as GateResult) : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Remove ?g= before anything renders: keeps it out of the address bar, bookmarks,
 *  document.referrer, and the back-button entry. */
function stripGrant(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("g")) return;
    url.searchParams.delete("g");
    window.history.replaceState({}, "", url.toString());
  } catch {
    /* non-fatal */
  }
}

function promptForPassword(): Promise<void> {
  return new Promise((resolve) => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <form novalidate>
        <input type="password" name="password" autocomplete="off" autocapitalize="off"
               autocorrect="off" spellcheck="false" aria-label="Password">
        <button type="submit">Enter</button>
        <p role="status" aria-live="polite">That isn't it.</p>
      </form>`;
    document.body.appendChild(overlay);

    const form = overlay.querySelector("form")!;
    const input = overlay.querySelector("input")!;
    const button = overlay.querySelector("button")!;
    const message = overlay.querySelector("p")!;
    input.focus();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      // Read from the DOM, not a cached value: a password manager can fill the
      // field without firing input events.
      const value = input.value ?? "";
      if (button.disabled || value.length === 0) return;

      button.disabled = true;
      message.classList.remove("on");

      const result = await post({ password: value });
      if (result.ok) {
        overlay.remove();
        style.remove();
        remember(result.ttl);
        resolve();
        return;
      }

      input.value = "";
      message.classList.add("on");
      setTimeout(() => {
        button.disabled = false;
        input.focus();
      }, 800);
    });
  });
}

export default async function ensureUnlocked(): Promise<void> {
  await unlock();
  armExpiry();
}

async function unlock(): Promise<void> {
  if (remembered()) return;

  let grant: string | null = null;
  try {
    grant = new URL(window.location.href).searchParams.get("g");
  } catch {
    /* ignore */
  }

  if (grant) {
    const result = await post({ grant });
    stripGrant();
    if (result.ok) {
      remember(result.ttl);
      return;
    }
  }

  await promptForPassword();
}
