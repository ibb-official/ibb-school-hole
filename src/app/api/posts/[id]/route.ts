import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getPostDetail } from "@/lib/forum-service";
import { handleApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const postId = Number(id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "帖子不存在。" },
        { status: 404 }
      );
    }

    const detail = getPostDetail(getDb(), postId, { incrementView: true });
    if (!detail) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "帖子不存在或暂不可见。" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      post: detail.post,
      comments: detail.comments,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
