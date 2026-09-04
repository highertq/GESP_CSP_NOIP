import { NextResponse } from "next/server";

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonFail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** 校验失败等业务错误体 */
export function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
