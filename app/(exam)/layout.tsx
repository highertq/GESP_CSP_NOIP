// 全屏考试布局：无站点导航/页脚，做题页独占视口（隐藏 header/footer）
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col bg-canvas">{children}</div>;
}
