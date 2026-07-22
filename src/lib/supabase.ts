import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Clock-skew tolerance for JWT "issued at" rejections.
 *
 * The app itself never validates JWT `iat` claims (Auth.js session tokens
 * already get a 15s clockTolerance from @auth/core). The intermittent
 * "issued at future" failures come back from Supabase's side when its JWT
 * validation runs a few seconds behind the clock that minted the token; the
 * error then surfaces through data.ts's fail() wrapper, which is why traces
 * point there. Since the check happens on the server we call, the tolerance
 * window lives here at the single seam every query passes through: retry
 * briefly — total leeway a few seconds — when (and only when) the response
 * is that specific iat-in-the-future rejection. Anything else a JWT check
 * can reject (bad signature, wrong key, expired) does not match and still
 * fails on the first attempt.
 */
const IAT_SKEW_MAX_RETRIES = 3;
const IAT_SKEW_RETRY_DELAY_MS = 1500;

function isIatFutureRejection(status: number, body: string): boolean {
  return (
    (status === 401 || status === 403) &&
    /(issued.?at|\biat\b)/i.test(body) &&
    /future/i.test(body)
  );
}

/**
 * Re-issue the request with a per-attempt marker header. Without it, React's
 * per-render fetch memoization treats the retry as the identical request and
 * replays the cached 401 instead of hitting the network again.
 */
function retryAttempt(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  attempt: number
): Promise<Response> {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  );
  headers.set("x-iat-skew-retry", String(attempt));
  if (input instanceof Request) return fetch(new Request(input, { headers }), init);
  return fetch(input, { ...init, headers });
}

const fetchWithIatSkewTolerance: typeof fetch = async (input, init) => {
  let res = await fetch(input, init);
  for (let attempt = 1; attempt <= IAT_SKEW_MAX_RETRIES; attempt++) {
    if (res.ok) return res;
    const body = await res.clone().text().catch(() => "");
    if (!isIatFutureRejection(res.status, body)) return res;
    await new Promise((r) => setTimeout(r, IAT_SKEW_RETRY_DELAY_MS));
    res = await retryAttempt(input, init, attempt);
  }
  return res;
};

/**
 * Server-only Supabase client using the service role key. RLS is enabled on
 * every table with no policies, so this is the sole path to the data —
 * application-level authorization happens in the server layer before any
 * query runs. Never import this from client components.
 */
export function db(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithIatSkewTolerance },
  });
  return client;
}
