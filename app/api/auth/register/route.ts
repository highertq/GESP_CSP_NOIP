import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { signSession, setSessionCookie } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { clientIp, hit, isBlocked, RULE_REGISTER_IP } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  // 同一 IP 注册数限制（此前完全裸奔，实测可连开 25 个账号）
  const ip = clientIp(req.headers);
  const ipKey = `register:ip:${ip}`;
  if (isBlocked(ipKey, RULE_REGISTER_IP)) {
    return jsonFail("注册过于频繁，请稍后再试", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonFail("请求体不是合法 JSON");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonFail(parsed.error.issues[0]?.message ?? "参数不合法", 400);
  }
  const { username, password, nickname } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return jsonFail("用户名已被占用，换一个试试", 409);

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      nickname: nickname || username,
    },
    select: { id: true, username: true, nickname: true, role: true, createdAt: true },
  });

  hit(ipKey, RULE_REGISTER_IP);

  const token = await signSession({ uid: user.id, role: user.role });
  await setSessionCookie(token);

  return jsonOk({ user }, { status: 201 });
}
