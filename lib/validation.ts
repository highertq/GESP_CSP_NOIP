import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "用户名至少 3 个字符")
    .max(20, "用户名最多 20 个字符")
    .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字、下划线"),
  password: z.string().min(6, "密码至少 6 位").max(72, "密码过长"),
  nickname: z.string().trim().max(20, "昵称过长").optional().or(z.literal("")),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
