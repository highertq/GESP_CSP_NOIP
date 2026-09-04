// 极简内存限流：登录失败计数防爆破（单机够用；多实例部署时换 Redis）
const buckets = new Map<string, { fails: number; resetAt: number }>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 8;

export function isBlocked(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) return false;
  return b.fails >= MAX_FAILS;
}

export function onLoginFailure(key: string) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) buckets.set(key, { fails: 1, resetAt: now + WINDOW_MS });
  else b.fails += 1;
}

export function clearBlock(key: string) {
  buckets.delete(key);
}
