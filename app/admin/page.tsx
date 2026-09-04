import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { categoryLabel } from "@/lib/constants";
import PaperToggle from "@/components/admin/paper-toggle";
import UserOps from "@/components/admin/user-ops";
import SettingsForm from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "管理后台", robots: { index: false, follow: false } };
}

const TABS = [
  { key: "overview", label: "仪表盘" },
  { key: "papers", label: "试卷管理" },
  { key: "users", label: "用户管理" },
  { key: "settings", label: "站点设置" },
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const auth = await requireAdmin();
  if (auth.error) redirect(auth.error.status === 401 ? "/auth/login?next=/admin" : "/");
  const me = auth.user;

  const sp = await searchParams;
  const tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : "overview") as (typeof TABS)[number]["key"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">管理后台</h1>
        <nav className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin?tab=${t.key}`}
              className={`px-4 py-1.5 ${
                tab === t.key ? "bg-blue-600 text-white font-medium" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {tab === "overview" && <Overview />}
      {tab === "papers" && <Papers page={parseInt(sp.page ?? "1", 10) || 1} />}
      {tab === "users" && <Users page={parseInt(sp.page ?? "1", 10) || 1} currentUserId={me.id} />}
      {tab === "settings" && <Settings />}
    </div>
  );
}

async function Overview() {
  const [users, answers, attempts, papers, wrongOpen, favs] = await Promise.all([
    prisma.user.count(),
    prisma.answerLog.count(),
    prisma.paperAttempt.count({ where: { status: "SUBMITTED" } }),
    prisma.paper.count({ where: { published: true } }),
    prisma.wrongQuestion.count({ where: { masteredAt: null } }),
    prisma.favorite.count(),
  ]);
  const [totalPapers, recentUsers, recentAttempts] = await Promise.all([
    prisma.paper.count(),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { username: true, nickname: true, createdAt: true } }),
    prisma.paperAttempt.findMany({
      orderBy: { submittedAt: "desc" },
      take: 6,
      include: { user: { select: { username: true } }, paper: { select: { title: true } } },
    }),
  ]);

  const cards = [
    ["注册用户", users],
    ["累计作答", answers],
    ["整卷已交", attempts],
    ["上线试卷", `${papers}/${totalPapers}`],
    ["待攻克错题", wrongOpen],
    ["收藏总数", favs],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{v}</div>
            <div className="mt-1 text-xs text-gray-400">{k}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold mb-3">最近注册</h2>
          <div className="divide-y divide-gray-100">
            {recentUsers.map((u) => (
              <div key={u.username} className="flex justify-between py-2 text-sm">
                <span className="text-gray-700">{u.nickname || u.username}</span>
                <span className="text-xs text-gray-400">{u.createdAt.toLocaleString("zh-CN", { hour12: false })}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold mb-3">最近交卷</h2>
          <div className="divide-y divide-gray-100">
            {recentAttempts.map((a) => (
              <div key={a.id} className="flex justify-between gap-3 py-2 text-sm">
                <span className="text-gray-700 truncate">
                  {a.user.username} · {a.paper.title}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {a.earnedScore ?? "—"}分 · {a.submittedAt?.toLocaleString("zh-CN", { hour12: false })}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const PAPER_PAGE = 50;

async function Papers({ page }: { page: number }) {
  const [total, papers] = await Promise.all([
    prisma.paper.count(),
    prisma.paper.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAPER_PAGE,
      take: PAPER_PAGE,
      include: { _count: { select: { questions: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAPER_PAGE));

  return (
    <section className="space-y-3">
      <p className="text-xs text-gray-400">共 {total} 份试卷 · 下线后前台不可见（题库数据保留）</p>
      <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
        {papers.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50">
            <span
              className={`shrink-0 w-2 h-2 rounded-full ${p.published ? "bg-green-500" : "bg-gray-300"}`}
              title={p.published ? "已上线" : "已下线"}
            />
            <div className="flex-1 min-w-0">
              <Link href={`/paper/${p.slug}`} className="text-gray-800 hover:text-blue-600 truncate block">
                {p.title}
              </Link>
              <div className="text-[11px] text-gray-400">
                {categoryLabel(p.category)}
                {p.level ? ` ${p.level}级` : ""} · {p._count.questions} 题 · {p.examDate ?? "—"}
              </div>
            </div>
            <span className="text-xs text-gray-300 shrink-0">{p.slug}</span>
            <PaperToggle paperId={p.id} published={p.published} />
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex justify-center gap-2 pt-1 text-sm">
          {Array.from({ length: Math.min(pages, 6) }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/admin?tab=papers&page=${n}`}
              className={`px-3 py-1 rounded-md border ${
                n === page ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

const USER_PAGE = 50;

async function Users({ page, currentUserId }: { page: number; currentUserId: string }) {
  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USER_PAGE,
      take: USER_PAGE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / USER_PAGE));

  return (
    <section className="space-y-3">
      <p className="text-xs text-gray-400">共 {total} 个用户 · 禁用后该账号立即无法登录/交卷</p>
      <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50">
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-800">
                {u.nickname || u.username}
                {u.disabled && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-200">已禁用</span>}
                {u.role === "ADMIN" && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">管理员</span>}
              </span>
              <div className="text-[11px] text-gray-400">@{u.username} · 注册于 {u.createdAt.toLocaleDateString("zh-CN")}</div>
            </div>
            <UserOps
              userId={u.id}
              username={u.username}
              disabled={u.disabled}
              role={u.role}
              isSelf={u.id === currentUserId}
            />
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex justify-center gap-2 pt-1 text-sm">
          {Array.from({ length: Math.min(pages, 6) }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/admin?tab=users&page=${n}`}
              className={`px-3 py-1 rounded-md border ${
                n === page ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

async function Settings() {
  const rows = await prisma.adminSetting.findMany();
  const values: Record<string, string> = {};
  for (const r of rows) values[r.key] = r.value;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 max-w-xl">
      <SettingsForm values={values} />
    </section>
  );
}
