/**
 * Laserfiche WebLink API Client
 * Provides methods to interact with Laserfiche WebLink portals
 */

import type {
  WebLinkConfig,
  ApiResponse,
  FolderEntry,
  FolderContents,
} from "./types";
import { getEntryType } from "./utils";

/**
 * Client for interacting with Laserfiche WebLink API
 */
export class WebLinkClient {
  private config: WebLinkConfig;
  private cookies: Map<string, string> = new Map();

  /**
   * Create a new WebLinkClient
   * @param config - Configuration for the WebLink portal
   */
  constructor(config: WebLinkConfig) {
    this.config = config;
  }

  /**
   * Get cookie header string for requests
   */
  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  /**
   * Parse and store cookies from response
   */
  private parseCookies(response: Response): void {
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookieHeaders) {
      const [nameValue] = cookie.split(";");
      const eqIdx = nameValue.indexOf("=");
      if (eqIdx > 0) {
        const name = nameValue.slice(0, eqIdx).trim();
        const value = nameValue.slice(eqIdx + 1).trim();
        this.cookies.set(name, value);
      }
    }
  }

  /**
   * Resolve relative URLs to absolute URLs
   */
  private resolveUrl(url: string): string {
    if (url.startsWith("http")) return url;
    if (url.startsWith("/")) {
      const baseUrlObj = new URL(this.config.baseUrl);
      return `${baseUrlObj.origin}${url}`;
    }
    return `${this.config.baseUrl}/${url}`;
  }

  /**
   * Fetch with automatic cookie handling and redirect following
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const fullUrl = this.resolveUrl(url);

    const response = await fetch(fullUrl, {
      ...options,
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "*/*",
        Cookie: this.getCookieHeader(),
        ...options.headers,
      },
    });

    this.parseCookies(response);

    const location = response.headers.get("location");
    if (location && [301, 302, 303, 307, 308].includes(response.status)) {
      return this.fetch(location, options);
    }

    return response;
  }

  /**
   * Initialize session by establishing cookies
   * @returns True if session was successfully established
   */
  async initSession(): Promise<boolean> {
    // Hit the welcome page to get cookies
    await this.fetch(`${this.config.baseUrl}/`);
    // Hit login page (auto-login for public repos)
    await this.fetch(
      `${this.config.baseUrl}/Login.aspx?dbid=${this.config.dbid}&repo=${this.config.repoName}`
    );
    return this.cookies.size > 0;
  }

  /**
   * Get folder listing with pagination
   * @param folderId - Folder ID to fetch
   * @param start - Start index for pagination
   * @param end - End index for pagination
   * @returns API response or null if failed
   */
  async getFolderListing(
    folderId: number,
    start = 0,
    end = 500
  ): Promise<ApiResponse | null> {
    const url = `${this.config.baseUrl}/FolderListingService.aspx/GetFolderListing2`;

    const body = {
      repoName: this.config.repoName,
      folderId: folderId,
      getNewListing: true,
      start: start,
      end: end,
      sortColumn: "name",
      sortAscending: true,
    };

    const response = await this.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get all entries from a folder (handles pagination automatically)
   * @param folderId - Folder ID to fetch
   * @returns Folder contents with all entries
   */
  async getAllEntries(folderId: number): Promise<FolderContents> {
    const entries: FolderEntry[] = [];
    let folderName = "";
    let start = 0;
    const pageSize = 500;
    let totalEntries = 0;
    let firstFetch = true;

    do {
      const response = await this.getFolderListing(
        folderId,
        start,
        start + pageSize
      );
      const data = response?.data || response?.d;

      if (!data) break;

      if (firstFetch) {
        folderName = data.name || "";
        totalEntries = data.totalEntries || 0;
        firstFetch = false;
      }

      const results = data.results || [];
      const colTypes = data.colTypes || [];

      // Find column indices for additional data
      const pageCountIdx = colTypes.findIndex(
        (c: any) => c.name === "PageCount"
      );
      const templateIdx = colTypes.findIndex(
        (c: any) => c.name === "TemplateName"
      );
      const creationDateIdx = colTypes.findIndex(
        (c: any) => c.name === "CreationDate"
      );
      const modificationDateIdx = colTypes.findIndex(
        (c: any) => c.name === "LastModified"
      );

      for (const result of results) {
        entries.push({
          id: result.entryId,
          name: result.name,
          type: getEntryType(result.type),
          pageCount:
            pageCountIdx >= 0 ? result.data?.[pageCountIdx] : undefined,
          template: templateIdx >= 0 ? result.data?.[templateIdx] : undefined,
          creationDate:
            creationDateIdx >= 0 ? result.data?.[creationDateIdx] : undefined,
          modificationDate:
            modificationDateIdx >= 0
              ? result.data?.[modificationDateIdx]
              : undefined,
        });
      }

      start += pageSize;
    } while (start < totalEntries);

    return { folderName, entries };
  }

  /**
   * Browse a folder (get immediate children only, no pagination)
   * Useful for interactive navigation
   * @param folderId - Folder ID to browse
   * @returns Folder contents (first page only)
   */
  async browseFolder(folderId: number): Promise<FolderContents> {
    const response = await this.getFolderListing(folderId, 0, 100);
    const data = response?.data || response?.d;

    if (!data) {
      return { folderName: "", entries: [] };
    }

    const folderName = data.name || "";
    const results = data.results || [];
    const colTypes = data.colTypes || [];

    // Find column indices
    const pageCountIdx = colTypes.findIndex((c: any) => c.name === "PageCount");
    const templateIdx = colTypes.findIndex(
      (c: any) => c.name === "TemplateName"
    );
    const creationDateIdx = colTypes.findIndex(
      (c: any) => c.name === "CreationDate"
    );
    const modificationDateIdx = colTypes.findIndex(
      (c: any) => c.name === "LastModified"
    );

    const entries: FolderEntry[] = results.map((result: any) => ({
      id: result.entryId,
      name: result.name,
      type: getEntryType(result.type),
      pageCount: pageCountIdx >= 0 ? result.data?.[pageCountIdx] : undefined,
      template: templateIdx >= 0 ? result.data?.[templateIdx] : undefined,
      creationDate:
        creationDateIdx >= 0 ? result.data?.[creationDateIdx] : undefined,
      modificationDate:
        modificationDateIdx >= 0
          ? result.data?.[modificationDateIdx]
          : undefined,
    }));

    return { folderName, entries };
  }

  /**
   * Get root folder contents
   * @returns Root folder contents
   */
  async getRootFolder(): Promise<FolderContents> {
    return this.browseFolder(1);
  }
}
