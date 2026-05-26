import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { getPreferenceValues } from "@raycast/api";

const fixtures = resolve(__dirname, "../fixtures");

// The vitest.config.ts aliases @raycast/api to __mocks__/@raycast/api.ts which
// exports getPreferenceValues as a vi.fn(). We just configure its return value per test.

// Save/restore XDG_CONFIG_HOME so "no config" tests don't leak
let savedXDG: string | undefined;

beforeEach(() => {
  savedXDG = process.env.XDG_CONFIG_HOME;
  vi.mocked(getPreferenceValues).mockReset();
});

afterEach(() => {
  if (savedXDG !== undefined) {
    process.env.XDG_CONFIG_HOME = savedXDG;
  } else {
    delete process.env.XDG_CONFIG_HOME;
  }
  if (savedHOME !== undefined) {
    process.env.HOME = savedHOME;
    savedHOME = undefined;
  }
});

/**
 * Helper: configure the mock so resolveConfigPath() returns the given fixture path.
 */
function useFixture(name: string) {
  const p = resolve(fixtures, name);
  vi.mocked(getPreferenceValues).mockReturnValue({ configPath: p });
  return p;
}

/**
 * Helper: configure mocks so resolveConfigPath() returns null.
 * Points configPath at a nonexistent directory, clears XDG, and
 * temporarily overrides HOME so the ~/.config/nvim fallback also fails.
 */
let savedHOME: string | undefined;

function useNoConfig() {
  vi.mocked(getPreferenceValues).mockReturnValue({
    configPath: "/tmp/__neovim_expert_nonexistent_dir__",
  });
  delete process.env.XDG_CONFIG_HOME;
  savedHOME = process.env.HOME;
  process.env.HOME = "/tmp/__neovim_expert_nonexistent_home__";
}

// ─── getConfigSummary ────────────────────────────────────────────────────────

describe("getConfigSummary", () => {
  it("returns error when no config found", async () => {
    useNoConfig();
    const { default: tool } = await import("../../src/tools/getConfigSummary");
    const result = await tool();
    expect(result).toContain("No Neovim configuration");
    expect(result).toContain("Raycast Settings");
  });

  it("returns summary for lazy.nvim config", async () => {
    const fixturePath = useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/getConfigSummary");
    const result = await tool();
    expect(result).toContain("Neovim Configuration Summary");
    expect(result).toContain(fixturePath);
    expect(result).toContain("lazy.nvim");
    expect(result).toContain("lazy-lock.json");
    expect(result).toContain("init.lua");
    expect(result).toContain("lua/");
    expect(result).toContain("Plugin Manager:");
    expect(result).toContain("Total files:");
    expect(result).toContain("Directories:");
    expect(result).toContain("Key files:");
  });

  it("includes lua/config files in key files", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/getConfigSummary");
    const result = await tool();
    expect(result).toContain("lua/config/keymaps.lua");
    expect(result).toContain("lua/config/options.lua");
  });

  it("works with minimal config (no lazy-lock, no plugin manager)", async () => {
    useFixture("minimal");
    const { default: tool } = await import("../../src/tools/getConfigSummary");
    const result = await tool();
    expect(result).toContain("Neovim Configuration Summary");
    expect(result).toContain("init.lua");
    expect(result).not.toContain("lazy-lock.json");
  });

  it("works with packer config", async () => {
    useFixture("packer");
    const { default: tool } = await import("../../src/tools/getConfigSummary");
    const result = await tool();
    expect(result).toContain("packer");
    expect(result).toContain("init.lua");
  });

  it("works with vim-plug config", async () => {
    useFixture("vim-plug");
    const { default: tool } = await import("../../src/tools/getConfigSummary");
    const result = await tool();
    expect(result).toContain("vim-plug");
    expect(result).toContain("init.vim");
  });

  it("handles statSync failure gracefully for top-level entries", async () => {
    // Create a config dir where a file listed by listFiles has a top-level
    // component that disappears between listing and statSync (race condition).
    // We simulate this by creating a symlink to a nonexistent target.
    const { mkdirSync, writeFileSync, symlinkSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_statsync_fail_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(resolve(tmpDir, "init.lua"), "-- test");
    // Create a broken symlink so statSync throws
    symlinkSync("/tmp/__nonexistent_target__", resolve(tmpDir, "broken-link"));

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/getConfigSummary");
    const result = await tool();
    expect(result).toContain("Neovim Configuration Summary");
    // broken-link should not appear in Directories since statSync fails
    expect(result).not.toContain("broken-link/");

    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });
});

