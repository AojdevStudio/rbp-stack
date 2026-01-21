import { colors, symbols } from "../utils/colors";

export type LogLevel = "debug" | "info" | "warn" | "error";

let currentLogLevel: LogLevel = "info";

const levelOrder: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[currentLogLevel];
}

function formatTimestamp(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.log(colors.gray(`[${formatTimestamp()}] DEBUG: ${message}`), ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(`${symbols.arrow} ${message}`, ...args);
    }
  },

  success(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(`${colors.green(symbols.check)} ${message}`, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(`${colors.yellow(symbols.warning)} ${message}`, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(`${colors.red(symbols.cross)} ${message}`, ...args);
    }
  },

  section(title: string): void {
    if (shouldLog("info")) {
      console.log("");
      console.log(colors.cyan("═".repeat(55)));
      console.log(colors.cyan(`  ${title}`));
      console.log(colors.cyan("═".repeat(55)));
      console.log("");
    }
  },

  banner(title: string, subtitle?: string): void {
    if (shouldLog("info")) {
      console.log(colors.cyan("╔" + "═".repeat(57) + "╗"));
      console.log(colors.cyan("║") + title.padStart(29 + Math.floor(title.length / 2)).padEnd(57) + colors.cyan("║"));
      if (subtitle) {
        console.log(colors.cyan("║") + subtitle.padStart(29 + Math.floor(subtitle.length / 2)).padEnd(57) + colors.cyan("║"));
      }
      console.log(colors.cyan("╚" + "═".repeat(57) + "╝"));
    }
  },
};
