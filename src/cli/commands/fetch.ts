/**
 * Fetch command - Direct folder content fetching
 */

import { WebLinkClient, type WebLinkConfig } from "../../lib/index";
import { displayDocuments } from "../ui";

/**
 * Fetch all contents of a folder and save to JSON
 */
export async function fetchCommand(
  config: WebLinkConfig,
  folderId: number,
  outputPath?: string
): Promise<void> {
  const client = new WebLinkClient(config);

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
    `   URL: ${config.baseUrl}/Browse.aspx?id=${folderId}&dbid=${config.dbid}&repo=${config.repoName}`
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
        `     ${config.baseUrl}/Browse.aspx?id=${entry.id}&dbid=${config.dbid}&repo=${config.repoName}`
      );
    });
    console.log();
  }

  if (documents.length > 0) {
    displayDocuments(documents);
  }

  // Save to JSON
  const fs = await import("fs");
  const output = {
    folderId,
    folderName,
    repository: config.repoName,
    folderUrl: `${config.baseUrl}/Browse.aspx?id=${folderId}&dbid=${config.dbid}&repo=${config.repoName}`,
    fetchedAt: new Date().toISOString(),
    totalEntries: entries.length,
    folders: folders.map((e) => ({
      ...e,
      url: `${config.baseUrl}/Browse.aspx?id=${e.id}&dbid=${config.dbid}&repo=${config.repoName}`,
    })),
    documents: documents.map((e) => ({
      ...e,
      url: `${config.baseUrl}/DocView.aspx?id=${e.id}&dbid=${config.dbid}&repo=${config.repoName}`,
    })),
  };

  const filename = outputPath || "arcadia-entries.json";
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\n✓ Results saved to ${filename}`);
}
