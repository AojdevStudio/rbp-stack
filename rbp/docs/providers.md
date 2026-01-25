# AI Provider System

## Overview

Ralph supports multiple AI providers through a pluggable provider abstraction layer. This allows you to switch between different AI engines (Claude, Gemini, Codex) without changing your workflow.

## Usage

Use the `--agent` flag to specify which provider to use:

```bash
# Use Claude (default)
ralph run

# Use Claude explicitly
ralph run --agent claude

# Use Gemini
ralph run --agent gemini

# Use OpenAI Codex
ralph run --agent codex
```

## Architecture

### Provider Interface

All providers implement the `AIProvider` interface:

```typescript
interface AIProvider {
  name: string;
  execute(prompt: string, options?: ExecuteOptions): Promise<ExecuteResult>;
  isAvailable(): boolean;
}
```

### Provider Factory

The `getProvider(name: string)` factory function returns the appropriate provider instance. Provider names are case-insensitive.

```typescript
import { getProvider } from "./providers";

const provider = getProvider("claude");
const result = await provider.execute(prompt, { cwd: "/path/to/project" });
```

## Available Providers

### Claude (Production Ready)

The Claude provider integrates with the Claude Code CLI.

**Status:** ✅ Fully implemented

**Requirements:** `claude` CLI must be installed

**Features:**
- Full integration with Claude Code CLI
- Automatic availability detection
- Supports all prompt injection features

### Gemini (Stub)

The Gemini provider will integrate with Google's Gemini CLI.

**Status:** 🚧 Stub implementation

**Requirements:** `gemini` CLI (not yet integrated)

**Current Behavior:** Returns "Not yet implemented" message

### Codex (Stub)

The Codex provider will integrate with OpenAI Codex CLI.

**Status:** 🚧 Stub implementation

**Requirements:** `codex` CLI (not yet integrated)

**Current Behavior:** Returns "Not yet implemented" message

## Error Handling

If a provider is not available (CLI not installed), Ralph will exit with error code `MISSING_PREREQUISITE`:

```
Error [MISSING_PREREQUISITE]: Provider gemini is not available
Suggestion: Install gemini CLI or use a different provider with --agent flag
```

## Adding New Providers

To add a new provider:

1. Create `providers/yourprovider.ts` implementing `AIProvider`
2. Add to the providers map in `providers/index.ts`
3. Write tests in `providers/index.test.ts`
4. Update this documentation

## Testing

Provider tests are located in `lib/src/providers/index.test.ts`:

```bash
bun test rbp/lib/src/providers/index.test.ts
```

## Implementation Details

### Claude Provider

The Claude provider spawns the `claude` CLI process with `--dangerously-skip-permissions` flag and pipes the prompt via stdin.

### Availability Detection

Providers check availability using `which <cli-name>` to verify the CLI is installed in the system PATH.
