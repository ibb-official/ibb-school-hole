import type { Metadata } from "next";
import { SubmitPostForm } from "@/components/SubmitPostForm";
import { getForumSystemStatus } from "@/lib/forum-status";

export const metadata: Metadata = {
  title: "发布帖子",
};

export const dynamic = "force-dynamic";

export default function SubmitPage() {
  const status = getForumSystemStatus();

  return (
    <div className="submit-page-wrap">
      <SubmitPostForm
        postingEnabled={status.postingEnabled}
        aiModerationProvider={status.aiModerationProvider}
      />
    </div>
  );
}
