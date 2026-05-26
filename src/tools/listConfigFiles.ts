import { resolveConfigPath } from "../lib/config";
import { listFiles } from "../lib/search";

type Input = {
  /** Subdirectory to scope the listing to (e.g., "lua/plugins"). If omitted, lists all files. */
  subdirectory?: string;
};

export default async function tool(input: Input) {
  const configPath = resolveConfigPath();
  if (!configPath) {
    return "No Neovim configuration directory found. Set your config path in Raycast Settings > Extensions > Neovim Expert.";
  }

  const files = listFiles(configPath, input.subdirectory);

  if (files.length === 0) {
    const scope = input.subdirectory ? ` in ${input.subdirectory}` : "";
    return `No files found${scope}.`;
  }

  const header = input.subdirectory
    ? `Files in ${input.subdirectory} (${files.length}):`
    : `All config files (${files.length}):`;

  const listing = files
    .map((f) => `  ${f.relativePath} (${formatSize(f.size)})`)
    .join("\n");

  return `${header}\n${listing}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}
