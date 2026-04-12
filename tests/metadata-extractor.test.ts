import { describe, it, expect } from "vitest";
import { createApexMetadataExtractor } from "../src/metadata-extractor.js";

describe("createApexMetadataExtractor", () => {
  describe("extractMetadata (non-streaming)", () => {
    it("extracts cache_creation_tokens and cached_tokens from response body", async () => {
      const extractor = createApexMetadataExtractor();
      const result = await extractor.extractMetadata({
        parsedBody: {
          id: "chatcmpl-123",
          choices: [{ message: { role: "assistant", content: "Hello" } }],
          usage: {
            prompt_tokens: 92123,
            completion_tokens: 603,
            total_tokens: 92726,
            prompt_tokens_details: {
              cached_tokens: 91945,
              cache_creation_tokens: 152,
            },
          },
        },
      });

      expect(result).toEqual({
        anthropic: {
          cacheCreationInputTokens: 152,
          cacheReadInputTokens: 91945,
        },
        apex: {
          cacheCreationInputTokens: 152,
          cacheReadInputTokens: 91945,
        },
      });
    });

    it("returns undefined when no cache tokens present", async () => {
      const extractor = createApexMetadataExtractor();
      const result = await extractor.extractMetadata({
        parsedBody: {
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        },
      });

      expect(result).toBeUndefined();
    });

    it("returns undefined when usage is missing", async () => {
      const extractor = createApexMetadataExtractor();
      const result = await extractor.extractMetadata({
        parsedBody: { id: "chatcmpl-123" },
      });

      expect(result).toBeUndefined();
    });

    it("handles only cached_tokens without cache_creation", async () => {
      const extractor = createApexMetadataExtractor();
      const result = await extractor.extractMetadata({
        parsedBody: {
          usage: {
            prompt_tokens: 5000,
            completion_tokens: 100,
            total_tokens: 5100,
            prompt_tokens_details: {
              cached_tokens: 4900,
            },
          },
        },
      });

      expect(result).toEqual({
        anthropic: { cacheReadInputTokens: 4900 },
        apex: { cacheReadInputTokens: 4900 },
      });
    });

    it("handles only cache_creation_tokens without cached_tokens", async () => {
      const extractor = createApexMetadataExtractor();
      const result = await extractor.extractMetadata({
        parsedBody: {
          usage: {
            prompt_tokens: 200,
            completion_tokens: 50,
            total_tokens: 250,
            prompt_tokens_details: {
              cache_creation_tokens: 180,
            },
          },
        },
      });

      expect(result).toEqual({
        anthropic: { cacheCreationInputTokens: 180 },
        apex: { cacheCreationInputTokens: 180 },
      });
    });
  });

  describe("createStreamExtractor (streaming)", () => {
    it("accumulates cache tokens across multiple chunks", () => {
      const extractor = createApexMetadataExtractor();
      const stream = extractor.createStreamExtractor();

      stream.processChunk({
        choices: [{ delta: { role: "assistant" } }],
      });

      stream.processChunk({
        choices: [{ delta: { content: "Hello" } }],
      });

      stream.processChunk({
        choices: [
          {
            delta: {},
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 92123,
          completion_tokens: 603,
          total_tokens: 92726,
          prompt_tokens_details: {
            cached_tokens: 91945,
            cache_creation_tokens: 152,
          },
        },
      });

      const metadata = stream.buildMetadata();
      expect(metadata).toEqual({
        anthropic: {
          cacheCreationInputTokens: 152,
          cacheReadInputTokens: 91945,
        },
        apex: {
          cacheCreationInputTokens: 152,
          cacheReadInputTokens: 91945,
        },
      });
    });

    it("returns undefined when no cache tokens seen in stream", () => {
      const extractor = createApexMetadataExtractor();
      const stream = extractor.createStreamExtractor();

      stream.processChunk({
        choices: [{ delta: { content: "Hello" } }],
      });
      stream.processChunk({
        choices: [{ delta: {}, finish_reason: "stop" }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      });

      expect(stream.buildMetadata()).toBeUndefined();
    });

    it("takes latest positive values when cache tokens appear in multiple chunks", () => {
      const extractor = createApexMetadataExtractor();
      const stream = extractor.createStreamExtractor();

      stream.processChunk({
        usage: {
          prompt_tokens: 100,
          prompt_tokens_details: {
            cached_tokens: 50,
          },
        },
      });

      stream.processChunk({
        usage: {
          prompt_tokens: 200,
          prompt_tokens_details: {
            cached_tokens: 150,
            cache_creation_tokens: 30,
          },
        },
      });

      const metadata = stream.buildMetadata();
      expect(metadata?.anthropic).toEqual({
        cacheCreationInputTokens: 30,
        cacheReadInputTokens: 150,
      });
    });
  });
});
