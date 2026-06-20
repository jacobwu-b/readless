import { config } from "./env";
import { keys, incr, expire, type CounterClient } from "./kv";

/**
 * Per-IP + global daily rate limiting on `POST /api/generate` (spec 0005, ADR-0003).
 *
 * Both limits are fixed-window counters keyed per UTC day on KV: a per-IP counter
 * throttles a single client, and a global counter is the real spend backstop — once
 * it reaches the configured ceiling, generation is hard-blocked for the rest of the
 * day. Each counter is `incr`'d per request and given a TTL on the first hit so the
 * window self-expires; the date-stamped key means a new day always starts fresh.
 *
 * Header-derived IPs are spoofable; defeating that is out of scope (spec 0005).
 */

const SECONDS_PER_DAY = 24 * 60 * 60;

/** The UTC calendar day of `now`, as `yyyy-mm-dd` — the window key suffix. */
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Whole seconds remaining until the next UTC midnight — the counter's TTL and Retry-After. */
function secondsUntilUtcMidnight(now: Date): number {
  const elapsed =
    now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  return SECONDS_PER_DAY - elapsed;
}

/** Outcome of an enforcement check. `retryAfter`/`reason` are set only when blocked. */
export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying — surfaced as the `Retry-After` header. */
  retryAfter?: number;
  /** Which limit blocked the request, for the right caller-facing message. */
  reason?: "per-ip" | "global";
}

export interface EnforceOptions {
  client?: CounterClient;
  /** Injectable clock; defaults to now. Tests pin it for deterministic day-keying. */
  now?: Date;
  ipPerDay?: number;
  globalPerDay?: number;
}

/**
 * Increment a daily-window counter, arming its TTL on the window's first hit, and
 * report whether the new count is still within `limit`.
 */
async function hitDailyCounter(
  key: string,
  limit: number,
  ttl: number,
  client: CounterClient | undefined
): Promise<boolean> {
  const count = await incr(key, client);
  if (count === 1) {
    await expire(key, ttl, client);
  }
  return count <= limit;
}

/**
 * Apply the per-IP then global daily limits for one request. The per-IP counter is
 * checked first; if it blocks, the global counter is left untouched. A `false`
 * `allowed` means the caller must reject with `429` + `Retry-After`.
 */
export async function enforceRateLimit(
  ip: string,
  opts: EnforceOptions = {}
): Promise<RateLimitResult> {
  const now = opts.now ?? new Date();
  const ipPerDay = opts.ipPerDay ?? config.RATE_LIMIT_IP_PER_DAY;
  const globalPerDay = opts.globalPerDay ?? config.RATE_LIMIT_GLOBAL_PER_DAY;

  const day = utcDay(now);
  const ttl = secondsUntilUtcMidnight(now);

  const underIpLimit = await hitDailyCounter(keys.rlIp(ip, day), ipPerDay, ttl, opts.client);
  if (!underIpLimit) {
    return { allowed: false, retryAfter: ttl, reason: "per-ip" };
  }

  const underGlobalLimit = await hitDailyCounter(
    keys.rlGlobal(day),
    globalPerDay,
    ttl,
    opts.client
  );
  if (!underGlobalLimit) {
    return { allowed: false, retryAfter: ttl, reason: "global" };
  }

  return { allowed: true };
}

/** The minimal request shape `clientIp` reads — just the forwarding headers. */
type IpHeaders = { headers: Record<string, string | string[] | undefined> };

/**
 * Best-effort client IP from the platform's forwarding headers: the first hop of
 * `X-Forwarded-For`, else `X-Real-IP`, else a stable placeholder so a missing header
 * shares one bucket rather than bypassing the limit. Spoofable by design (spec 0005).
 */
export function clientIp(req: IpHeaders): string {
  const forwarded = req.headers["x-forwarded-for"];
  const firstHop = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  if (firstHop) {
    return firstHop;
  }

  const realIp = req.headers["x-real-ip"];
  const real = (Array.isArray(realIp) ? realIp[0] : realIp)?.trim();
  return real || "unknown";
}
