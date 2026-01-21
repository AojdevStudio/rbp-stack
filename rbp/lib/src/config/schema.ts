import { z } from "zod";

export const RbpConfigSchema = z.object({
  project: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),

  paths: z.object({
    stories: z.string().default("docs/bmm/implementation-artifacts/stories"),
    specs: z.string().default("specs"),
    beads: z.string().default(".beads"),
    scripts: z.string().default("scripts/rbp"),
  }).default({}),

  execution: z.object({
    max_iterations: z.number().min(1).max(1000).default(50),
    phase_size: z.number().min(1).max(20).default(5),
    iteration_delay: z.number().min(0).max(60).default(2),
  }).default({}),

  verification: z.object({
    require_tests: z.boolean().default(true),
    require_playwright_for_ui: z.boolean().default(true),
    test_command: z.string().default("bun test"),
    typecheck_command: z.string().default("bun run typecheck"),
    playwright_command: z.string().default("bunx playwright test"),
  }).default({}),

  ui_detection: z.object({
    enabled: z.boolean().default(true),
    keywords: z.array(z.string()).default(["UI", "component", "button", "form"]),
  }).default({}),

  bmad: z.object({
    epics_dir: z.string().optional(),
    epic_pattern: z.string().optional(),
    stories_dir: z.string().optional(),
    arch_dir: z.string().optional(),
    create_story: z.string().default("/bmad:bmm:workflows:create-story"),
    dev_story: z.string().default("/bmad:bmm:workflows:dev-story"),
    code_review: z.string().default("/bmad:bmm:workflows:code-review"),
  }).default({}),

  codex: z.object({
    enabled: z.boolean().default(true),
    model: z.string().default("gpt-5-codex"),
    reasoning_effort: z.enum(["low", "medium", "high"]).default("high"),
    skip_by_default: z.boolean().default(false),
  }).default({}),

  observability: z.object({
    enabled: z.boolean().default(true),
    auto_launch: z.boolean().default(true),
  }).default({}),
}).partial().transform((config) => ({
  project: config.project ?? { name: "unknown" },
  paths: {
    stories: config.paths?.stories ?? "docs/bmm/implementation-artifacts/stories",
    specs: config.paths?.specs ?? "specs",
    beads: config.paths?.beads ?? ".beads",
    scripts: config.paths?.scripts ?? "scripts/rbp",
  },
  execution: {
    max_iterations: config.execution?.max_iterations ?? 50,
    phase_size: config.execution?.phase_size ?? 5,
    iteration_delay: config.execution?.iteration_delay ?? 2,
  },
  verification: {
    require_tests: config.verification?.require_tests ?? true,
    require_playwright_for_ui: config.verification?.require_playwright_for_ui ?? true,
    test_command: config.verification?.test_command ?? "bun test",
    typecheck_command: config.verification?.typecheck_command ?? "bun run typecheck",
    playwright_command: config.verification?.playwright_command ?? "bunx playwright test",
  },
  ui_detection: {
    enabled: config.ui_detection?.enabled ?? true,
    keywords: config.ui_detection?.keywords ?? ["UI", "component", "button", "form"],
  },
  bmad: {
    epics_dir: config.bmad?.epics_dir,
    epic_pattern: config.bmad?.epic_pattern,
    stories_dir: config.bmad?.stories_dir,
    arch_dir: config.bmad?.arch_dir,
    create_story: config.bmad?.create_story ?? "/bmad:bmm:workflows:create-story",
    dev_story: config.bmad?.dev_story ?? "/bmad:bmm:workflows:dev-story",
    code_review: config.bmad?.code_review ?? "/bmad:bmm:workflows:code-review",
  },
  codex: {
    enabled: config.codex?.enabled ?? true,
    model: config.codex?.model ?? "gpt-5-codex",
    reasoning_effort: config.codex?.reasoning_effort ?? "high",
    skip_by_default: config.codex?.skip_by_default ?? false,
  },
  observability: {
    enabled: config.observability?.enabled ?? true,
    auto_launch: config.observability?.auto_launch ?? true,
  },
}));
