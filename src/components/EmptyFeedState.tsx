import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function EmptyFeedState({
  activeCategoryName,
  hasSearchQuery,
}: {
  activeCategoryName?: string;
  hasSearchQuery?: boolean;
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
            当前处于一期架构部署阶段：数据库表结构、防爆破限流引擎、纯文本隐私过滤与匿名树洞 HMAC 隔离机制已全套就绪，账号与帖子表保持零数据状态。待人机验证与 AI 内容审核模块接入完成后，将正式开放学生自由注册与发帖。
          </p>
          <div className="empty-actions">
            <Link href="/register" className="btn btn-primary">
              预览注册页面
            </Link>
            <Link href="/submit" className="btn btn-secondary">
              预览发帖编辑器
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
