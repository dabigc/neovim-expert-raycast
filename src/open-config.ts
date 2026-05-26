import { open, showHUD } from "@raycast/api";
import { resolveConfigPath } from "./lib/config";

export default async function Command() {
  const configPath = resolveConfigPath();
  if (!configPath) {
    await showHUD("No Neovim config found. Set path in extension preferences.");
    return;
  }
  await open(configPath);
  await showHUD(`Opened ${configPath}`);
}
