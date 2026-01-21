import type { z } from "zod";
import type { RbpConfigSchema } from "./schema";

export type RbpConfig = z.infer<typeof RbpConfigSchema>;

export interface ConfigLoadOptions {
  configPath?: string;
  cliOverrides?: Partial<RbpConfig>;
}
