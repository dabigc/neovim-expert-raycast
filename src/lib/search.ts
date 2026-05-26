import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface FileEntry {
  relativePath: string;
  size: number;
}

export interface GrepResult {
  file: string;
  lineNumber: number;
  line: string;
}

export interface KeybindingEntry {
  mode: string;
  key: string;
  action: string;
  desc?: string;
  file: string;
}

const EXCLUDED_DIRS = new Set([".git", "node_modules", ".DS_Store", "plugin"]);

export function listFiles(configDir: string, subdirectory?: string): FileEntry[] {
  const targetDir = subdirectory ? join(configDir, subdirectory) : configDir;
  const files: FileEntry[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry)) continue;

      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          files.push({
            relativePath: relative(configDir, fullPath),
            size: stat.size,
          });
        }
      } catch {
        continue;
      }
    }
  }

  walk(targetDir);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function grepFiles(
  configDir: string,
  query: string,
  filePattern?: string,
  maxResults = 50,
): GrepResult[] {
  const files = listFiles(configDir);
  const results: GrepResult[] = [];
  const lowerQuery = query.toLowerCase();
  const patternRegex = filePattern ? globToRegex(filePattern) : null;

  for (const file of files) {
    if (results.length >= maxResults) break;
    if (patternRegex && !patternRegex.test(file.relativePath)) continue;

    const fullPath = join(configDir, file.relativePath);
    try {
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (results.length >= maxResults) break;
        if (lines[i].toLowerCase().includes(lowerQuery)) {
          results.push({
            file: file.relativePath,
            lineNumber: i + 1,
            line: lines[i].trimEnd(),
          });
        }
      }
    } catch {
      continue;
    }
  }

  return results;
}

export function extractKeybindings(configDir: string, query?: string): KeybindingEntry[] {
  const files = listFiles(configDir);
  const bindings: KeybindingEntry[] = [];

  for (const file of files) {
    const fullPath = join(configDir, file.relativePath);
    try {
      const content = readFileSync(fullPath, "utf-8");

      if (file.relativePath.endsWith(".lua")) {
        extractLuaKeybindings(content, file.relativePath, bindings);
      } else if (file.relativePath.endsWith(".vim")) {
        extractVimKeybindings(content, file.relativePath, bindings);
      }
    } catch {
      continue;
    }
  }

  if (query) {
    const lowerQuery = query.toLowerCase();
    return bindings.filter(
      (b) =>
        b.key.toLowerCase().includes(lowerQuery) ||
        b.action.toLowerCase().includes(lowerQuery) ||
        (b.desc && b.desc.toLowerCase().includes(lowerQuery)),
    );
  }

  return bindings;
}

function extractLuaKeybindings(content: string, file: string, bindings: KeybindingEntry[]) {
  // Match vim.keymap.set("mode", "key", "action", { desc = "..." })
  const keymapPattern =
    /vim\.keymap\.set\(\s*["'](\w)["']\s*,\s*["']([^"']+)["']\s*,\s*["']?([^"',)]+)["']?\s*(?:,\s*\{[^}]*desc\s*=\s*["']([^"']+)["'][^}]*\})?/g;

  let match;
  while ((match = keymapPattern.exec(content)) !== null) {
    bindings.push({
      mode: match[1],
      key: match[2],
      action: match[3].trim(),
      desc: match[4],
      file,
    });
  }

  // Match lazy.nvim keys spec: { "key", "action", desc = "..." }
  const keysPattern =
    /\{\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*(?:,\s*desc\s*=\s*["']([^"']+)["'])?/g;

  while ((match = keysPattern.exec(content)) !== null) {
    if (!bindings.some((b) => b.key === match![1] && b.file === file)) {
      bindings.push({
        mode: "n",
        key: match[1],
        action: match[2],
        desc: match[3],
        file,
      });
    }
  }
}

function extractVimKeybindings(content: string, file: string, bindings: KeybindingEntry[]) {
  const mapPattern =
    /^\s*(n?v?i?x?o?s?t?c?map|nmap|imap|vmap|xmap|omap|smap|tmap|cmap|nnoremap|inoremap|vnoremap)\s+(\S+)\s+(.+)$/gm;

  let match;
  while ((match = mapPattern.exec(content)) !== null) {
    const cmd = match[1];
    let mode = "n";
    if (cmd.startsWith("i")) mode = "i";
    else if (cmd.startsWith("v")) mode = "v";
    else if (cmd.startsWith("x")) mode = "x";
    else if (cmd.startsWith("o")) mode = "o";
    else if (cmd.startsWith("s")) mode = "s";
    else if (cmd.startsWith("t")) mode = "t";
    else if (cmd.startsWith("c")) mode = "c";

    bindings.push({
      mode,
      key: match[2],
      action: match[3].trim(),
      file,
    });
  }
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(escaped + "$", "i");
}
