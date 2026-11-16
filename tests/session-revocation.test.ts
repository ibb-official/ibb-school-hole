import assert from "node:assert/strict";
import { it } from "node:test";
import { NextRequest } from "next/server";
import { createMemoryDatabase, setDbForTesting } from "../src/lib/db";
import { hashSessionToken } from "../src/lib/forum-service";
import { POST } from "../src/app/api/moderation/route";

it("rejects a moderation request if its session is revoked while its body is arriving", async () => {
  const db = createMemoryDatabase();
  setDbForTesting(db);
  const now = Date.now();
  const token = "moderator-token".padEnd(64, "x");
  db.prepare("INSERT INTO users (id,username,username_normalized,password_hash,role,status,created_at,updated_at) VALUES (1,'Reviewer','reviewer','hash','moderator','active',?,?), (2,'Writer','writer','hash','user','active',?,?)").run(now, now, now, now);
  db.prepare("INSERT INTO sessions (id,user_id,token_hash,ip_hash,user_agent_hash,expires_at,created_at) VALUES ('session',1,?,'ip','ua',?,?)")
    .run(hashSessionToken(token), now + 60_000, now);
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
  const request = new NextRequest("http://localhost/api/moderation", {
    method: "POST",
    headers: { host: "localhost", origin: "http://localhost", cookie: `ibb_hole_session=${token}`, "x-requested-with": "ibb-hole-web", "content-type": "application/json" },
    body,
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
  try {
    const pending = POST(request);
    await new Promise<void>((resolve) => setImmediate(resolve));
    db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = 'session'").run(Date.now());
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ action: "suspend_user", targetId: 2 })));
    controller.close();
    const response = await pending;
    assert.equal(response.status, 401);
    assert.equal((db.prepare("SELECT status FROM users WHERE id = 2").get() as { status: string }).status, "active");
  } finally {
    setDbForTesting(null);
    db.close();
  }
});
