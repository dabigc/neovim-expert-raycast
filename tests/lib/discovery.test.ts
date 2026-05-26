import { describe, it, expect } from "vitest";
import { detectPluginManager } from "../../src/lib/discovery";
import { resolve } from "node:path";

const fixtures = resolve(__dirname, "../../tests/fixtures");

describe("detectPluginManager", () => {
  it("detects lazy.nvim by lazy-lock.json", () => {
    const result = detectPluginManager(resolve(fixtures, "lazy-nvim"));
    expect(result).toEqual({
      name: "lazy.nvim",
      indicator: "lazy-lock.json",
    });
  });

  it("detects packer by packer require", () => {
    const result = detectPluginManager(resolve(fixtures, "packer"));
    expect(result).toEqual({
      name: "packer",
      indicator: "packer require found in lua/plugins.lua",
    });
  });

  it("detects vim-plug by plug#begin", () => {
    const result = detectPluginManager(resolve(fixtures, "vim-plug"));
    expect(result).toEqual({
      name: "vim-plug",
      indicator: "plug#begin found in init.vim",
    });
  });

  it("returns none for minimal config", () => {
    const result = detectPluginManager(resolve(fixtures, "minimal"));
    expect(result).toEqual({
      name: "none",
      indicator: "no plugin manager detected",
    });
  });
});
