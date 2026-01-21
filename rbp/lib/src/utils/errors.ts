export interface RbpError {
  code: string;
  message: string;
  details?: unknown;
  suggestion?: string;
}

export class RbpErrorInstance extends Error implements RbpError {
  code: string;
  details?: unknown;
  suggestion?: string;

  constructor(error: RbpError) {
    super(error.message);
    this.code = error.code;
    this.details = error.details;
    this.suggestion = error.suggestion;
    this.name = "RbpError";
  }

  toJSON(): RbpError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      suggestion: this.suggestion,
    };
  }
}

export function formatError(error: RbpError, jsonOutput = true): string {
  if (jsonOutput) {
    return JSON.stringify(error);
  }
  let output = `Error [${error.code}]: ${error.message}`;
  if (error.suggestion) {
    output += `\nSuggestion: ${error.suggestion}`;
  }
  return output;
}

export function exitWithError(error: RbpError): never {
  const jsonOutput = process.env.RBP_JSON_ERRORS !== "false";
  console.error(formatError(error, jsonOutput));
  process.exit(1);
}

export const ErrorCodes = {
  CONFIG_INVALID: "CONFIG_INVALID",
  CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
  BEADS_NOT_INITIALIZED: "BEADS_NOT_INITIALIZED",
  BEADS_COMMAND_FAILED: "BEADS_COMMAND_FAILED",
  BEADS_PARSE_ERROR: "BEADS_PARSE_ERROR",
  CLAUDE_TIMEOUT: "CLAUDE_TIMEOUT",
  CLAUDE_FAILED: "CLAUDE_FAILED",
  TEST_FAILED: "TEST_FAILED",
  WORKFLOW_CONFLICT: "WORKFLOW_CONFLICT",
  NO_WORKFLOW_DETECTED: "NO_WORKFLOW_DETECTED",
  SPEC_NOT_FOUND: "SPEC_NOT_FOUND",
  BMAD_FAILED: "BMAD_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export function createError(
  code: ErrorCode,
  message: string,
  options?: { details?: unknown; suggestion?: string }
): RbpError {
  return {
    code,
    message,
    details: options?.details,
    suggestion: options?.suggestion,
  };
}
