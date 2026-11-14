import { NextResponse, type NextRequest } from "next/server";
import { assertFeatureEnabled } from "@/lib/config";
import { getDb } from "@/lib/db";
import { createComment } from "@/lib/forum-service";
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
    assertFeatureEnabled("posting");
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
    const ctx = buildSecurityContext(request);
    const result = await createComment(
      getDb(),
      user,
      postId,
      {
        content: body.content ?? "",
        isAnonymous: Boolean(body.isAnonymous),
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
