import { getCurrentUser } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonFail("未登录", 401);
  return jsonOk({
    user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role },
  });
}
