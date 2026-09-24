// 内存滑窗限流（单机够用；多实例部署时换 Redis）
//
// 设计要点（修复账号锁定型 DoS）：
//   1. key 必须包含客户端 IP —— 只按用户名分桶会导致"攻击者试错 N 次把真实用户锁死"，
//      同时密码喷洒（每个用户名试几次）完全不限。key 含 IP 后，锁定退化为"攻击源被锁"，
//      真实用户从自己网络登录不受影响。
//   2. 登录成功必须 clear —— 真人输对密码即重置计数，任何情况下不能被自己的历史失败挡住。
//   3. 双维度：IP 桶拦总量爆破，IP+用户名桶拦定向撞库。

type Rule = { windowMs: number; max: number };

/** 同一 IP 的登录尝试总量（宽，避免校园/公司共享出口误伤） */
export const RULE_LOGIN_IP: Rule = { windowMs: 10 * 60 * 1000, max: 30 };
/** 同一 IP 对同一用户名的定向尝试（严） */
export const RULE_LOGIN_TARGET: Rule = { windowMs: 10 * 60 * 1000, max: 8 };
/** 同一 IP 的注册数（防批量注册） */
export const RULE_REGISTER_IP: Rule = { windowMs: 60 * 60 * 1000, max: 10 };

const buckets = new Map<string, number[]>();

/** 桶数量上限，超出时清理最久未活动的桶，防止内存无界增长 */
const MAX_BUCKETS = 5000;

function prune(key: string, windowMs: number): number[] {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length === 0) buckets.delete(key);
  else buckets.set(key, arr);
  return arr;
}

function evictIfNeeded() {
  if (buckets.size <= MAX_BUCKETS) return;
  // Map 保持插入顺序，删除最早插入的一批
  const excess = buckets.size - MAX_BUCKETS;
  let n = 0;
  for (const k of buckets.keys()) {
    if (n++ >= excess) break;
    buckets.delete(k);
  }
}

/** 记录一次行为 */
export function hit(key: string, rule: Rule): void {
  const arr = prune(key, rule.windowMs);
  arr.push(Date.now());
  buckets.set(key, arr);
  evictIfNeeded();
}

/** 该 key 是否已触发限流 */
export function isBlocked(key: string, rule: Rule): boolean {
  return prune(key, rule.windowMs).length >= rule.max;
}

/** 查询剩余可用次数（用于提示） */
export function remaining(key: string, rule: Rule): number {
  return Math.max(0, rule.max - prune(key, rule.windowMs).length);
}

/** 清除计数（登录成功时调用） */
export function clear(key: string): void {
  buckets.delete(key);
}

/**
 * 取客户端 IP。
 * 生产部署在 Nginx 反代后：x-forwarded-for 可被客户端伪造追加，
 * 因此优先信任 Nginx 显式写入的 X-Real-IP（需在 Nginx 配置
 * `proxy_set_header X-Real-IP $remote_addr;`）。
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // 取最左侧（Nginx 追加模式下为真实客户端 IP）
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
