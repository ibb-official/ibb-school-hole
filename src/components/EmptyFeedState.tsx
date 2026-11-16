import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function EmptyFeedState({
  activeCategoryName,
  hasSearchQuery,
  postingEnabled,
}: {
  activeCategoryName?: string;
  hasSearchQuery?: boolean;
  postingEnabled: boolean;
}) {
  return (
    <div className="surface-card empty-state-card">
      <div className="empty-icon-wrap">
        <ShieldCheck size={24} />
      </div>

      {hasSearchQuery ? (
        <>
          <h2 className="empty-title">没有匹配到相关帖子</h2>
          <p className="empty-desc">
            当前暂无符合筛选条件的公开主题帖。你可以清除搜索关键词返回全部讨论区，或查看社区安全与开放进度说明。
          </p>
          <div className="empty-actions">
            <Link href="/" className="btn btn-primary">
              返回全部讨论区
            </Link>
            <Link href="/rules" className="btn btn-secondary">
              阅读社区公约
            </Link>
          </div>
        </>
      ) : (
        <>
          <h2 className="empty-title">
            {activeCategoryName
              ? `「${activeCategoryName}」暂未发布任何帖子`
              : "论坛暂未产生任何公开帖子"}
          </h2>
          <p className="empty-desc">
            {postingEnabled
              ? "这里还没有公开讨论，欢迎发布第一篇帖子。"
              : "这里还没有公开讨论。发帖开放后，欢迎分享校园生活。"}
          </p>
          <div className="empty-actions">
            <Link href="/register" className="btn btn-primary">
              注册账号
            </Link>
            <Link href="/submit" className="btn btn-secondary">
              前往发帖
            </Link>
            <Link href="/about" className="btn btn-secondary">
              了解安全架构
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
