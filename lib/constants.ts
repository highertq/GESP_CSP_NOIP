export const CATEGORY_META: {
  value: string;
  label: string;
  short: string;
  levels?: string[];
}[] = [
  { value: "GESP", label: "GESP 认证", short: "GESP", levels: ["1", "2", "3", "4", "5", "6", "7", "8"] },
  { value: "CSP-J", label: "CSP-J 初赛", short: "CSP-J" },
  { value: "CSP-S", label: "CSP-S 初赛", short: "CSP-S" },
  { value: "NCT-C++", label: "NCT C++", short: "NCT C++" },
  { value: "NCT-KITTEN", label: "NCT Kitten", short: "NCT Kitten" },
  { value: "OTHER", label: "其他赛事", short: "其他" },
];

export function categoryLabel(value: string): string {
  return CATEGORY_META.find((c) => c.value === value)?.label ?? value;
}

export const QTYPE_LABEL: Record<string, string> = {
  CHOICE: "单选题",
  MULTI_CHOICE: "多选题",
  JUDGE: "判断题",
  FILL: "填空题",
  PROGRAM: "编程题",
};

export const EXAM_DATE_RE = /^(\d{4})-?(\d{2})?/;

/** 试卷标题缩写，如 "2024年6月 GESP 1级" */
export function paperShortTitle(p: { title: string }) {
  return p.title;
}
