// 洛谷映射生成器（一次性）
// 输入：/tmp/gesp-program.txt（psql 导出：qid|卷title|cat|level|seq|试题名称行）
//      scripts/data/luogu-{551..558}.json（agent-browser 抓的官方训练场题目）
// 匹配键：年月(YYYYMM) + 级别 + 题目名（去掉名称里的空格差异后比对）
// 输出：scripts/data/gesp-luogu-map.json —— { questionId: "B1234" }（仅真题卷 PROGRAM 题）
import fs from "node:fs";

const LV_CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8 };

// 1. 读洛谷训练场
const luogu = [];
for (let id = 551; id <= 558; id++) {
  const arr = JSON.parse(fs.readFileSync(`scripts/data/luogu-${id}.json`, "utf8"));
  for (const it of arr) {
    const m = it.text.match(/^\[GESP(\d{6})\s*([一二三四五六七八])级\]\s*(.+)$/);
    if (!m) continue;
    luogu.push({
      problem: it.href.replace("/problem/", ""),
      ym: m[1],
      level: LV_CN[m[2]],
      name: m[3].replace(/\s+/g, ""),
    });
  }
}
console.log("洛谷真题题单条目:", luogu.length);

// 2. 读本地 GESP PROGRAM 题
const lines = fs.readFileSync("/tmp/gesp-program.txt", "utf8").trim().split("\n");
const local = [];
for (const ln of lines) {
  const [qid, title, cat, level, seq, nameLine] = ln.split("|");
  if (!qid || cat !== "GESP") continue;
  const ym = title.match(/^(\d{4})年(\d{1,2})月/);
  if (!ym) continue;
  const name = (nameLine || "").replace(/^试题名称：/, "").trim().replace(/\s+/g, "");
  local.push({ qid, title, level, ym: `${ym[1]}${ym[2].padStart(2, "0")}`, seq, name });
}
console.log("本地 GESP 编程题:", local.length);

// 3. 匹配
const byKey = new Map();
for (const l of luogu) byKey.set(`${l.ym}|${l.level}|${l.name}`, l.problem);

const map = {};
let hit = 0;
const miss = [];
for (const q of local) {
  const key = `${q.ym}|${q.level}|${q.name}`;
  const pid = byKey.get(key);
  if (pid) {
    map[q.qid] = pid;
    hit++;
  } else {
    miss.push(`${q.title} #${q.seq} ${q.name} (${q.ym} L${q.level})`);
  }
}
console.log("匹配成功:", hit, " 未匹配:", miss.length);
if (miss.length) {
  console.log("--- 未匹配清单 ---");
  for (const m of miss.slice(0, 60)) console.log("  ", m);
}

fs.writeFileSync("scripts/data/gesp-luogu-map.json", JSON.stringify(map, null, 0));
console.log("已写 scripts/data/gesp-luogu-map.json,", Object.keys(map).length, "条");
