import { resolveConfigPath } from "../lib/config";
import { detectPluginManager } from "../lib/discovery";
import { listFiles } from "../lib/search";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

export default async function tool() {
  const configPath = resolveConfigPath();
  if (!configPath) {
    return "No Neovim configuration directory found. Checked: $XDG_CONFIG_HOME/nvim, ~/.config/nvim. Set your config path in Raycast Settings > Extensions > Neovim Expert.";
  }

  const files = listFiles(configPath);
  const pluginManager = detectPluginManager(configPath);

  const topLevelDirs = [...new Set(
    files
      .map((f) => f.relativePath.split("/")[0])
  )].filter((entry) => {
    try {
      return statSync(join(configPath, entry)).isDirectory();
    } catch {
      return false;
    }
  });

  const keyFiles: string[] = [];
  const checks = ["init.lua", "init.vim", "lazy-lock.json", "lazyvim.json", "stylua.toml"];
  for (const check of checks) {
    if (existsSync(join(configPath, check))) keyFiles.push(check);
  }
  const luaConfigFiles = files
    .filter((f) => f.relativePath.startsWith("lua/config/"))
    .map((f) => f.relativePath);
  keyFiles.push(...luaConfigFiles);

  let result = `Neovim Configuration Summary\n`;
  result += `Path: ${configPath}\n`;
  result += `Total files: ${files.length}\n\n`;
  result += `Plugin Manager: ${pluginManager.name} (detected via: ${pluginManager.indicator})\n\n`;
  result += `Key files:\n${keyFiles.map((f) => `  - ${f}`).join("\n")}\n\n`;
  result += `Directories:\n${topLevelDirs.map((d) => `  - ${d}/`).join("\n")}\n`;

  return result;
}
