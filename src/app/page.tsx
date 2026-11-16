import Link from "next/link";
import { DEFAULT_CATEGORIES, getCategoryBySlug } from "@/data/categories";
import { EmptyFeedState } from "@/components/EmptyFeedState";
import { PostCard } from "@/components/PostCard";
import { SystemStatusCard } from "@/components/SystemStatusCard";
import { getForumSystemStatus } from "@/lib/forum-status";
import { getDb } from "@/lib/db";
import { getForumStats, listPosts } from "@/lib/forum-service";

export const dynamic = "force-dynamic";

function buildFilterUrl(params: {
  category?: string;
  sort?: string;
  q?: string;
  page?: number;
}): string {
  const sp = new URLSearchParams();
  if (params.category && params.category !== "all") {
    sp.set("category", params.category);
  }
  if (params.sort && params.sort !== "active") {
    sp.set("sort", params.sort);
  }
  if (params.q && params.q.trim()) {
    sp.set("q", params.q.trim());
  }
  if (params.page && params.page > 1) {
    sp.set("page", String(params.page));
  }
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const rawCategory = (sp.category ?? "all").trim();
  const activeCategory =
    rawCategory !== "all" ? getCategoryBySlug(rawCategory) : undefined;
  const activeCategorySlug = activeCategory ? activeCategory.slug : "all";
  const sort = sp.sort === "latest" ? "latest" : "active";
  const q = (sp.q ?? "").trim();
  const pageParam = Number(sp.page ?? "1");
  const requestedPage = Number.isSafeInteger(pageParam) && pageParam > 0
    ? Math.min(pageParam, 1_000_000)
    : 1;
  const pageSize = 20;

  const db = getDb();
  const status = getForumSystemStatus();
  const stats = getForumStats(db);
  let page = requestedPage;
  let feed = listPosts(db, {
    categorySlug: activeCategorySlug,
    sort,
    q,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const totalPages = Math.max(1, Math.ceil(feed.total / pageSize));
  if (page > totalPages) {
    page = totalPages;
    feed = listPosts(db, {
      categorySlug: activeCategorySlug,
      sort,
      q,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }

  return (
    <>
      <div className="mobile-category-strip" aria-label="板块快速切换">
        <Link
          href={buildFilterUrl({ category: "all", sort, q })}
          className={`mobile-pill ${
            activeCategorySlug === "all" ? "mobile-pill-active" : ""
          }`}
        >
          全部讨论
        </Link>
        {DEFAULT_CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={buildFilterUrl({ category: cat.slug, sort, q })}
            className={`mobile-pill ${
              activeCategorySlug === cat.slug ? "mobile-pill-active" : ""
            }`}
          >
            <span
              className="cat-dot"
              style={{ backgroundColor: cat.accentColor }}
              aria-hidden="true"
            />
            {cat.name}
          </Link>
        ))}
      </div>

      <div className="forum-shell">
        <aside className="sidebar-left" aria-label="论坛板块目录">
          <div className="surface-card panel-card" style={{ padding: "12px 8px" }}>
            <div className="sidebar-section-title">讨论板块</div>
            <div className="category-list">
              <Link
                href={buildFilterUrl({ category: "all", sort, q })}
                className={`category-item ${
                  activeCategorySlug === "all" ? "category-item-active" : ""
                }`}
              >
                <span className="category-item-left">
                  <span
                    className="cat-dot"
                    style={{ backgroundColor: "#0F172A" }}
                    aria-hidden="true"
                  />
                  <span>全部讨论</span>
                </span>
                <span className="cat-count tabular-nums">{stats.postCount}</span>
              </Link>

              {DEFAULT_CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={buildFilterUrl({ category: cat.slug, sort, q })}
                  className={`category-item ${
                    activeCategorySlug === cat.slug ? "category-item-active" : ""
                  }`}
                >
                  <span className="category-item-left">
                    <span
                      className="cat-dot"
                      style={{ backgroundColor: cat.accentColor }}
                      aria-hidden="true"
                    />
                    <span>{cat.name}</span>
                  </span>
                  <span className="cat-count tabular-nums">
                    {stats.categoryCounts[cat.slug] ?? 0}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <section className="feed-column" aria-label="帖子信息流">
          <div className="surface-card feed-toolbar">
            <div>
              <h1 className="feed-heading-title">
                {activeCategory ? activeCategory.name : "全部讨论区"}
              </h1>
              <p className="feed-heading-desc">
                {q
                  ? `搜索关键词「${q}」共 ${feed.total} 条结果`
                  : activeCategory
                    ? activeCategory.description
                    : "纯文本分段交流空间，内含「匿名树洞」防开盒隔离板块"}
              </p>
            </div>

            <div className="sort-tabs" role="tablist" aria-label="排序方式">
              <Link
                href={buildFilterUrl({
                  category: activeCategorySlug,
                  sort: "active",
                  q,
                })}
                className={`sort-tab ${sort === "active" ? "sort-tab-active" : ""}`}
              >
                最新活跃
              </Link>
              <Link
                href={buildFilterUrl({
                  category: activeCategorySlug,
                  sort: "latest",
                  q,
                })}
                className={`sort-tab ${sort === "latest" ? "sort-tab-active" : ""}`}
              >
                最新发布
              </Link>
            </div>
          </div>

          {feed.items.length === 0 ? (
            <EmptyFeedState
              activeCategoryName={activeCategory?.name}
              hasSearchQuery={Boolean(q)}
              postingEnabled={status.postingEnabled}
            />
          ) : (
            <div className="post-list">
              {feed.items.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <nav className="feed-pagination" aria-label="帖子分页">
              {page > 1 ? (
                <Link className="btn btn-secondary" href={buildFilterUrl({ category: activeCategorySlug, sort, q, page: page - 1 })}>
                  上一页
                </Link>
              ) : <span className="btn btn-secondary" aria-disabled="true">上一页</span>}
              <span className="tabular-nums">第 {page} / {totalPages} 页</span>
              {page < totalPages ? (
                <Link className="btn btn-secondary" href={buildFilterUrl({ category: activeCategorySlug, sort, q, page: page + 1 })}>
                  下一页
                </Link>
              ) : <span className="btn btn-secondary" aria-disabled="true">下一页</span>}
            </nav>
          )}
        </section>

        <SystemStatusCard status={status} stats={stats} />
      </div>
    </>
  );
}
