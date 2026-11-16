import { NextResponse, type NextRequest } from "next/server";
import { assertPostingEnabled } from "@/lib/forum-status";
import { getDb } from "@/lib/db";
import { createComment, ServiceError } from "@/lib/forum-service";
import {
  assertCsrf,
  buildSecurityContext,
  handleApiError,
  parseJsonBody,
  requireAuthenticatedUser,
} from "@/lib/http";

export const dynamic = "force-dynamic";

interface CreateCommentBody {
  content?: string;
  isAnonymous?: boolean;
  replyToCommentId?: number | null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertPostingEnabled();
    assertCsrf(request);
    const user = requireAuthenticatedUser(request);
    const { id } = await context.params;
    const postId = Number(id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json(
        { ok: false, code: "INVALID_POST_ID", message: "帖子编号无效。" },
        { status: 400 }
      );
    }

    const body = await parseJsonBody<CreateCommentBody>(request);
    if (typeof body.content !== "string" ||
        (body.isAnonymous !== undefined && typeof body.isAnonymous !== "boolean") ||
        (body.replyToCommentId != null && (!Number.isSafeInteger(body.replyToCommentId) || body.replyToCommentId <= 0))) {
      throw new ServiceError("INVALID_INPUT", 400, "回复内容格式无效。");
    }
    const ctx = buildSecurityContext(request);
    const result = await createComment(
      getDb(),
      user,
      postId,
      {
        content: body.content ?? "",
        isAnonymous: body.isAnonymous ?? false,
        replyToCommentId: body.replyToCommentId ?? null,
      },
      ctx
    );

    return NextResponse.json(
      {
        ok: true,
        comment: result.comment,
        moderationAction: result.moderationAction,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
