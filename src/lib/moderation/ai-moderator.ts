import { getRuntimeConfig } from "@/lib/config";

export type AiModerationDecision = "pass" | "review" | "reject";

export interface AiModerationInput {
  title: string;
  content: string;
  categorySlug: string;
}

export interface AiModerationResult {
  decision: AiModerationDecision;
  provider: string;
  reason: string;
}

export interface AiModerator {
  readonly name: string;
  inspect(input: AiModerationInput): Promise<AiModerationResult>;
}

const disabledModerator: AiModerator = {
  name: "disabled",
  async inspect() {
    return {
      decision: "pass",
      provider: "disabled",
      reason: "AI 内容审核尚未接入（一期由总闸门全局锁定发布通道）。",
    };
  },
};

const openAiCompatibleModerator: AiModerator = {
  name: "openai_compatible",
  async inspect(input) {
    const cfg = getRuntimeConfig();
    if (!cfg.aiModerationApiUrl || !cfg.aiModerationApiKey) {
      return {
        decision: "review",
        provider: "openai_compatible",
        reason: "AI 审核接口未完整配置，降级转入人工待审队列。",
      };
    }

    try {
      const response = await fetch(cfg.aiModerationApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.aiModerationApiKey}`,
        },
        body: JSON.stringify({
          model: cfg.aiModerationModel || "gpt-4o-mini",
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "你是校园论坛内容安全审核员。仅返回 JSON：{\"decision\":\"pass|review|reject\",\"reason\":\"简短中文原因\"}。严禁师生真名曝光、校园欺凌、造谣诽谤、低俗及违法违规内容。",
            },
            {
              role: "user",
              content: JSON.stringify({
                category: input.categorySlug,
                title: input.title,
                content: input.content,
              }),
            },
          ],
        }),
      });

      if (!response.ok) {
        return {
          decision: "review",
          provider: "openai_compatible",
          reason: "AI 审核服务暂不可用，内容转入人工待审。",
        };
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = payload.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(rawContent) as {
        decision?: AiModerationDecision;
        reason?: string;
      };

      if (
        parsed.decision === "pass" ||
        parsed.decision === "review" ||
        parsed.decision === "reject"
      ) {
        return {
          decision: parsed.decision,
          provider: "openai_compatible",
          reason: parsed.reason || "AI 审核已完成判定。",
        };
      }

      return {
        decision: "review",
        provider: "openai_compatible",
        reason: "AI 审核返回结构异常，保守转入人工待审。",
      };
    } catch {
      return {
        decision: "review",
        provider: "openai_compatible",
        reason: "AI 审核调用异常，保守转入人工待审。",
      };
    }
  },
};

export function getAiModerator(): AiModerator {
  const provider = getRuntimeConfig().aiModerationProvider;
  if (provider === "openai_compatible") {
    return openAiCompatibleModerator;
  }
  return disabledModerator;
}
