/**
 * Edge-case test for getConfigSummary's statSync catch block (lines 22-24).
 *
 * Uses vi.mock("node:fs") to intercept statSync and force it to throw
 * for a specific top-level directory entry, exercising the catch { return false }
 * branch in getConfigSummary.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve, join } from "node:path";

const fixtures = resolve(__dirname, "../fixtures");

describe("getConfigSummary statSync catch branch", () => {
  let savedXDG: string | undefined;

  beforeEach(() => {
    savedXDG = process.env.XDG_CONFIG_HOME;
    vi.resetModules();
  });

  afterEach(() => {
    if (savedXDG !== undefined) {
      process.env.XDG_CONFIG_HOME = savedXDG;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });

  it("catches statSync errors for top-level entries and excludes them from directories", async () => {
    const fixturePath = resolve(fixtures, "lazy-nvim");
    const luaPath = join(fixturePath, "lua");

    // Mock @raycast/api
    vi.doMock("@raycast/api", () => ({
      getPreferenceValues: vi.fn().mockReturnValue({ configPath: fixturePath }),
    }));

    // Store reference to real fs functions
    const realFs = await vi.importActual<typeof import("node:fs")>("node:fs");

    // Mock node:fs to intercept statSync
    vi.doMock("node:fs", () => {
      // Track if we are past the listFiles phase. getConfigSummary calls
      // listFiles first (which walks the tree), then calls statSync again
      // on each unique top-level entry. We count calls to statSync with
      // the lua path and throw on later calls.
      let luaStatCalls = 0;
      return {
        ...realFs,
        existsSync: realFs.existsSync,
        readFileSync: realFs.readFileSync,
        readdirSync: realFs.readdirSync,
        statSync: (p: string | Buffer, ...args: unknown[]) => {
          const pathStr = typeof p === "string" ? p : p.toString();
          if (pathStr === luaPath) {
            luaStatCalls++;
            // First call is from listFiles walk. Let it through.
            // Second call is from getConfigSummary's own filter. Throw.
            if (luaStatCalls >= 2) {
              throw new Error("Simulated ENOENT for lua dir");
            }
          }
          return realFs.statSync(p, ...(args as []));
        },
      };
    });

    const { default: tool } = await import("../../src/tools/getConfigSummary");
    const result = await tool();

    expect(result).toContain("Neovim Configuration Summary");
    // Extract the Directories section and verify "lua/" is NOT listed
    const dirSection = result.split("Directories:\n")[1] || "";
    expect(dirSection).not.toContain("lua/");
    // But lua files should still be listed in key files (they were found by listFiles)
    expect(result).toContain("lua/config/keymaps.lua");
  });
});
