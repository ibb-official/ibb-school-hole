import crypto from "node:crypto";
import { getRuntimeConfig } from "@/lib/config";

export interface PostRowForDto {
  id: number;
  category_slug: string;
  category_name: string;
  category_accent: string;
  author_id: number;
  author_username: string;
  title: string;
  content: string;
  is_anonymous: number;
  moderation_status: string;
  view_count: number;
  comment_count: number;
  is_pinned: number;
  created_at: number;
  updated_at: number;
  last_comment_at: number;
}

export interface CommentRowForDto {
  id: number;
  post_id: number;
  author_id: number;
  author_username: string;
  floor_no: number;
  reply_to_comment_id: number | null;
  content: string;
  is_anonymous: number;
  moderation_status: string;
  created_at: number;
}

export interface PublicPostDto {
  id: number;
  categorySlug: string;
  categoryName: string;
  categoryAccent: string;
  authorId: number | null;
  authorUsername: string | null;
  authorDisplayName: string;
  isAnonymous: boolean;
  title: string;
  content: string;
  moderationStatus: string;
  viewCount: number;
  commentCount: number;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
  lastCommentAt: number;
}

export interface PublicCommentDto {
  id: number;
  postId: number;
  authorId: number | null;
  authorUsername: string | null;
  authorDisplayName: string;
  isAnonymous: boolean;
  isPostAuthor: boolean;
  floorNo: number;
  replyToCommentId: number | null;
  content: string;
  moderationStatus: string;
  createdAt: number;
}

/**
 * 为同一主题帖内的匿名参与方派生恒定且跨帖互不关联的代号：
 * - 帖子作者恒为 "洞主"
 * - 其余匿名评论者使用 HMAC-SHA256(postId:authorId) 生成 "匿名同学 #XXXX"
 */
export function deriveAnonymousAlias(
  postId: number,
  authorId: number,
  postAuthorId: number
): string {
  if (authorId === postAuthorId) {
    return "洞主";
  }
  const secret = getRuntimeConfig().anonymousHmacSecret;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`post:${postId}:author:${authorId}`)
    .digest("hex");
  return `匿名同学 #${digest.slice(0, 4).toUpperCase()}`;
}

export function serializePostDto(row: PostRowForDto): PublicPostDto {
  const isAnonymous = row.is_anonymous === 1;
  return {
    id: row.id,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    categoryAccent: row.category_accent,
    authorId: isAnonymous ? null : row.author_id,
    authorUsername: isAnonymous ? null : row.author_username,
    authorDisplayName: isAnonymous ? "洞主" : row.author_username,
    isAnonymous,
    title: row.title,
    content: row.content,
    moderationStatus: row.moderation_status,
    viewCount: row.view_count,
    commentCount: row.comment_count,
    isPinned: row.is_pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastCommentAt: row.last_comment_at,
  };
}

export function serializeCommentDto(
  row: CommentRowForDto,
  postAuthorId: number
): PublicCommentDto {
  const isAnonymous = row.is_anonymous === 1;
  const isPostAuthor = row.author_id === postAuthorId;
  return {
    id: row.id,
    postId: row.post_id,
    authorId: isAnonymous ? null : row.author_id,
    authorUsername: isAnonymous ? null : row.author_username,
    authorDisplayName: isAnonymous
      ? deriveAnonymousAlias(row.post_id, row.author_id, postAuthorId)
      : row.author_username,
    isAnonymous,
    isPostAuthor,
    floorNo: row.floor_no,
    replyToCommentId: row.reply_to_comment_id,
    content: row.content,
    moderationStatus: row.moderation_status,
    createdAt: row.created_at,
  };
}