// ─── listConfigFiles ─────────────────────────────────────────────────────────

describe("listConfigFiles", () => {
  it("returns error when no config found", async () => {
    useNoConfig();
    const { default: tool } = await import("../../src/tools/listConfigFiles");
    const result = await tool({});
    expect(result).toContain("No Neovim configuration");
  });

  it("lists all files when no subdirectory specified", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/listConfigFiles");
    const result = await tool({});
    expect(result).toContain("All config files");
    expect(result).toContain("init.lua");
    expect(result).toContain("lazy-lock.json");
  });

  it("lists files in a subdirectory", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/listConfigFiles");
    const result = await tool({ subdirectory: "lua/config" });
    expect(result).toContain("Files in lua/config");
    expect(result).toContain("keymaps.lua");
    expect(result).toContain("options.lua");
  });

  it("returns 'no files found' with scope for nonexistent subdirectory", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/listConfigFiles");
    const result = await tool({ subdirectory: "nonexistent" });
    expect(result).toContain("No files found");
    expect(result).toContain("in nonexistent");
  });

  it("returns 'no files found' without scope when no subdirectory and empty dir", async () => {
    const { mkdirSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_empty_cfg_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(tmpDir, { recursive: true });

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/listConfigFiles");
    const result = await tool({});
    expect(result).toBe("No files found.");

    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });

  it("formats file sizes in bytes for small files", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/listConfigFiles");
    const result = await tool({});
    expect(result).toMatch(/\d+B/);
  });

  it("shows file count in header", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/listConfigFiles");
    const result = await tool({});
    // Header format: "All config files (N):"
    expect(result).toMatch(/All config files \(\d+\):/);
  });

  it("formats file sizes in KB for larger files", async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_large_file_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(tmpDir, { recursive: true });
    // Create a file larger than 1024 bytes
    writeFileSync(resolve(tmpDir, "large.lua"), "x".repeat(2048));

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/listConfigFiles");
    const result = await tool({});
    expect(result).toContain("2.0KB");

    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });
});

// ─── readConfigFile ──────────────────────────────────────────────────────────

describe("readConfigFile", () => {
  it("returns error when no config found", async () => {
    useNoConfig();
    const { default: tool } = await import("../../src/tools/readConfigFile");
    const result = await tool({ filePath: "init.lua" });
    expect(result).toContain("No Neovim configuration");
  });

  it("reads a valid config file", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/readConfigFile");
    const result = await tool({ filePath: "init.lua" });
    expect(result).toContain("File: init.lua");
    expect(result).toContain('require("config.lazy")');
  });

  it("reads nested config files", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/readConfigFile");
    const result = await tool({ filePath: "lua/config/keymaps.lua" });
    expect(result).toContain("File: lua/config/keymaps.lua");
    expect(result).toContain("vim.keymap.set");
    expect(result).toContain("Exit insert mode");
  });

  it("rejects path traversal attempts", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/readConfigFile");
    const result = await tool({ filePath: "../../package.json" });
    expect(result).toContain("Invalid path");
    expect(result).toContain("outside the config directory");
  });

  it("rejects absolute paths", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/readConfigFile");
    const result = await tool({ filePath: "/etc/passwd" });
    expect(result).toContain("Invalid path");
  });

  it("returns 'file not found' for nonexistent file", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/readConfigFile");
    const result = await tool({ filePath: "nonexistent.lua" });
    expect(result).toContain("File not found");
    expect(result).toContain("listConfigFiles");
  });

  it("reads .vim files", async () => {
    useFixture("vim-plug");
    const { default: tool } = await import("../../src/tools/readConfigFile");
    const result = await tool({ filePath: "init.vim" });
    expect(result).toContain("File: init.vim");
    expect(result).toContain("plug#begin");
  });
});

