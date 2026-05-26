export interface PluginEntry {
  name: string;
  branch?: string;
  commit?: string;
}

export function parseLazyLock(content: string): PluginEntry[] {
  try {
    const lock = JSON.parse(content) as Record<string, { branch?: string; commit?: string }>;
    return Object.entries(lock).map(([name, info]) => ({
      name,
      branch: info.branch,
      commit: info.commit,
    }));
  } catch {
    return [];
  }
}

export function scanPackerPlugins(content: string): PluginEntry[] {
  const plugins: PluginEntry[] = [];
  const patterns = [/use\s+['"]([^'"]+)['"]/g, /use\s*\{\s*['"]([^'"]+)['"]/g];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const fullName = match[1];
      const name = fullName.includes("/") ? fullName.split("/").pop()! : fullName;
      if (!plugins.some((p) => p.name === name)) {
        plugins.push({ name });
      }
    }
  }

  return plugins;
}

export function scanVimPlugPlugins(content: string): PluginEntry[] {
  const plugins: PluginEntry[] = [];
  const pattern = /Plug\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const fullName = match[1];
    const name = fullName.includes("/") ? fullName.split("/").pop()! : fullName;
    plugins.push({ name });
  }

  return plugins;
}

export function scanLuaPluginSpecs(content: string): PluginEntry[] {
  const plugins: PluginEntry[] = [];
  const pattern = /["']([a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+)["']/g;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const fullName = match[1];
    const name = fullName.split("/").pop()!;
    if (!plugins.some((p) => p.name === name)) {
      plugins.push({ name });
    }
  }

  return plugins;
}
