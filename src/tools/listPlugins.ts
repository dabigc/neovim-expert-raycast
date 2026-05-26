import { resolveConfigPath } from "../lib/config";
import { detectPluginManager } from "../lib/discovery";
import { parseLazyLock, scanPackerPlugins, scanVimPlugPlugins, scanLuaPluginSpecs, PluginEntry } from "../lib/parsers";
import { listFiles } from "../lib/search";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export default async function tool() {
  const configPath = resolveConfigPath();
  if (!configPath) {
    return "No Neovim configuration directory found. Set your config path in Raycast Settings > Extensions > Neovim Expert.";
  }

  const pm = detectPluginManager(configPath);
  let plugins: PluginEntry[] = [];

  if (pm.name === "lazy.nvim") {
    try {
      const lockContent = readFileSync(join(configPath, "lazy-lock.json"), "utf-8");
      plugins = parseLazyLock(lockContent);
    } catch {
      plugins = scanAllLuaFiles(configPath);
    }
  } else if (pm.name === "packer") {
    const files = listFiles(configPath).filter((f) => f.relativePath.endsWith(".lua"));
    for (const file of files) {
      try {
        const content = readFileSync(join(configPath, file.relativePath), "utf-8");
        plugins.push(...scanPackerPlugins(content));
      } catch {
        continue;
      }
    }
  } else if (pm.name === "vim-plug") {
    const files = listFiles(configPath).filter(
      (f) => f.relativePath.endsWith(".vim") || f.relativePath.endsWith(".lua")
    );
    for (const file of files) {
      try {
        const content = readFileSync(join(configPath, file.relativePath), "utf-8");
        plugins.push(...scanVimPlugPlugins(content));
      } catch {
        continue;
      }
    }
  } else {
    plugins = scanAllLuaFiles(configPath);
  }

  if (plugins.length === 0) {
    return "No plugins detected. The config may use a plugin manager format that isn't recognized, or no plugins are installed.";
  }

  let result = `Found ${plugins.length} plugin(s) (via ${pm.name}):\n\n`;
  for (const plugin of plugins.sort((a, b) => a.name.localeCompare(b.name))) {
    result += `- ${plugin.name}`;
    if (plugin.branch) result += ` [${plugin.branch}]`;
    if (plugin.commit) result += ` @ ${plugin.commit.slice(0, 7)}`;
    result += "\n";
  }

  return result;
}

function scanAllLuaFiles(configPath: string): PluginEntry[] {
  const files = listFiles(configPath).filter((f) => f.relativePath.endsWith(".lua"));
  const allPlugins: PluginEntry[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    try {
      const content = readFileSync(join(configPath, file.relativePath), "utf-8");
      for (const plugin of scanLuaPluginSpecs(content)) {
        if (!seen.has(plugin.name)) {
          seen.add(plugin.name);
          allPlugins.push(plugin);
        }
      }
    } catch {
      continue;
    }
  }

  return allPlugins;
}
