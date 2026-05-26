import { getPreferenceValues } from "@raycast/api";
import { existsSync } from "node:fs";
import { join, resolve, normalize } from "node:path";
import { homedir } from "node:os";

interface Preferences {
  configPath?: string;
}

export function resolveConfigPath(): string | null {
  const prefs = getPreferenceValues<Preferences>();

  if (prefs.configPath && prefs.configPath.trim() !== "") {
    const p = prefs.configPath.trim();
    if (existsSync(p)) return p;
  }

  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    const xdgPath = join(xdg, "nvim");
    if (existsSync(xdgPath)) return xdgPath;
  }

  const defaultPath = join(homedir(), ".config", "nvim");
  if (existsSync(defaultPath)) return defaultPath;

  return null;
}

export function resolveConfigPathOrError(): string {
  const configPath = resolveConfigPath();
  if (!configPath) {
    return "No Neovim configuration directory found. Checked: $XDG_CONFIG_HOME/nvim, ~/.config/nvim. Set your config path in Raycast Settings > Extensions > Neovim Expert.";
  }
  return configPath;
}

export function validatePath(configDir: string, relativePath: string): string | null {
  if (relativePath.startsWith("/")) return null;

  const resolved = resolve(configDir, normalize(relativePath));

  if (!resolved.startsWith(configDir + "/") && resolved !== configDir) {
    return null;
  }

  return resolved;
}