// ─── listPlugins ─────────────────────────────────────────────────────────────

describe("listPlugins", () => {
  it("returns error when no config found", async () => {
    useNoConfig();
    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("No Neovim configuration");
  });

  it("lists plugins from lazy.nvim lock file", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("plugin(s)");
    expect(result).toContain("lazy.nvim");
    expect(result).toContain("telescope.nvim");
    expect(result).toContain("nvim-treesitter");
    expect(result).toContain("nvim-lspconfig");
    expect(result).toContain("gitsigns.nvim");
    expect(result).toContain("LazyVim");
  });

  it("shows branch and commit info for lazy.nvim plugins", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toMatch(/\[main\]/);
    expect(result).toMatch(/\[master\]/);
    expect(result).toMatch(/@ [a-f0-9]{7}/);
  });

  it("lists plugins from packer config", async () => {
    useFixture("packer");
    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("plugin(s)");
    expect(result).toContain("packer");
    expect(result).toContain("telescope.nvim");
    expect(result).toContain("nvim-treesitter");
  });

  it("lists plugins from vim-plug config", async () => {
    useFixture("vim-plug");
    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("plugin(s)");
    expect(result).toContain("vim-plug");
    expect(result).toContain("fzf");
    expect(result).toContain("vim-fugitive");
  });

  it("falls back to lua scanning for unknown plugin manager (no plugins)", async () => {
    useFixture("minimal");
    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("No plugins detected");
  });

  it("returns no plugins when lazy-lock.json has invalid JSON", async () => {
    // parseLazyLock returns [] on invalid JSON (doesn't throw), so plugins = []
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_broken_lock_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(resolve(tmpDir, "lua/plugins"), { recursive: true });
    writeFileSync(resolve(tmpDir, "init.lua"), 'require("lazy").setup()');
    writeFileSync(resolve(tmpDir, "lazy-lock.json"), "NOT VALID JSON {{{");

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("No plugins detected");

    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });

  it("falls back to lua scanning when lazy-lock.json is unreadable", async () => {
    // When readFileSync throws, the catch block falls back to scanAllLuaFiles
    const { mkdirSync, writeFileSync, chmodSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_unreadable_lock_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(resolve(tmpDir, "lua/plugins"), { recursive: true });
    writeFileSync(resolve(tmpDir, "init.lua"), 'require("lazy").setup()');
    writeFileSync(
      resolve(tmpDir, "lua/plugins/test.lua"),
      'return { { "some-user/test-plugin.nvim" } }'
    );
    // Create lock file then make it unreadable
    writeFileSync(resolve(tmpDir, "lazy-lock.json"), "{}");
    chmodSync(resolve(tmpDir, "lazy-lock.json"), 0o000);

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("test-plugin.nvim");

    // Restore permissions for cleanup
    chmodSync(resolve(tmpDir, "lazy-lock.json"), 0o644);
    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });

  it("sorts plugins alphabetically", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    const lines = result.split("\n").filter((l: string) => l.startsWith("- "));
    const names = lines.map((l: string) => l.replace(/^- /, "").split(" ")[0]);
    const sorted = [...names].sort((a: string, b: string) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("deduplicates plugins in lua fallback scanning", async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_dedup_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(resolve(tmpDir, "lua/plugins"), { recursive: true });
    writeFileSync(resolve(tmpDir, "init.lua"), "-- minimal");
    // Same plugin referenced in two files
    writeFileSync(
      resolve(tmpDir, "lua/plugins/a.lua"),
      'return { { "user/same-plugin.nvim" } }'
    );
    writeFileSync(
      resolve(tmpDir, "lua/plugins/b.lua"),
      'return { { "user/same-plugin.nvim" } }'
    );

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    // Should only appear once despite being in two files
    const matches = result.match(/same-plugin\.nvim/g);
    expect(matches).toHaveLength(1);

    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });

  it("skips unreadable files during packer scanning", async () => {
    const { mkdirSync, writeFileSync, chmodSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_packer_unreadable_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(resolve(tmpDir, "lua"), { recursive: true });
    // Make it detected as packer
    writeFileSync(resolve(tmpDir, "init.lua"), "require('packer')");
    // One readable plugin file
    writeFileSync(
      resolve(tmpDir, "lua/plugins.lua"),
      "use 'nvim-telescope/telescope.nvim'"
    );
    // One unreadable lua file
    writeFileSync(resolve(tmpDir, "lua/broken.lua"), "use 'user/broken.nvim'");
    chmodSync(resolve(tmpDir, "lua/broken.lua"), 0o000);

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("telescope.nvim");
    // broken.nvim should be skipped, not crash
    expect(result).not.toContain("broken.nvim");

    chmodSync(resolve(tmpDir, "lua/broken.lua"), 0o644);
    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });

  it("skips unreadable files during vim-plug scanning", async () => {
    const { mkdirSync, writeFileSync, chmodSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_vimplug_unreadable_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(tmpDir, { recursive: true });
    // Make it detected as vim-plug
    writeFileSync(resolve(tmpDir, "init.vim"), "call plug#begin()\nPlug 'tpope/vim-fugitive'\ncall plug#end()");
    // One unreadable vim file
    writeFileSync(resolve(tmpDir, "broken.vim"), "Plug 'user/broken.nvim'");
    chmodSync(resolve(tmpDir, "broken.vim"), 0o000);

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("vim-fugitive");
    expect(result).not.toContain("broken.nvim");

    chmodSync(resolve(tmpDir, "broken.vim"), 0o644);
    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });

  it("scans .lua files in vim-plug configs too", async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_vimplug_lua_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(tmpDir, { recursive: true });
    // Make it detected as vim-plug
    writeFileSync(resolve(tmpDir, "init.vim"), "call plug#begin()\ncall plug#end()");
    // Add a lua file with Plug calls
    writeFileSync(resolve(tmpDir, "extra.lua"), "Plug 'user/lua-declared-plugin.nvim'");

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("lua-declared-plugin.nvim");

    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });

  it("skips unreadable files during lua fallback scanning", async () => {
    const { mkdirSync, writeFileSync, chmodSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_lua_fallback_unreadable_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(resolve(tmpDir, "lua/plugins"), { recursive: true });
    writeFileSync(resolve(tmpDir, "init.lua"), "-- no plugin manager");
    // One readable file with a plugin
    writeFileSync(
      resolve(tmpDir, "lua/plugins/good.lua"),
      'return { { "user/good-plugin.nvim" } }'
    );
    // One unreadable file
    writeFileSync(
      resolve(tmpDir, "lua/plugins/bad.lua"),
      'return { { "user/bad-plugin.nvim" } }'
    );
    chmodSync(resolve(tmpDir, "lua/plugins/bad.lua"), 0o000);

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/listPlugins");
    const result = await tool();
    expect(result).toContain("good-plugin.nvim");
    expect(result).not.toContain("bad-plugin.nvim");

    chmodSync(resolve(tmpDir, "lua/plugins/bad.lua"), 0o644);
    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });
});

// ─── searchConfig ────────────────────────────────────────────────────────────

describe("searchConfig", () => {
  it("returns error when no config found", async () => {
    useNoConfig();
    const { default: tool } = await import("../../src/tools/searchConfig");
    const result = await tool({ query: "test" });
    expect(result).toContain("No Neovim configuration");
  });

  it("finds matches in config files", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchConfig");
    const result = await tool({ query: "keymap" });
    expect(result).toContain("match(es)");
    expect(result).toContain("keymap");
  });

  it("returns no matches for nonexistent term", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchConfig");
    const result = await tool({ query: "xyznonexistent123" });
    expect(result).toContain("No matches found");
    expect(result).toContain('"xyznonexistent123"');
  });

  it("includes file pattern scope in no-match message", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchConfig");
    const result = await tool({ query: "xyznonexistent123", filePattern: "*.vim" });
    expect(result).toContain("No matches found");
    expect(result).toContain("in *.vim files");
  });

  it("searches with file pattern filter", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchConfig");
    const result = await tool({ query: "require", filePattern: "*.lua" });
    expect(result).toContain("match(es)");
    expect(result).toContain("require");
  });

  it("shows file and line number in results", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchConfig");
    const result = await tool({ query: "vim.opt" });
    expect(result).toMatch(/\.lua:\d+:/);
  });

  it("shows no scope in no-match message when no file pattern", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchConfig");
    const result = await tool({ query: "xyznonexistent123" });
    expect(result).not.toContain("in ");
    expect(result).toContain('No matches found for "xyznonexistent123".');
  });
});

