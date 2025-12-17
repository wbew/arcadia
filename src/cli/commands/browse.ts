/**
 * Browse command - Interactive folder navigation with multi-select
 */

import { WebLinkClient, type WebLinkConfig, type FolderEntry } from "../../lib/index";
import {
  displayBreadcrumb,
  displayFolderList,
  displayCommands,
  promptInput,
  parseSelection,
  createReadlineInterface,
} from "../ui";
import { fetchCommand } from "./fetch";

interface BrowseState {
  currentFolderId: number;
  currentPath: string;
  selectedFolders: Map<number, FolderEntry>;
  history: Array<{ id: number; path: string }>;
}

/**
 * Interactive folder browser
 */
export async function browseCommand(
  config: WebLinkConfig,
  startFolderId = 1
): Promise<void> {
  const client = new WebLinkClient(config);

  console.log("\n" + "=".repeat(60));
  console.log("Laserfiche WebLink Browser - City of Arcadia");
  console.log("=".repeat(60));

  console.log("\nInitializing session...");
  await client.initSession();
  console.log("Session established.");

  const state: BrowseState = {
    currentFolderId: startFolderId,
    currentPath: "Root",
    selectedFolders: new Map(),
    history: [],
  };

  // Create a single readline interface for the entire session
  const rl = await createReadlineInterface();
  let running = true;

  while (running) {
    // Fetch current folder
    console.log("\nFetching folder...");
    const { folderName, entries } = await client.browseFolder(
      state.currentFolderId
    );

    // Filter to show only folders
    const folders = entries.filter((e) => e.type === "Folder");

    if (folders.length === 0) {
      console.log("\nNo subfolders found in this location.");
      if (state.history.length > 0) {
        console.log("Use 'b' to go back or 'q' to quit.");
      } else {
        console.log("Use 'q' to quit.");
      }
    } else {
      // Display current location
      displayBreadcrumb(folderName);
      displayFolderList(folders);

      // Show selection status
      if (state.selectedFolders.size > 0) {
        const selectedNames = Array.from(state.selectedFolders.values())
          .map((f) => f.name)
          .join(", ");
        console.log(
          `\n✓ Selected: ${selectedNames} (${state.selectedFolders.size} folders)`
        );
      }

      displayCommands(state.selectedFolders.size > 0);
    }

    // Show current selection in prompt
    const selectionHint =
      state.selectedFolders.size > 0
        ? ` [${state.selectedFolders.size} selected]`
        : "";
    const input = await promptInput(`> ${selectionHint} `, rl);

    // Handle commands
    const command = input.toLowerCase().trim();

    if (command === "q") {
      running = false;
      console.log("\nGoodbye!");
    } else if (command === "b") {
      // Go back
      if (state.history.length > 0) {
        const prev = state.history.pop()!;
        state.currentFolderId = prev.id;
        state.currentPath = prev.path;
      } else {
        console.log("\nAlready at root.");
      }
    } else if (command === "f") {
      // Fetch selected or current folder
      if (state.selectedFolders.size > 0) {
        console.log(`\nFetching ${state.selectedFolders.size} folders...`);
        for (const [id, folder] of state.selectedFolders) {
          console.log(`\nFetching: ${folder.name} (ID: ${id})`);
          const sanitizedName = folder.name
            .replace(/[^a-z0-9]/gi, "-")
            .toLowerCase();
          const filename = `arcadia-${sanitizedName}-${id}.json`;
          await fetchCommand(config, id, filename);
        }
        console.log(`\n✓ Done! Fetched ${state.selectedFolders.size} folders.`);
        state.selectedFolders.clear();
      } else {
        // Fetch current folder
        console.log(`\nFetching current folder: ${folderName}`);
        await fetchCommand(config, state.currentFolderId);
      }
    } else if (command === "a") {
      // Select all
      if (folders.length > 0) {
        state.selectedFolders.clear();
        folders.forEach((f) => state.selectedFolders.set(f.id, f));
        console.log(`\n✓ Selected all ${folders.length} folders.`);
      }
    } else if (command === "c") {
      // Clear selection
      state.selectedFolders.clear();
      console.log("\n✓ Selection cleared.");
    } else if (input.match(/^[\d,\- ]+$/)) {
      // Parse numeric selection
      const selections = parseSelection(input, folders.length);

      if (selections.length === 0) {
        console.log("\nInvalid selection.");
      } else if (selections.length === 1) {
        // Single selection - navigate into folder
        const selectedIdx = selections[0] - 1;
        const selectedFolder = folders[selectedIdx];

        // Save current state to history
        state.history.push({
          id: state.currentFolderId,
          path: state.currentPath,
        });

        // Navigate to folder
        state.currentFolderId = selectedFolder.id;
        state.currentPath = `${state.currentPath} > ${selectedFolder.name}`;
      } else {
        // Multi-select - add to selection
        selections.forEach((num) => {
          const folder = folders[num - 1];
          if (!state.selectedFolders.has(folder.id)) {
            state.selectedFolders.set(folder.id, folder);
          }
        });
        console.log(`\n✓ Added ${selections.length} folders to selection.`);
      }
    } else {
      console.log("\nInvalid command. Use [number], [a]ll, [c]lear, [b]ack, [f]etch, or [q]uit.");
    }
  }

  // Clean up readline interface
  rl.close();
}
