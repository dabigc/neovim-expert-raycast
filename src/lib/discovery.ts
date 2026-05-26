import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface PluginManagerInfo {
  name: "lazy.nvim" | "packer" | "vim-plug" | "none";
  indicator: string;
}

export function detectPluginManager(configDir: string): PluginManagerInfo {
  if (existsSync(join(configDir, "lazy-lock.json"))) {
    return { name: "lazy.nvim", indicator: "lazy-lock.json" };
  }

  const packerResult = scanForPattern(configDir, /require\s*\(?\s*['"]packer['"]\s*\)?/, ["lua"]);
  if (packerResult) {
    return { name: "packer", indicator: `packer require found in ${packerResult}` };
  }

  const plugResult = scanForPattern(configDir, /plug#begin\s*\(/, ["vim"]);
  if (plugResult) {
    return { name: "vim-plug", indicator: `plug#begin found in ${plugResult}` };
  }

  return { name: "none", indicator: "no plugin manager detected" };
}

function scanForPattern(
  dir: string,
  pattern: RegExp,
  extensions: string[],
  maxDepth = 3,
  currentDepth = 0,
  baseDir?: string
): string | null {
  if (currentDepth > maxDepth) return null;
  const base = baseDir || dir;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = fullPath.slice(base.length + 1);

    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry === ".git" || entry === "node_modules") continue;
        const result = scanForPattern(fullPath, pattern, extensions, maxDepth, currentDepth + 1, base);
        if (result) return result;
      } else if (extensions.some((ext) => entry.endsWith(`.${ext}`))) {
        const content = readFileSync(fullPath, "utf-8");
        if (pattern.test(content)) return relativePath;
      }
    } catch {
      continue;
    }
  }

  return null;
}
