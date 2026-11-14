import Link from "next/link";
import { DEFAULT_CATEGORIES, getCategoryBySlug } from "@/data/categories";
import { EmptyFeedState } from "@/components/EmptyFeedState";
import { PostCard } from "@/components/PostCard";
import { SystemStatusCard } from "@/components/SystemStatusCard";
import { getPublicSystemStatus } from "@/lib/config";
import { getDb } from "@/lib/db";
import { getForumStats, listPosts } from "@/lib/forum-service";

export const dynamic = "force-dynamic";

function buildFilterUrl(params: {
  category?: string;
  sort?: string;
  q?: string;
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
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const rawCategory = (sp.category ?? "all").trim();
  const activeCategory =
    rawCategory !== "all" ? getCategoryBySlug(rawCategory) : undefined;
  const activeCategorySlug = activeCategory ? activeCategory.slug : "all";
  const sort = sp.sort === "latest" ? "latest" : "active";
  const q = (sp.q ?? "").trim();

  const db = getDb();
  const status = getPublicSystemStatus();
  const stats = getForumStats(db);
  const feed = listPosts(db, {
    categorySlug: activeCategorySlug,
    sort,
    q,
    limit: 20,
    offset: 0,
  });

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
            />
          ) : (
            <div className="post-list">
              {feed.items.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>

        <SystemStatusCard status={status} stats={stats} />
      </div>
    </>
  );
}
