import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/password";
import { signSession, setSessionCookie } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import {
  clientIp,
  clear,
  hit,
  isBlocked,
  RULE_LOGIN_IP,
  RULE_LOGIN_TARGET,
} from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonFail("请求体不是合法 JSON");
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonFail(parsed.error.issues[0]?.message ?? "参数不合法");

  const { username, password } = parsed.data;

  // 双维度限流：key 必须含 IP，否则攻击者可试错 N 次把真实用户锁死（账号锁定型 DoS）
  const ip = clientIp(req.headers);
  const ipKey = `login:ip:${ip}`;
  const targetKey = `login:${ip}:${username}`;

  if (isBlocked(ipKey, RULE_LOGIN_IP) || isBlocked(targetKey, RULE_LOGIN_TARGET)) {
    return jsonFail("尝试次数过多，请稍后再试", 429);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    // 用户名不存在同样计数，防止用登录接口枚举用户名
    hit(ipKey, RULE_LOGIN_IP);
    hit(targetKey, RULE_LOGIN_TARGET);
    return jsonFail("用户名或密码错误", 401);
  }
  if (user.disabled) {
    return jsonFail("该账号已被禁用，请联系管理员", 403);
  }

  // 登录成功即重置计数：真人永远不会被自己此前的失败挡住
  clear(ipKey);
  clear(targetKey);
  const token = await signSession({ uid: user.id, role: user.role });
  await setSessionCookie(token);

  return jsonOk({
    user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role },
  });
}
