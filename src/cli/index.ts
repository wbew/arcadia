/**
 * CLI Entry Point for Laserfiche WebLink Client
 *
 * Usage:
 *   bun run src/cli/index.ts browse [folderId]
 *   bun run src/cli/index.ts fetch <folderId>
 *   bun run src/cli/index.ts [folderId]  # defaults to fetch
 */

import type { WebLinkConfig } from "../lib/types";
import { browseCommand } from "./commands/browse";
import { fetchCommand } from "./commands/fetch";

// Arcadia configuration (hardcoded for now)
const ARCADIA_CONFIG: WebLinkConfig = {
  baseUrl: "https://laserfiche.arcadiaca.gov/WebLink",
  repoName: "CityofArcadia",
  dbid: 0,
};

const DEFAULT_FOLDER_ID = 874714;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // No args - default to fetch with default folder
    await fetchCommand(ARCADIA_CONFIG, DEFAULT_FOLDER_ID);
    return;
  }

  const command = args[0].toLowerCase();

  if (command === "browse") {
    // Browse mode
    const startFolderId = args[1] ? parseInt(args[1]) : 1;
    if (isNaN(startFolderId)) {
      console.error("Error: Invalid folder ID");
      process.exit(1);
    }
    await browseCommand(ARCADIA_CONFIG, startFolderId);
  } else if (command === "fetch") {
    // Fetch mode with explicit command
    const folderId = args[1] ? parseInt(args[1]) : DEFAULT_FOLDER_ID;
    if (isNaN(folderId)) {
      console.error("Error: Invalid folder ID");
      process.exit(1);
    }
    await fetchCommand(ARCADIA_CONFIG, folderId);
  } else {
    // Assume first arg is folder ID (legacy behavior)
    const folderId = parseInt(command);
    if (isNaN(folderId)) {
      console.error("Error: Invalid command or folder ID");
      console.error("\nUsage:");
      console.error("  bun run src/cli/index.ts browse [folderId]");
      console.error("  bun run src/cli/index.ts fetch <folderId>");
      console.error("  bun run src/cli/index.ts [folderId]");
      process.exit(1);
    }
    await fetchCommand(ARCADIA_CONFIG, folderId);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
