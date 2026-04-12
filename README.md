# @i1hwan/apex-compatible

AI SDK provider adapter for [ApexRoute](https://github.com/i1hwan/ApexRoute). Extends [`@ai-sdk/openai-compatible`](https://github.com/vercel/ai/tree/main/packages/openai-compatible) with cache write token support via `MetadataExtractor`.

## Why

When using Anthropic Claude through an OpenAI-compatible proxy like ApexRoute, the standard `@ai-sdk/openai-compatible` provider loses `cache_creation_input_tokens` (cache write) because the OpenAI spec has no field for it. This adapter extracts cache data from the raw response — before Zod strips unknown fields — and injects it into `providerMetadata` where consumers like [OpenCode](https://github.com/sst/opencode) can read it.

### What it fixes

| Token Data | `@ai-sdk/openai-compatible` | `@i1hwan/apex-compatible` |
|---|---|---|
| `inputTokens.total` | ✅ | ✅ |
| `inputTokens.cacheRead` | ✅ | ✅ |
| `inputTokens.cacheWrite` | ❌ always `undefined` | ✅ via `providerMetadata` |
| `outputTokens.reasoning` | ✅ | ✅ |

## Install

```bash
npm install @i1hwan/apex-compatible
```

## Usage

```typescript
import { createApexCompatible } from "@i1hwan/apex-compatible";

const provider = createApexCompatible({
  baseURL: "https://your-apexroute-instance.com/v1",
  apiKey: process.env.APEX_API_KEY,
});

const model = provider("claude-sonnet-4-20250514");
```

### With OpenCode

In your `opencode.json`:

```json
{
  "provider": {
    "apexroute": {
      "npm": "@i1hwan/apex-compatible",
      "options": {
        "baseURL": "https://your-apexroute-instance.com/v1",
        "apiKey": "{env:APEX_API_KEY}"
      }
    }
  }
}
```

## How it works

ApexRoute already emits `prompt_tokens_details.cache_creation_tokens` in OpenAI-compatible responses. The standard `@ai-sdk/openai-compatible` provider drops this field during Zod schema validation.

This package uses the official [`metadataExtractor`](https://github.com/vercel/ai/blob/main/packages/openai-compatible/src/chat/openai-compatible-metadata-extractor.ts) extension point to:

1. Read `cache_creation_tokens` and `cached_tokens` from raw response data (before Zod parse)
2. Inject them into `providerMetadata` under the `anthropic` key (for OpenCode compatibility)

```
ApexRoute → { prompt_tokens_details: { cache_creation_tokens: 152 } }
    ↓
MetadataExtractor.processChunk(rawChunk)  ← pre-Zod raw data
    ↓
providerMetadata: { anthropic: { cacheCreationInputTokens: 152 } }
    ↓
OpenCode getUsage() → Cache Write: 152 ✅
```

No server-side changes required. No fork of `@ai-sdk/openai-compatible`. ~50 lines of code.

## API

### `createApexCompatible(options)`

Creates an OpenAI-compatible provider with ApexRoute metadata extraction pre-configured.

```typescript
interface ApexCompatibleSettings {
  baseURL: string;
  name?: string;           // default: "apex-compatible"
  apiKey?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  fetch?: FetchFunction;
  supportsStructuredOutputs?: boolean;
  transformRequestBody?: (args: Record<string, any>) => Record<string, any>;
}
```

### `createApexMetadataExtractor()`

Standalone metadata extractor — use if you want to configure `createOpenAICompatible` yourself:

```typescript
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createApexMetadataExtractor } from "@i1hwan/apex-compatible";

const provider = createOpenAICompatible({
  baseURL: "https://your-proxy.com/v1",
  name: "my-provider",
  includeUsage: true,
  metadataExtractor: createApexMetadataExtractor(),
});
```

## Related

- [ApexRoute](https://github.com/i1hwan/ApexRoute) — Private OmniRoute fork with lexical rewrite, thinking effort control, and cache token translation
- [Vercel AI SDK](https://github.com/vercel/ai) — The AI SDK this adapter extends
- [OpenCode](https://github.com/sst/opencode) — CLI that consumes this provider

## License

MIT
