/**
 * Parse a shell command string into an array of arguments,
 * respecting quotes and escapes.
 *
 * Examples:
 *   'bun test' → ['bun', 'test']
 *   'bun test --filter "my test"' → ['bun', 'test', '--filter', 'my test']
 *   "echo 'hello world'" → ['echo', 'hello world']
 *   'echo "it\\'s fine"' → ['echo', "it's fine"]
 */
export function parseShellCommand(command: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      // Backslash escapes the next character when not in single quotes
      if (inSingleQuote) {
        current += char;
      } else {
        escaped = true;
      }
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === " " && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

