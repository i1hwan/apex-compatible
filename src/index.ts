import {
  createOpenAICompatible,
  type OpenAICompatibleProvider,
  type OpenAICompatibleProviderSettings,
} from "@ai-sdk/openai-compatible";
import { createApexMetadataExtractor } from "./metadata-extractor.js";

export interface ApexCompatibleSettings
  extends Omit<OpenAICompatibleProviderSettings, "metadataExtractor" | "name"> {
  name?: string;
}

export function createApexCompatible<
  CHAT extends string = string,
  COMPLETION extends string = string,
  EMBEDDING extends string = string,
  IMAGE extends string = string,
>(
  options: ApexCompatibleSettings,
): OpenAICompatibleProvider<CHAT, COMPLETION, EMBEDDING, IMAGE> {
  return createOpenAICompatible<CHAT, COMPLETION, EMBEDDING, IMAGE>({
    ...options,
    name: options.name ?? "apex-compatible",
    includeUsage: true,
    metadataExtractor: createApexMetadataExtractor(),
  });
}

export { createApexMetadataExtractor } from "./metadata-extractor.js";
export type { MetadataExtractor } from "@ai-sdk/openai-compatible";