// ─── searchKeybindings ───────────────────────────────────────────────────────

describe("searchKeybindings", () => {
  it("returns error when no config found", async () => {
    useNoConfig();
    const { default: tool } = await import("../../src/tools/searchKeybindings");
    const result = await tool({});
    expect(result).toContain("No Neovim configuration");
  });

  it("finds all keybindings when no query provided", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchKeybindings");
    const result = await tool({});
    expect(result).toContain("keybinding(s)");
    expect(result).toContain("<leader>w");
    expect(result).toContain("jj");
  });

  it("filters keybindings by query", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchKeybindings");
    const result = await tool({ query: "Save" });
    expect(result).toContain("keybinding(s)");
    expect(result).toContain('matching "Save"');
    expect(result).toContain("<leader>w");
  });

  it("shows mode, key, action, and file in output", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchKeybindings");
    const result = await tool({});
    // Format: [mode] key -> action (desc)  (file)
    expect(result).toMatch(/\[.\]/);    // mode in brackets
    expect(result).toContain("→"); // arrow (→) between key and action
  });

  it("shows desc in parentheses when present", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchKeybindings");
    const result = await tool({});
    expect(result).toContain("(Exit insert mode)");
    expect(result).toContain("(Save file)");
  });

  it("returns no keybindings message with scope when query has no match", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchKeybindings");
    const result = await tool({ query: "xyznonexistent123" });
    expect(result).toContain("No keybindings found");
    expect(result).toContain('matching "xyznonexistent123"');
  });

  it("returns no keybindings message without scope when no query and no bindings", async () => {
    // Use an empty config dir with no keybindings
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const tmpDir = "/tmp/__neovim_expert_no_keybindings_test__";
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(resolve(tmpDir, "init.lua"), "-- no keybindings here");

    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: tmpDir });

    const { default: tool } = await import("../../src/tools/searchKeybindings");
    const result = await tool({});
    expect(result).toBe("No keybindings found.");

    try { rmSync(tmpDir, { recursive: true }); } catch {}
  });

  it("finds keybindings in vim-plug config", async () => {
    useFixture("vim-plug");
    const { default: tool } = await import("../../src/tools/searchKeybindings");
    const result = await tool({});
    expect(result).toContain("keybinding(s)");
  });

  it("header includes query when filtering", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchKeybindings");
    const result = await tool({ query: "Esc" });
    expect(result).toContain('matching "Esc"');
  });

  it("header omits query clause when no query", async () => {
    useFixture("lazy-nvim");
    const { default: tool } = await import("../../src/tools/searchKeybindings");
    const result = await tool({});
    expect(result).not.toContain("matching");
  });
});
