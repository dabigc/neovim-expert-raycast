import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveConfigPath, validatePath } from "../../src/lib/config";
import { existsSync } from "node:fs";
import * as path from "node:path";

vi.mock("@raycast/api", () => ({
  getPreferenceValues: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

describe("resolveConfigPath", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns preference path when set and exists", async () => {
    const { getPreferenceValues } = await import("@raycast/api");
    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: "/tmp/test-nvim" });
    vi.mocked(existsSync).mockReturnValue(true);

    const result = resolveConfigPath();
    expect(result).toBe("/tmp/test-nvim");
  });

  it("falls back to XDG_CONFIG_HOME/nvim when preference is empty", async () => {
    const { getPreferenceValues } = await import("@raycast/api");
    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: "" });
    const originalEnv = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = "/tmp/xdg";
    vi.mocked(existsSync).mockImplementation((p) =>
      p === "/tmp/xdg/nvim" ? true : false
    );

    const result = resolveConfigPath();
    expect(result).toBe("/tmp/xdg/nvim");

    process.env.XDG_CONFIG_HOME = originalEnv;
  });

  it("falls back to ~/.config/nvim as default", async () => {
    const { getPreferenceValues } = await import("@raycast/api");
    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: "" });
    delete process.env.XDG_CONFIG_HOME;
    vi.mocked(existsSync).mockImplementation((p) =>
      p === path.join(process.env.HOME || "", ".config", "nvim") ? true : false
    );

    const result = resolveConfigPath();
    expect(result).toBe(path.join(process.env.HOME || "", ".config", "nvim"));
  });

  it("returns null when no config directory is found", async () => {
    const { getPreferenceValues } = await import("@raycast/api");
    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: "" });
    delete process.env.XDG_CONFIG_HOME;
    vi.mocked(existsSync).mockReturnValue(false);

    const result = resolveConfigPath();
    expect(result).toBeNull();
  });
});

describe("validatePath", () => {
  it("accepts paths within the config directory", () => {
    expect(validatePath("/home/user/.config/nvim", "lua/plugins/go.lua")).toBe(
      "/home/user/.config/nvim/lua/plugins/go.lua"
    );
  });

  it("rejects directory traversal attempts", () => {
    expect(validatePath("/home/user/.config/nvim", "../../.ssh/id_rsa")).toBeNull();
  });

  it("rejects absolute paths", () => {
    expect(validatePath("/home/user/.config/nvim", "/etc/passwd")).toBeNull();
  });

  it("normalizes paths with redundant separators", () => {
    expect(validatePath("/home/user/.config/nvim", "lua//plugins///go.lua")).toBe(
      "/home/user/.config/nvim/lua/plugins/go.lua"
    );
  });
});
