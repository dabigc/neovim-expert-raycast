import { resolveConfigPath } from "../lib/config";
import { grepFiles } from "../lib/search";

type Input = {
  /** The search term to look for across all config files. */
  query: string;
  /** Optional file pattern to filter results (e.g., "*.lua", "*.vim"). */
  filePattern?: string;
};

export default async function tool(input: Input) {
  const configPath = resolveConfigPath();
  if (!configPath) {
    return "No Neovim configuration directory found. Set your config path in Raycast Settings > Extensions > Neovim Expert.";
  }

  const results = grepFiles(configPath, input.query, input.filePattern);

  if (results.length === 0) {
    const scope = input.filePattern ? ` in ${input.filePattern} files` : "";
    return `No matches found for "${input.query}"${scope}.`;
  }

  let result = `Found ${results.length} match(es) for "${input.query}":\n\n`;
  for (const r of results) {
    result += `${r.file}:${r.lineNumber}: ${r.line}\n`;
  }

  return result;
}
