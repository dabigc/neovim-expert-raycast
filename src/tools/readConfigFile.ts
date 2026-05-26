import { resolveConfigPath, validatePath } from "../lib/config";
import { readFileSync } from "node:fs";

type Input = {
  /** Relative path to the config file within the Neovim config directory (e.g., "init.lua", "lua/plugins/go.lua"). */
  filePath: string;
};

export default async function tool(input: Input) {
  const configPath = resolveConfigPath();
  if (!configPath) {
    return "No Neovim configuration directory found. Set your config path in Raycast Settings > Extensions > Neovim Expert.";
  }

  const absolutePath = validatePath(configPath, input.filePath);
  if (!absolutePath) {
    return `Invalid path: "${input.filePath}" is outside the config directory. Use a relative path like "init.lua" or "lua/plugins/go.lua".`;
  }

  try {
    const content = readFileSync(absolutePath, "utf-8");
    return `File: ${input.filePath}\n\n${content}`;
  } catch {
    return `File not found: "${input.filePath}". Use the listConfigFiles tool to see available files.`;
  }
}
