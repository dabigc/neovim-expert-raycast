import { describe, it, expect } from "vitest";
import { parseLazyLock, scanPackerPlugins, scanVimPlugPlugins, scanLuaPluginSpecs } from "../../src/lib/parsers";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fixtures = resolve(__dirname, "../../tests/fixtures");

describe("parseLazyLock", () => {
  it("parses lazy-lock.json into plugin list", () => {
    const content = readFileSync(resolve(fixtures, "lazy-nvim/lazy-lock.json"), "utf-8");
    const plugins = parseLazyLock(content);
    expect(plugins).toHaveLength(5);
    expect(plugins).toContainEqual({
      name: "telescope.nvim",
      branch: "master",
      commit: "e4f5a6b",
    });
    expect(plugins).toContainEqual({
      name: "LazyVim",
      branch: "main",
      commit: "a1b2c3d",
    });
  });

  it("returns empty array for invalid JSON", () => {
    const plugins = parseLazyLock("not json");
    expect(plugins).toEqual([]);
  });
});

describe("scanPackerPlugins", () => {
  it("extracts plugin names from use() calls", () => {
    const content = readFileSync(resolve(fixtures, "packer/lua/plugins.lua"), "utf-8");
    const plugins = scanPackerPlugins(content);
    expect(plugins).toContainEqual({ name: "packer.nvim" });
    expect(plugins).toContainEqual({ name: "telescope.nvim" });
    expect(plugins).toContainEqual({ name: "nvim-treesitter" });
    expect(plugins).toHaveLength(3);
  });

  it("handles plugin names without org prefix (no slash)", () => {
    const content = `
      use 'standalone-plugin'
      use 'another-plugin'
    `;
    const plugins = scanPackerPlugins(content);
    expect(plugins).toContainEqual({ name: "standalone-plugin" });
    expect(plugins).toContainEqual({ name: "another-plugin" });
    expect(plugins).toHaveLength(2);
  });

  it("deduplicates plugins across both use patterns", () => {
    const content = `
      use 'my-plugin'
      use { 'my-plugin' }
    `;
    const plugins = scanPackerPlugins(content);
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("my-plugin");
  });
});

describe("scanVimPlugPlugins", () => {
  it("extracts plugin names from Plug calls", () => {
    const content = readFileSync(resolve(fixtures, "vim-plug/init.vim"), "utf-8");
    const plugins = scanVimPlugPlugins(content);
    expect(plugins).toContainEqual({ name: "fzf" });
    expect(plugins).toContainEqual({ name: "fzf.vim" });
    expect(plugins).toContainEqual({ name: "vim-fugitive" });
    expect(plugins).toHaveLength(3);
  });

  it("handles plugin names without org prefix (no slash)", () => {
    const content = `
      call plug#begin()
      Plug 'standalone-vim-plugin'
      Plug 'another-standalone'
      call plug#end()
    `;
    const plugins = scanVimPlugPlugins(content);
    expect(plugins).toContainEqual({ name: "standalone-vim-plugin" });
    expect(plugins).toContainEqual({ name: "another-standalone" });
    expect(plugins).toHaveLength(2);
  });
});

describe("scanLuaPluginSpecs", () => {
  it("extracts plugin names from Lua string specs", () => {
    const content = readFileSync(resolve(fixtures, "lazy-nvim/lua/plugins/editor.lua"), "utf-8");
    const plugins = scanLuaPluginSpecs(content);
    expect(plugins).toContainEqual({ name: "telescope.nvim" });
    expect(plugins).toContainEqual({ name: "gitsigns.nvim" });
  });
});
