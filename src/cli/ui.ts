/**
 * CLI UI helpers for displaying folders and documents
 */

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
 * Prompt for user input
 */
export async function promptInput(prompt: string): Promise<string> {
  process.stdout.write(prompt);

  const buffer = new Uint8Array(1024);
  const stdin = Bun.stdin.stream();
  const reader = stdin.getReader();

  try {
    const { value } = await reader.read();
    if (value) {
      return new TextDecoder().decode(value).trim();
    }
    return "";
  } finally {
    reader.releaseLock();
  }
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
