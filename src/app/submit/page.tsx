import type { Metadata } from "next";
import { SubmitPostForm } from "@/components/SubmitPostForm";
import { getPublicSystemStatus } from "@/lib/config";

export const metadata: Metadata = {
  title: "发布帖子",
};

export const dynamic = "force-dynamic";

export default function SubmitPage() {
  const status = getPublicSystemStatus();

  return (
    <div className="submit-page-wrap">
      <SubmitPostForm
        postingEnabled={status.postingEnabled}
        aiModerationProvider={status.aiModerationProvider}
      />
    </div>
  );
}
