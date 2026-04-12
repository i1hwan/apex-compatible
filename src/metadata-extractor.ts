import type { MetadataExtractor } from "@ai-sdk/openai-compatible";
import type { JSONObject, SharedV3ProviderMetadata } from "@ai-sdk/provider";

interface ApexUsageDetails {
  cachedTokens: number;
  cacheCreationTokens: number;
}

function extractCacheDetails(raw: unknown): ApexUsageDetails | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const usage =
    (obj.usage as Record<string, unknown>) ??
    ((obj.choices as unknown[])?.at(0) as Record<string, unknown>)?.usage;

  if (!usage || typeof usage !== "object") return null;

  const details = (usage as Record<string, unknown>)
    .prompt_tokens_details as Record<string, unknown> | undefined;

  if (!details || typeof details !== "object") return null;

  const cached = typeof details.cached_tokens === "number" ? details.cached_tokens : 0;
  const creation =
    typeof details.cache_creation_tokens === "number" ? details.cache_creation_tokens : 0;

  if (cached === 0 && creation === 0) return null;

  return { cachedTokens: cached, cacheCreationTokens: creation };
}

function buildProviderMetadata(
  details: ApexUsageDetails,
): SharedV3ProviderMetadata {
  const block: JSONObject = {};
  if (details.cacheCreationTokens > 0) {
    block.cacheCreationInputTokens = details.cacheCreationTokens;
  }
  if (details.cachedTokens > 0) {
    block.cacheReadInputTokens = details.cachedTokens;
  }

  return {
    anthropic: block,
    apex: { ...block },
  };
}

export function createApexMetadataExtractor(): MetadataExtractor {
  return {
    async extractMetadata({ parsedBody }) {
      const details = extractCacheDetails(parsedBody);
      if (!details) return undefined;
      return buildProviderMetadata(details);
    },

    createStreamExtractor() {
      let cached = 0;
      let creation = 0;

      return {
        processChunk(rawChunk: unknown) {
          const details = extractCacheDetails(rawChunk);
          if (details) {
            if (details.cachedTokens > 0) cached = details.cachedTokens;
            if (details.cacheCreationTokens > 0) creation = details.cacheCreationTokens;
          }
        },

        buildMetadata() {
          if (cached === 0 && creation === 0) return undefined;
          return buildProviderMetadata({ cachedTokens: cached, cacheCreationTokens: creation });
        },
      };
    },
  };
}
