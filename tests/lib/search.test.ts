import { describe, it, expect } from "vitest";
import { listFiles, grepFiles, extractKeybindings } from "../../src/lib/search";
import { resolve } from "node:path";

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
});
