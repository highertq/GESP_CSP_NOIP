import { getCurrentUser } from "@/lib/auth";

/** 管理端守卫：返回 { user } 或 { error } */
export async function requireAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; error: null }
  | { user: null; error: { status: number; message: string } }
> {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: { status: 401, message: "请先登录" } };
  if (user.role !== "ADMIN") return { user: null, error: { status: 403, message: "无管理权限" } };
  return { user, error: null };
}
