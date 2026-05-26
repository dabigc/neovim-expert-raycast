import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectPluginManager } from "../../src/lib/discovery";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

  describe("error handling in scanForPattern", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "discovery-test-"));
    });

    afterEach(() => {
      // Restore permissions on all subdirs before cleanup
      const restorePerms = (dir: string) => {
        try {
          chmodSync(dir, 0o755);
          for (const entry of require("node:fs").readdirSync(dir)) {
            const full = join(dir, entry);
            try {
              if (require("node:fs").statSync(full).isDirectory()) restorePerms(full);
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      };
      restorePerms(tmpDir);
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("handles unreadable directories gracefully", () => {
      // Create a config dir with an unreadable subdirectory
      const luaDir = join(tmpDir, "lua");
      mkdirSync(luaDir);
      writeFileSync(join(luaDir, "init.lua"), "-- nothing here");
      // Make the lua subdir unreadable
      const subDir = join(luaDir, "plugins");
      mkdirSync(subDir);
      writeFileSync(join(subDir, "test.lua"), 'require("packer")');
      chmodSync(subDir, 0o000);

      // Should not throw, should return none since it can't read the dir with the match
      const result = detectPluginManager(tmpDir);
      // It either finds it in accessible files or returns none — doesn't crash
      expect(result).toBeDefined();
      expect(result.name).toBeDefined();
    });

    it("handles unreadable top-level config directory gracefully", () => {
      // Pass a directory that doesn't exist — readdirSync will throw
      const result = detectPluginManager(join(tmpDir, "nonexistent"));
      expect(result).toEqual({
        name: "none",
        indicator: "no plugin manager detected",
      });
    });

    it("handles stat errors on individual entries gracefully", () => {
      // Create a dir with a symlink pointing to nothing (stat will throw)
      const luaDir = join(tmpDir, "lua");
      mkdirSync(luaDir);
      const { symlinkSync } = require("node:fs");
      symlinkSync(join(tmpDir, "nonexistent-target"), join(luaDir, "broken.lua"));

      const result = detectPluginManager(tmpDir);
      // Should not throw, just skips the broken symlink
      expect(result).toBeDefined();
      expect(result.name).toBe("none");
    });

    it("skips .git and node_modules directories", () => {
      // Create a .git dir with a packer reference — should be skipped
      const gitDir = join(tmpDir, ".git");
      mkdirSync(gitDir);
      writeFileSync(join(gitDir, "test.lua"), 'require("packer")');

      // Create a node_modules dir with a packer reference — should be skipped
      const nmDir = join(tmpDir, "node_modules");
      mkdirSync(nmDir);
      writeFileSync(join(nmDir, "test.lua"), 'require("packer")');

      const result = detectPluginManager(tmpDir);
      expect(result.name).toBe("none");
    });

    it("respects max depth limit", () => {
      // Create a deeply nested directory structure (deeper than maxDepth=3)
      let dir = tmpDir;
      for (let i = 0; i < 5; i++) {
        dir = join(dir, `level${i}`);
        mkdirSync(dir);
      }
      writeFileSync(join(dir, "plugins.lua"), 'require("packer")');

      const result = detectPluginManager(tmpDir);
      // Should not find the deeply nested packer require
      expect(result.name).toBe("none");
    });
  });
});
