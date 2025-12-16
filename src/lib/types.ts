/**
 * Type definitions for Laserfiche WebLink API
 */

/**
 * Configuration for connecting to a Laserfiche WebLink portal
 */
export interface WebLinkConfig {
  /** Base URL of the WebLink portal (e.g., "https://laserfiche.arcadiaca.gov/WebLink") */
  baseUrl: string;
  /** Repository name (e.g., "CityofArcadia") */
  repoName: string;
  /** Database ID (usually 0) */
  dbid: number;
}

/**
 * Represents a folder or document entry in the repository
 */
export interface FolderEntry {
  /** Entry ID */
  id: number;
  /** Entry name */
  name: string;
  /** Entry type: "Folder" | "Document" | "Shortcut" | "Unknown(...)" */
  type: string;
  /** Number of pages (for documents) */
  pageCount?: number;
  /** Template name */
  template?: string;
  /** Creation date/time */
  creationDate?: string;
  /** Last modification date/time */
  modificationDate?: string;
}

/**
 * API response structure from Laserfiche WebLink endpoints
 */
export interface ApiResponse {
  /** Modern format */
  data?: {
    name: string;
    folderId: number;
    path?: string;
    totalEntries?: number;
    results?: Array<{
      name: string;
      entryId: number;
      type: number;
      data: any[];
    }>;
    colTypes?: Array<{ name: string }>;
  };
  /** Legacy ASP.NET format */
  d?: any;
}

/**
 * Result of fetching all entries from a folder
 */
export interface FolderContents {
  /** Name of the folder */
  folderName: string;
  /** All entries in the folder */
  entries: FolderEntry[];
}

/**
 * Entry type enumeration
 */
export enum EntryType {
  Folder = 0,
  Document = 1,
  Shortcut = 2,
  DocumentAlt = -2, // Alternative document type
}
