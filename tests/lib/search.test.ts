import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listFiles, grepFiles, extractKeybindings } from "../../src/lib/search";
import { resolve, join } from "node:path";
import { mkdirSync, writeFileSync, chmodSync, rmSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as fs from "node:fs";

const fixtures = resolve(__dirname, "../../tests/fixtures");
const lazyFixture = resolve(fixtures, "lazy-nvim");
const vimPlugFixture = resolve(fixtures, "vim-plug");

describe("listFiles", () => {
  it("lists all files in a directory recursively", () => {
    const files = listFiles(lazyFixture);
    expect(files.map((f) => f.relativePath)).toContain("init.lua");
    expect(files.map((f) => f.relativePath)).toContain("lazy-lock.json");
    expect(files.map((f) => f.relativePath)).toContain("lua/plugins/editor.lua");
    expect(files.map((f) => f.relativePath)).toContain("lua/config/keymaps.lua");
  });

  it("scopes to a subdirectory", () => {
    const files = listFiles(lazyFixture, "lua/plugins");
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe("lua/plugins/editor.lua");
  });

  it("excludes .git directories", () => {
    const files = listFiles(lazyFixture);
    const gitFiles = files.filter((f) => f.relativePath.startsWith(".git/"));
    expect(gitFiles).toHaveLength(0);
  });

  it("includes file sizes", () => {
    const files = listFiles(lazyFixture);
    const initLua = files.find((f) => f.relativePath === "init.lua");
    expect(initLua).toBeDefined();
    expect(initLua!.size).toBeGreaterThan(0);
  });
});

describe("grepFiles", () => {
  it("finds matching lines across files", () => {
    const results = grepFiles(lazyFixture, "keymap.set");
    expect(results.length).toBeGreaterThanOrEqual(4);
    expect(results[0]).toHaveProperty("file");
    expect(results[0]).toHaveProperty("line");
    expect(results[0]).toHaveProperty("lineNumber");
  });

  it("is case-insensitive", () => {
    const results = grepFiles(lazyFixture, "KEYMAP.SET");
    expect(results.length).toBeGreaterThanOrEqual(4);
  });

  it("filters by file pattern", () => {
    const results = grepFiles(lazyFixture, "vim", "*.lua");
    const files = [...new Set(results.map((r) => r.file))];
    expect(files.every((f) => f.endsWith(".lua"))).toBe(true);
  });

  it("caps results at maxResults", () => {
    const results = grepFiles(lazyFixture, "vim", undefined, 2);
    expect(results).toHaveLength(2);
  });
});

describe("extractKeybindings", () => {
  it("extracts vim.keymap.set bindings from Lua files", () => {
    const bindings = extractKeybindings(lazyFixture);
    const jjBinding = bindings.find((b) => b.key === "jj");
    expect(jjBinding).toBeDefined();
    expect(jjBinding!.mode).toBe("i");
    expect(jjBinding!.file).toBe("lua/config/keymaps.lua");
  });

  it("extracts map/nmap/imap bindings from vimscript", () => {
    const bindings = extractKeybindings(vimPlugFixture);
    const ffBinding = bindings.find((b) => b.key === "<leader>ff");
    expect(ffBinding).toBeDefined();
    expect(ffBinding!.mode).toBe("n");
  });

  it("extracts keys from lazy.nvim plugin specs", () => {
    const bindings = extractKeybindings(lazyFixture);
    const telescopeBinding = bindings.find((b) => b.key === "<leader>ff");
    expect(telescopeBinding).toBeDefined();
    expect(telescopeBinding!.file).toBe("lua/plugins/editor.lua");
  });

  it("filters by query", () => {
    const bindings = extractKeybindings(lazyFixture, "jj");
    expect(bindings).toHaveLength(1);
    expect(bindings[0].key).toBe("jj");
  });

  it("extracts all vim mode mappings (v, x, o, s, t, c)", () => {
    let tmpDir: string;
    tmpDir = mkdtempSync(join(tmpdir(), "search-vim-modes-"));

    const vimContent = [
      "vmap <leader>v :visual",
      "xmap <leader>x :xmode",
      "omap <leader>o :omode",
      "smap <leader>s :smode",
      "tmap <leader>t :tmode",
      "cmap <leader>c :cmode",
      "nmap <leader>n :nmode",
    ].join("\n");

    writeFileSync(join(tmpDir, "mappings.vim"), vimContent);

    const bindings = extractKeybindings(tmpDir);

    const findMode = (mode: string) => bindings.find((b) => b.mode === mode);
    expect(findMode("v")).toBeDefined();
    expect(findMode("v")!.key).toBe("<leader>v");
    expect(findMode("x")).toBeDefined();
    expect(findMode("o")).toBeDefined();
    expect(findMode("s")).toBeDefined();
    expect(findMode("t")).toBeDefined();
    expect(findMode("c")).toBeDefined();
    expect(findMode("n")).toBeDefined();

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("deduplicates lazy keys that match vim.keymap.set bindings", () => {
    let tmpDir: string;
    tmpDir = mkdtempSync(join(tmpdir(), "search-dedup-"));

    // Create a lua file where the same key appears in both vim.keymap.set
    // and lazy keys spec format — the dedup branch should skip the second
    const luaContent = [
      'vim.keymap.set("n", "<leader>ff", ":Telescope find_files", { desc = "Find files" })',
      '{ "<leader>ff", ":Telescope find_files", desc = "Find files" }',
    ].join("\n");

    writeFileSync(join(tmpDir, "keys.lua"), luaContent);

    const bindings = extractKeybindings(tmpDir);
    const ffBindings = bindings.filter((b) => b.key === "<leader>ff");
    // Should have only one entry due to dedup
    expect(ffBindings).toHaveLength(1);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("listFiles error handling", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "search-list-test-"));
  });

  afterEach(() => {
    const restorePerms = (dir: string) => {
      try {
        chmodSync(dir, 0o755);
        for (const entry of fs.readdirSync(dir)) {
          const full = join(dir, entry);
          try {
            if (fs.statSync(full).isDirectory()) restorePerms(full);
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    };
    restorePerms(tmpDir);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("handles unreadable subdirectories gracefully", () => {
    // Create a dir with a readable file and an unreadable subdirectory
    writeFileSync(join(tmpDir, "init.lua"), "-- top level\n");
    const subDir = join(tmpDir, "lua");
    mkdirSync(subDir);
    writeFileSync(join(subDir, "hidden.lua"), "-- hidden\n");
    chmodSync(subDir, 0o000);

    const files = listFiles(tmpDir);
    // Should only find the top-level file, not crash
    expect(files.map((f) => f.relativePath)).toContain("init.lua");
    expect(files.map((f) => f.relativePath)).not.toContain("lua/hidden.lua");
  });

  it("handles stat errors on individual entries", () => {
    // Create a broken symlink — statSync will throw ENOENT
    writeFileSync(join(tmpDir, "real.lua"), "-- real file\n");
    const { symlinkSync } = require("node:fs");
    symlinkSync(join(tmpDir, "nonexistent-target"), join(tmpDir, "broken.lua"));

    const files = listFiles(tmpDir);
    // Should skip the broken symlink and still list the real file
    expect(files.map((f) => f.relativePath)).toContain("real.lua");
    expect(files).toHaveLength(1);
  });

  it("returns empty array for nonexistent directory", () => {
    const files = listFiles(join(tmpDir, "nonexistent"));
    expect(files).toEqual([]);
  });

  it("excludes .git, node_modules, plugin, and .DS_Store directories", () => {
    writeFileSync(join(tmpDir, "init.lua"), "-- top\n");

    for (const excluded of [".git", "node_modules", "plugin", ".DS_Store"]) {
      const dir = join(tmpDir, excluded);
      mkdirSync(dir);
      writeFileSync(join(dir, "should-skip.lua"), "-- excluded\n");
    }

    const files = listFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe("init.lua");
  });
});

describe("error handling", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "search-test-"));
  });

  afterEach(() => {
    // Restore permissions before cleanup
    const restorePerms = (dir: string) => {
      try {
        chmodSync(dir, 0o755);
        for (const entry of fs.readdirSync(dir)) {
          const full = join(dir, entry);
          try {
            if (fs.statSync(full).isDirectory()) restorePerms(full);
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    };
    restorePerms(tmpDir);
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("grepFiles skips files that cannot be read", () => {
    // Create two files, make one unreadable via chmod
    writeFileSync(join(tmpDir, "good.lua"), 'vim.keymap.set("n", "<leader>f", ":find")\n');
    writeFileSync(join(tmpDir, "bad.lua"), "this should not be read\n");
    chmodSync(join(tmpDir, "bad.lua"), 0o000);

    const results = grepFiles(tmpDir, "keymap");
    // Only the readable file should produce results
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe("good.lua");
  });

  it("extractKeybindings skips files that cannot be read", () => {
    // Create two lua files, make one unreadable via chmod
    writeFileSync(join(tmpDir, "real.lua"), 'vim.keymap.set("n", "<leader>x", ":quit")\n');
    writeFileSync(join(tmpDir, "unreadable.lua"), 'vim.keymap.set("n", "<leader>y", ":write")\n');
    chmodSync(join(tmpDir, "unreadable.lua"), 0o000);

    const bindings = extractKeybindings(tmpDir);
    // Only the readable file should produce bindings
    expect(bindings).toHaveLength(1);
    expect(bindings[0].key).toBe("<leader>x");
  });
});
