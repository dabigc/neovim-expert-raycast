/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Neovim Config Directory - Path to your Neovim configuration directory. If not set, auto-detects ~/.config/nvim. */
  "configPath"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `open-config` command */
  export type OpenConfig = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `open-config` command */
  export type OpenConfig = {}
}

