import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/password";
import { signSession, setSessionCookie } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { clearBlock, isBlocked, onLoginFailure } from "@/lib/ratelimit";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

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
  const ip = clientIp(req);
  const key = `login:${username}`;

  if (isBlocked(key)) {
    return jsonFail("失败次数过多，请 10 分钟后再试", 429);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    onLoginFailure(key);
    void ip;
    return jsonFail("用户名或密码错误", 401);
  }

  clearBlock(key);
  const token = await signSession({ uid: user.id, role: user.role });
  await setSessionCookie(token);

  return jsonOk({
    user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role },
  });
}
