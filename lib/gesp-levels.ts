// GESP C++ 方向各级别考纲要点与页面文案（用于 /gesp/level-N 承接页）
// 考纲描述为通用概括，如与 CCF 最新考纲不一致，以官方发布为准。

export type GespLevel = {
  level: number;
  title: string; // 页面 H1 用
  audience: string;
  points: string[];
  intro: string; // 页面顶部导语
};

export const GESP_LEVELS: GespLevel[] = [
  {
    level: 1,
    title: "GESP 一级",
    audience: "零基础起步，适合小学低年级~小学高年级刚接触 C++ 的学生",
    points: ["计算机发展史与基础知识", "变量、常量与数据类型", "输入输出语句", "顺序结构程序设计"],
    intro:
      "GESP 一级是编程能力等级认证的入门级别，考察计算机基础知识和 C++ 顺序结构编程。历年一级真题以概念题和简单读程序题为主，是少儿编程考级的第一步。",
  },
  {
    level: 2,
    title: "GESP 二级",
    audience: "已掌握一级内容，开始学习流程控制的学生",
    points: ["分支结构 if/else", "循环结构 for/while", "数制与进制转换", "位运算初步"],
    intro:
      "GESP 二级重点考察分支与循环结构，真题中「读程序写结果」类题目占比较高，是巩固语法基础的关键级别。",
  },
  {
    level: 3,
    title: "GESP 三级",
    audience: "语法基础扎实，进入数据处理阶段的学生",
    points: ["数据位处理", "数组与字符串", "数位分离与枚举", "简单排序思想"],
    intro:
      "GESP 三级开始引入数组与字符串处理，题目综合性明显上升。刷透历年三级真题是通过四级之前最重要的一步。",
  },
  {
    level: 4,
    title: "GESP 四级",
    audience: "具备完整语法能力，向算法过渡的学生",
    points: ["函数与参数传递", "递归与递推", "结构体", "指针与引用初步"],
    intro:
      "GESP 四级引入函数、递归与结构体，是从「会写代码」迈向「会设计程序」的分水岭。四级真题中的递归题是历年高频考点。",
  },
  {
    level: 5,
    title: "GESP 五级",
    audience: "进入算法学习阶段的学生",
    points: ["链表", "初等数论（素数、gcd/lcm、同余）", "排序算法（冒泡、插入、选择等）", "算法复杂度分析"],
    intro:
      "GESP 五级考察链表、数论与经典排序算法。快速排序等排序算法的原理与复杂度是五级真题的常客，建议配合本站真题反复练习。",
  },
  {
    level: 6,
    title: "GESP 六级",
    audience: "掌握基础数据结构，学习经典算法的学生",
    points: ["队列与栈", "二叉树基础", "递推与贪心", "二分查找"],
    intro:
      "GESP 六级系统考察栈、队列、二叉树等数据结构及贪心、二分等基础算法，是初赛客观题题量最大的级别之一。",
  },
  {
    level: 7,
    title: "GESP 七级",
    audience: "向 CSP-J/S 过渡的学生",
    points: ["树与图的遍历", "深度/广度优先搜索", "动态规划入门", "哈希表"],
    intro:
      "GESP 七级内容与 CSP-J 初赛高度重合，搜索与动态规划入门是核心考点。通过七级意味着具备了冲击 CSP-J 的算法基础。",
  },
  {
    level: 8,
    title: "GESP 八级",
    audience: "备考 GESP 最高级别、瞄准 CSP-S 的学生",
    points: ["动态规划进阶", "图论算法（最短路、最小生成树）", "高级数据结构", "综合算法设计"],
    intro:
      "GESP 八级是 C++ 方向最高级别，通过后可衔接 CSP-J/S 认证。考察动态规划、图论等综合算法，历年八级真题客观题部分可在本站免费在线模拟。",
  },
];

export function getGespLevel(level: number): GespLevel | undefined {
  return GESP_LEVELS.find((l) => l.level === level);
}
