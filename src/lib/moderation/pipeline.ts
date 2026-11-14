import { getAiModerator } from "@/lib/moderation/ai-moderator";
import {
  inspectContentCompliance,
  type ComplianceIssue,
} from "@/lib/moderation/privacy-filter";

export interface ModerationPipelineOutcome {
  action: "publish" | "pending_review" | "reject";
  stage: "L1_PRIVACY_AND_RULES" | "L2_AI_MODERATION";
  issues: ComplianceIssue[];
  reason: string;
}

export async function runModerationPipeline(input: {
  title: string;
  content: string;
  categorySlug: string;
}): Promise<ModerationPipelineOutcome> {
  const combined = input.title ? `${input.title}\n${input.content}` : input.content;
  const l1Result = inspectContentCompliance(combined);

  if (!l1Result.passed) {
    return {
      action: "reject",
      stage: "L1_PRIVACY_AND_RULES",
      issues: l1Result.issues,
      reason: l1Result.issues.map((item) => item.message).join(" "),
    };
  }

  const aiModerator = getAiModerator();
  const l2Result = await aiModerator.inspect(input);

  if (l2Result.decision === "reject") {
    return {
      action: "reject",
      stage: "L2_AI_MODERATION",
      issues: [],
      reason: l2Result.reason,
    };
  }

  if (l2Result.decision === "review") {
    return {
      action: "pending_review",
      stage: "L2_AI_MODERATION",
      issues: [],
      reason: l2Result.reason,
    };
  }

  return {
    action: "publish",
    stage: "L2_AI_MODERATION",
    issues: [],
    reason: l2Result.reason,
  };
}
