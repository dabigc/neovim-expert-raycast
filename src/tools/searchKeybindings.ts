import { resolveConfigPath } from "../lib/config";
import { extractKeybindings } from "../lib/search";

type Input = {
  /** Optional filter to search for a specific key, action, or description. */
  query?: string;
};

export default async function tool(input: Input) {
  const configPath = resolveConfigPath();
  if (!configPath) {
    return "No Neovim configuration directory found. Set your config path in Raycast Settings > Extensions > Neovim Expert.";
  }

  const bindings = extractKeybindings(configPath, input.query);

  if (bindings.length === 0) {
    const scope = input.query ? ` matching "${input.query}"` : "";
    return `No keybindings found${scope}.`;
  }

  let result = `Found ${bindings.length} keybinding(s)${input.query ? ` matching "${input.query}"` : ""}:\n\n`;
  for (const b of bindings) {
    result += `[${b.mode}] ${b.key} → ${b.action}`;
    if (b.desc) result += ` (${b.desc})`;
    result += `  (${b.file})\n`;
  }

  return result;
}
