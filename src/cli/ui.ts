/**
 * CLI UI helpers for displaying folders and documents
 */

import * as readline from "readline";
import type { FolderEntry } from "../lib/types";

/**
 * Display a breadcrumb/path
 */
export function displayBreadcrumb(path: string): void {
  console.log(`\n📂 ${path}`);
  console.log("=".repeat(Math.min(path.length + 3, 60)));
}

/**
 * Display a list of folders with numbering
 */
export function displayFolderList(folders: FolderEntry[]): void {
  folders.forEach((folder, i) => {
    console.log(`📂 ${String(i + 1).padStart(2)}. ${folder.name} (ID: ${folder.id})`);
  });
}

/**
 * Display a list of documents
 */
export function displayDocuments(documents: FolderEntry[]): void {
  if (documents.length === 0) return;

  console.log("\n📄 DOCUMENTS:");
  console.log("-".repeat(50));
  documents.forEach((entry, i) => {
    const extra = [
      entry.pageCount ? `${entry.pageCount} pages` : null,
      entry.template,
    ]
      .filter(Boolean)
      .join(" | ");
    console.log(
      `${String(i + 1).padStart(3)}. ${entry.name}${
        extra ? ` (${extra})` : ""
      }`
    );
    if (entry.creationDate || entry.modificationDate) {
      const dates = [
        entry.creationDate ? `Created: ${entry.creationDate}` : null,
        entry.modificationDate ? `Modified: ${entry.modificationDate}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      console.log(`     ${dates}`);
    }
  });
}

/**
 * Prompt for user input using readline
 * @param prompt - The prompt to display
 * @param rl - Optional readline interface (reuse for multiple prompts)
 */
export async function promptInput(
  prompt: string,
  rl?: readline.Interface
): Promise<string> {
  const shouldClose = !rl;
  let readlineInterface = rl;

  // If readline interface was closed or doesn't exist, create a new one
  if (!readlineInterface || (readlineInterface as any).closed) {
    readlineInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  return new Promise((resolve) => {
    try {
      readlineInterface.question(prompt, (answer: string) => {
        if (shouldClose) {
          readlineInterface.close();
        }
        resolve(answer.trim());
      });
    } catch (error) {
      // If question fails, recreate interface and try again
      readlineInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      readlineInterface.question(prompt, (answer: string) => {
        if (shouldClose) {
          readlineInterface.close();
        }
        resolve(answer.trim());
      });
    }
  });
}

/**
 * Create a readline interface for interactive prompts
 */
export async function createReadlineInterface(): Promise<readline.Interface> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, // Prevent auto-close on EOF
  });

  // Handle stdin close gracefully
  process.stdin.on("end", () => {
    // Don't close the interface immediately
  });

  return rl;
}

/**
 * Parse user selection input
 * Supports: single number, comma-separated, ranges
 * Examples: "1", "1,3,5", "1-5"
 */
export function parseSelection(input: string, max: number): number[] {
  const selections = new Set<number>();

  const parts = input.split(",").map(p => p.trim());

  for (const part of parts) {
    // Check for range (e.g., "1-5")
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(n => parseInt(n.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          if (i >= 1 && i <= max) {
            selections.add(i);
          }
        }
      }
    } else {
      // Single number
      const num = parseInt(part);
      if (!isNaN(num) && num >= 1 && num <= max) {
        selections.add(num);
      }
    }
  }

  return Array.from(selections).sort((a, b) => a - b);
}

/**
 * Display command help
 */
export function displayCommands(hasSelection: boolean): void {
  if (hasSelection) {
    console.log("\nCommands: [number] | [a]ll | [c]lear | [b]ack | [f]etch | [q]uit");
  } else {
    console.log("\nCommands: [number] to open | [1,3,5] multi-select | [1-5] range | [a]ll | [f]etch | [q]uit");
  }
}
