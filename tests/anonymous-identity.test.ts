import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAnonymousAliases,
  deriveAnonymousAlias,
  serializeCommentDto,
  type CommentRowForDto,
} from "../src/lib/anonymous";

const comment: CommentRowForDto = {
  id: 1,
  post_id: 42,
  author_id: 7,
  author_username: "ExampleUser",
  floor_no: 1,
  reply_to_comment_id: null,
  content: "测试回复",
  is_anonymous: 0,
  moderation_status: "published",
  created_at: 100,
};

describe("anonymous identity boundaries", () => {
  it("does not link a named reply to an anonymous post author", () => {
    const result = serializeCommentDto(comment, 7, true);
    assert.equal(result.authorUsername, "ExampleUser");
    assert.equal(result.isPostAuthor, false);
  });

  it("does not reveal an anonymous reply to a named post is from its author", () => {
    const result = serializeCommentDto({ ...comment, is_anonymous: 1 }, 7, false);
    assert.equal(result.authorUsername, null);
    assert.equal(result.authorId, null);
    assert.equal(result.isPostAuthor, false);
    assert.match(result.authorDisplayName, /^匿名同学 #[A-F0-9]{12,}$/);
  });

  it("keeps the author badge when the post and reply use the same identity", () => {
    assert.equal(serializeCommentDto(comment, 7, false).isPostAuthor, true);
    const result = serializeCommentDto({ ...comment, is_anonymous: 1 }, 7, true);
    assert.equal(result.isPostAuthor, true);
    assert.equal(result.authorDisplayName, "洞主");
  });

  it("extends a colliding alias and keeps repeat participants stable", () => {
    const first = deriveAnonymousAlias(42, 8, 7, true);
    const collision = deriveAnonymousAlias(42, 8, 7, true, new Set([first]));
    assert.notEqual(collision, first);
    assert.ok(collision.startsWith(first));
    const aliases = buildAnonymousAliases(42, 7, true, [8, 9, 8]);
    assert.equal(aliases.size, 2);
    assert.notEqual(aliases.get(8), aliases.get(9));
  });
});
