/**
 * Laserfiche WebLink File Fetcher for City of Arcadia
 *
 * @deprecated This file is deprecated. Use the new CLI instead:
 *   - bun run browse           # Interactive folder browser
 *   - bun run fetch [folderId] # Fetch folder contents
 *   - bun run src/cli/index.ts [folderId]  # Legacy behavior
 *
 * This file is kept for backward compatibility and will redirect to the new CLI.
 *
 * Usage: bun run arcadia-files.ts [folderId]
 *
 * Examples:
 *   bun run arcadia-files.ts           # Fetches folder 874714 (default)
 *   bun run arcadia-files.ts 123456    # Fetches folder 123456
 */

const BASE_URL = "https://laserfiche.arcadiaca.gov/WebLink";
const DEFAULT_FOLDER_ID = 874714;
const REPO = "CityofArcadia";

interface FolderEntry {
  id: number;
  name: string;
  type: string;
  pageCount?: string;
  template?: string;
  creationDate?: string;
  modificationDate?: string;
}

interface ApiResponse {
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
  d?: any; // Legacy format
}

class WebLinkClient {
  private cookies: Map<string, string> = new Map();

  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

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

  private resolveUrl(url: string): string {
    if (url.startsWith("http")) return url;
    if (url.startsWith("/")) return `https://laserfiche.arcadiaca.gov${url}`;
    return `${BASE_URL}/${url}`;
  }

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

  async initSession(): Promise<boolean> {
    // Hit the welcome page to get cookies
    await this.fetch(`${BASE_URL}/`);
    // Hit login page (auto-login for public repos)
    await this.fetch(`${BASE_URL}/Login.aspx?dbid=0&repo=${REPO}`);
    return this.cookies.size > 0;
  }

  async getFolderListing(
    folderId: number,
    start = 0,
    end = 500
  ): Promise<ApiResponse | null> {
    const url = `${BASE_URL}/FolderListingService.aspx/GetFolderListing2`;

    const body = {
      repoName: REPO,
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

  async getAllEntries(
    folderId: number
  ): Promise<{ folderName: string; entries: FolderEntry[] }> {
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
}

function getEntryType(typeNum: number): string {
  const types: Record<number, string> = {
    0: "Folder",
    1: "Document",
    2: "Shortcut",
  };
  return types[typeNum] || `Unknown(${typeNum})`;
}

async function main() {
  const folderId = parseInt(process.argv[2]) || DEFAULT_FOLDER_ID;

  console.log("=".repeat(60));
  console.log("Laserfiche WebLink File Fetcher - City of Arcadia");
  console.log("=".repeat(60));
  console.log(`Folder ID: ${folderId}`);
  console.log(`Repository: ${REPO}`);
  console.log("=".repeat(60) + "\n");

  const client = new WebLinkClient();

  console.log("Initializing session...");
  await client.initSession();
  console.log("Session established.\n");

  console.log("Fetching folder contents...\n");
  const { folderName, entries } = await client.getAllEntries(folderId);

  if (entries.length === 0) {
    console.log("No entries found or folder is empty.");
    return;
  }

  // Separate folders and documents
  const folders = entries.filter((e) => e.type === "Folder");
  const documents = entries.filter((e) => e.type !== "Folder");

  console.log(`📂 Folder: ${folderName}`);
  console.log(
    `   URL: ${BASE_URL}/Browse.aspx?id=${folderId}&dbid=0&repo=${REPO}`
  );
  console.log(
    `   Total: ${entries.length} items (${folders.length} folders, ${documents.length} documents)\n`
  );

  if (folders.length > 0) {
    console.log("📁 SUBFOLDERS:");
    console.log("-".repeat(50));
    folders.forEach((entry, i) => {
      console.log(`${String(i + 1).padStart(3)}. ${entry.name}`);
      console.log(
        `     ${BASE_URL}/Browse.aspx?id=${entry.id}&dbid=0&repo=${REPO}`
      );
    });
    console.log();
  }

  if (documents.length > 0) {
    console.log("📄 DOCUMENTS:");
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
      console.log(
        `     ${BASE_URL}/DocView.aspx?id=${entry.id}&dbid=0&repo=${REPO}`
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

  // Save to JSON
  const fs = await import("fs");
  const output = {
    folderId,
    folderName,
    repository: REPO,
    folderUrl: `${BASE_URL}/Browse.aspx?id=${folderId}&dbid=0&repo=${REPO}`,
    fetchedAt: new Date().toISOString(),
    totalEntries: entries.length,
    folders: folders.map((e) => ({
      ...e,
      url: `${BASE_URL}/Browse.aspx?id=${e.id}&dbid=0&repo=${REPO}`,
    })),
    documents: documents.map((e) => ({
      ...e,
      url: `${BASE_URL}/DocView.aspx?id=${e.id}&dbid=0&repo=${REPO}`,
    })),
  };

  fs.writeFileSync("arcadia-entries.json", JSON.stringify(output, null, 2));
  console.log(`\n✓ Results saved to arcadia-entries.json`);
}

main().catch(console.error);
