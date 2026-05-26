import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

describe("open-config command", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows error HUD when no config path is found", async () => {
    const { getPreferenceValues, showHUD, open } = await import("@raycast/api");
    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: "" });
    delete process.env.XDG_CONFIG_HOME;
    vi.mocked(existsSync).mockReturnValue(false);

    const Command = (await import("../src/open-config")).default;
    await Command();

    expect(showHUD).toHaveBeenCalledWith(
      "No Neovim config found. Set path in extension preferences."
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("opens config path and shows success HUD when config exists", async () => {
    const { getPreferenceValues, showHUD, open } = await import("@raycast/api");
    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: "/tmp/test-nvim" });
    vi.mocked(existsSync).mockReturnValue(true);

    const Command = (await import("../src/open-config")).default;
    await Command();

    expect(open).toHaveBeenCalledWith("/tmp/test-nvim");
    expect(showHUD).toHaveBeenCalledWith("Opened /tmp/test-nvim");
  });

  it("opens XDG fallback path when preference is empty but XDG config exists", async () => {
    const { getPreferenceValues, showHUD, open } = await import("@raycast/api");
    vi.mocked(getPreferenceValues).mockReturnValue({ configPath: "" });
    process.env.XDG_CONFIG_HOME = "/tmp/xdg";
    vi.mocked(existsSync).mockImplementation((p) => p === "/tmp/xdg/nvim");

    const Command = (await import("../src/open-config")).default;
    await Command();

    expect(open).toHaveBeenCalledWith("/tmp/xdg/nvim");
    expect(showHUD).toHaveBeenCalledWith("Opened /tmp/xdg/nvim");

    delete process.env.XDG_CONFIG_HOME;
  });
});
