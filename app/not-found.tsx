import Link from "next/link";

export default function NotFound() {
  return (
    <div className="text-center py-24">
      <div className="text-5xl font-black text-gray-200">404</div>
      <p className="mt-3 text-gray-500 text-sm">页面不存在或试卷已下架</p>
      <Link href="/" className="inline-block mt-5 text-blue-600 text-sm">
        ← 返回首页
      </Link>
    </div>
  );
}
