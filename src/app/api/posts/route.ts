import { NextResponse, type NextRequest } from "next/server";
import { assertPostingEnabled } from "@/lib/forum-status";
import { getDb } from "@/lib/db";
import { createPost, listPosts, ServiceError } from "@/lib/forum-service";
import {
  assertCsrf,
  buildSecurityContext,
  handleApiError,
  parseJsonBody,
  requireAuthenticatedUser,
} from "@/lib/http";

export const dynamic = "force-dynamic";

interface CreatePostBody {
  categorySlug?: string;
  title?: string;
  content?: string;
  isAnonymous?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get("category") ?? "all";
    const sortParam = searchParams.get("sort");
    const sort = sortParam === "latest" ? "latest" : "active";
    const q = searchParams.get("q") ?? "";
    const limit = Number(searchParams.get("limit") ?? "20");
    const offset = Number(searchParams.get("offset") ?? "0");

    const result = listPosts(getDb(), {
      categorySlug,
      sort,
      q,
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return NextResponse.json({
      ok: true,
      items: result.items,
      total: result.total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertPostingEnabled();
    assertCsrf(request);
    const user = requireAuthenticatedUser(request);
    const body = await parseJsonBody<CreatePostBody>(request);
    if (typeof body.categorySlug !== "string" || typeof body.title !== "string" ||
        typeof body.content !== "string" ||
        (body.isAnonymous !== undefined && typeof body.isAnonymous !== "boolean")) {
      throw new ServiceError("INVALID_INPUT", 400, "帖子内容格式无效。");
    }
    const ctx = buildSecurityContext(request);

    const result = await createPost(
      getDb(),
      user,
      {
        categorySlug: body.categorySlug ?? "",
        title: body.title ?? "",
        content: body.content ?? "",
        isAnonymous: body.isAnonymous ?? false,
      },
      ctx
    );

    return NextResponse.json(
      {
        ok: true,
        post: result.post,
        moderationAction: result.moderationAction,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
