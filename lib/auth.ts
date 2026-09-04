import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE = "oj_token";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 天

export type SessionPayload = {
  uid: string;
  role: string;
};

function secretKey(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32 || s.startsWith("dev-only")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET 未配置或仍是弱密钥，生产环境拒绝启动");
    }
  }
  return new TextEncoder().encode(s || "dev-fallback-secret-do-not-use");
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.uid)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return { uid: String(payload.sub), role: String(payload.role ?? "USER") };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** 返回当前登录用户（含禁用检查），未登录返回 null */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user || user.disabled) return null;
  return user;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}
