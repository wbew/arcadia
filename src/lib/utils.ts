/**
 * Utility functions for Laserfiche WebLink API
 */

import { EntryType } from "./types";

/**
 * Convert numeric entry type to string representation
 * @param typeNum - Numeric type from API
 * @returns Human-readable type string
 */
export function getEntryType(typeNum: number): string {
  const types: Record<number, string> = {
    [EntryType.Folder]: "Folder",
    [EntryType.Document]: "Document",
    [EntryType.Shortcut]: "Shortcut",
    [EntryType.DocumentAlt]: "Document",
  };
  return types[typeNum] || `Unknown(${typeNum})`;
}
