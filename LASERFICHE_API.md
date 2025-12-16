# Laserfiche WebLink API Guide

A comprehensive guide to programmatically accessing documents from Laserfiche WebLink public portals, commonly used by city and county governments for public records.

## Table of Contents

1. [Overview](#overview)
2. [Understanding WebLink URLs](#understanding-weblink-urls)
3. [Authentication & Sessions](#authentication--sessions)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Formats](#requestresponse-formats)
6. [Implementation Guide](#implementation-guide)
7. [Adapting for Other Cities](#adapting-for-other-cities)
8. [Edge Cases & Gotchas](#edge-cases--gotchas)
9. [Complete Example](#complete-example)
10. [Downloading Documents](#downloading-documents)
11. [Recursive Folder Traversal](#recursive-folder-traversal)
12. [Hardcoded Values & How to Find Them](#hardcoded-values--how-to-find-them)
13. [Version Differences](#version-differences)
14. [Troubleshooting Guide](#troubleshooting-guide)
15. [Building a Multi-City System](#building-a-multi-city-system)
16. [Security Considerations](#security-considerations)

---

## Overview

### What is Laserfiche WebLink?

Laserfiche WebLink is a read-only public portal that many government agencies use to provide access to public documents. It's commonly used for:

- City Council meeting agendas and minutes
- Planning commission documents
- Public records requests
- Building permits and records
- Historical archives

### Key Insight

**WebLink is a JavaScript Single Page Application (SPA)**. When you visit a WebLink page, the initial HTML contains no document data—just a loading spinner. The actual content is fetched via internal AJAX API calls. This guide documents those internal APIs.

### Technology Stack

- **Frontend**: Angular-based SPA
- **Backend**: ASP.NET Web Services (`.aspx` endpoints)
- **Data Format**: JSON over HTTP POST

---

## Understanding WebLink URLs

### URL Structure

```
https://{hostname}/WebLink/{page}.aspx?{parameters}
```

### Common URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `id` | Entry ID (folder or document) | `874714` |
| `dbid` | Database ID (usually `0`) | `0` |
| `repo` | Repository name | `CityofArcadia` |
| `cr` | Cookie redirect flag | `1` |
| `startid` | Alternative to `id` for folders | `874714` |

### Page Types

| Page | Purpose | URL Pattern |
|------|---------|-------------|
| `Browse.aspx` | View folder contents | `Browse.aspx?id={folderId}&dbid=0&repo={repoName}` |
| `DocView.aspx` | View/download document | `DocView.aspx?id={docId}&dbid=0&repo={repoName}` |
| `Login.aspx` | Session initialization | `Login.aspx?dbid=0&repo={repoName}` |
| `Welcome.aspx` | Portal homepage | `Welcome.aspx` |

### Example URLs

```
# Folder listing
https://laserfiche.arcadiaca.gov/WebLink/Browse.aspx?id=874714&dbid=0&repo=CityofArcadia

# Document view
https://laserfiche.arcadiaca.gov/WebLink/DocView.aspx?id=874740&dbid=0&repo=CityofArcadia
```

---

## Authentication & Sessions

### Public vs. Authenticated Access

Most government WebLink portals are configured for **anonymous public access**—no login required. However, you still need to establish a session with valid cookies.

### Required Cookies

| Cookie | Purpose |
|--------|---------|
| `WebLinkSession` | Session identifier (required) |
| `AcceptsCookies` | Cookie acceptance flag |
| `MachineTag` | Client identifier |
| `lastSessionAccess` | Session timestamp |

### Session Initialization Flow

```
1. GET /WebLink/
   ↓ (302 redirect)
2. GET /WebLink/CookieCheck.aspx?redirect=...
   ↓ (302 redirect, sets AcceptsCookies)
3. GET /WebLink/Welcome.aspx?cr=1
   ↓ (200 OK, sets WebLinkSession)
4. GET /WebLink/Login.aspx?dbid=0&repo={repoName}
   ↓ (302 redirect chain)
5. Session established - API calls now work
```

### Critical: Cookie Handling

⚠️ **The server uses a cookie check redirect**. You must:

1. Handle redirects manually (don't auto-follow)
2. Collect `Set-Cookie` headers from EVERY response
3. Send accumulated cookies with EVERY request

```typescript
// WRONG - cookies lost on redirect
fetch(url, { redirect: "follow" });

// CORRECT - manual redirect handling
fetch(url, { redirect: "manual" });
// Then follow Location header manually, preserving cookies
```

---

## API Endpoints

### Discovered Endpoints

All endpoints are relative to `/WebLink/` and use HTTP POST with JSON bodies.

#### 1. GetFolderListing2 (Primary)

**URL**: `FolderListingService.aspx/GetFolderListing2`

**Purpose**: Get paginated folder contents with full metadata

**Request Body**:
```json
{
  "repoName": "CityofArcadia",
  "folderId": 874714,
  "getNewListing": true,
  "start": 0,
  "end": 100,
  "sortColumn": "name",
  "sortAscending": true
}
```

**Parameters**:
| Field | Type | Description |
|-------|------|-------------|
| `repoName` | string | Repository name from URL |
| `folderId` | number | Folder entry ID |
| `getNewListing` | boolean | `true` for fresh data, `false` for cached |
| `start` | number | Pagination start index (0-based) |
| `end` | number | Pagination end index |
| `sortColumn` | string | Column to sort by (`"name"`, `"Id"`, etc.) |
| `sortAscending` | boolean | Sort direction |

#### 2. GetFolderListing (Simple)

**URL**: `FolderListingService.aspx/GetFolderListing`

**Purpose**: Get folder contents (simpler, no pagination control)

**Request Body**:
```json
{
  "repoName": "CityofArcadia",
  "folderId": 874714
}
```

#### 3. GetBreadCrumbs

**URL**: `FolderListingService.aspx/GetBreadCrumbs`

**Purpose**: Get folder hierarchy/path

**Request Body**:
```json
{
  "vdirName": "WebLink",
  "repoName": "CityofArcadia",
  "folderId": 874714
}
```

#### 4. Other Endpoints (Discovered but not fully documented)

- `FolderListingService.aspx/GetFolderListingIds` - Get entry IDs only
- `FolderListingService.aspx/GetColumnInfo` - Get available columns
- `FolderListingService.aspx/GetExportAuditReasonOptions` - Export options

---

## Request/Response Formats

### Request Headers (Required)

```http
POST /WebLink/FolderListingService.aspx/GetFolderListing2 HTTP/1.1
Host: laserfiche.arcadiaca.gov
Content-Type: application/json; charset=utf-8
Accept: application/json
X-Requested-With: XMLHttpRequest
Cookie: WebLinkSession=xxx; AcceptsCookies=1; ...
```

⚠️ **Critical Headers**:
- `Content-Type: application/json; charset=utf-8` - Must include charset
- `X-Requested-With: XMLHttpRequest` - Required for AJAX endpoints

### Response Format

**Wrapper Structure** (varies by endpoint):
```json
{
  "data": { ... }  // Modern format
}
// OR
{
  "d": { ... }     // Legacy ASP.NET format
}
```

**GetFolderListing2 Response**:
```json
{
  "data": {
    "name": "12/16/2025",
    "folderId": 874714,
    "path": "\\City Council\\Agendas\\2025\\12/16/2025",
    "totalEntries": 10,
    "entryType": "Folder",
    "colTypes": [
      {"displayName": "Name", "name": "Name", "type": 0, "hidden": false},
      {"displayName": "Page count", "name": "PageCount", "type": 0, "hidden": false},
      {"displayName": "Template name", "name": "TemplateName", "type": 0, "hidden": false},
      {"displayName": "ID", "name": "Id", "type": 0, "hidden": true}
    ],
    "results": [
      {
        "name": "Agenda - December 16, 2025",
        "entryId": 874740,
        "type": -2,
        "pathToImage": "...",
        "iconClass": "lf-icon-document",
        "data": [null, 7, "CC - Agendas", 874740]
      }
    ]
  }
}
```

### Entry Types

| Type Value | Meaning |
|------------|---------|
| `0` | Folder |
| `1` | Document |
| `2` | Shortcut |
| `-2` | Document (alternate) |

⚠️ **Note**: Type `-2` appears for documents in some responses. Always check for both `1` and `-2` for documents.

### Column Data Mapping

The `results[].data` array corresponds to `colTypes` array indices:

```javascript
const colTypes = response.data.colTypes;
const pageCountIdx = colTypes.findIndex(c => c.name === "PageCount");

results.forEach(result => {
  const pageCount = result.data[pageCountIdx];
});
```

---

## Implementation Guide

### Step 1: Initialize Session

```typescript
async function initSession(baseUrl: string, repoName: string): Promise<Map<string, string>> {
  const cookies = new Map<string, string>();
  
  // Helper to collect cookies
  const collectCookies = (response: Response) => {
    for (const cookie of response.headers.getSetCookie?.() || []) {
      const [nameValue] = cookie.split(";");
      const [name, value] = nameValue.split("=");
      cookies.set(name.trim(), value);
    }
  };
  
  // Step 1: Hit welcome page
  let response = await fetch(`${baseUrl}/`, { redirect: "manual" });
  collectCookies(response);
  
  // Step 2: Follow redirects manually
  while (response.headers.has("location")) {
    const location = response.headers.get("location")!;
    response = await fetch(resolveUrl(baseUrl, location), {
      redirect: "manual",
      headers: { Cookie: cookieString(cookies) }
    });
    collectCookies(response);
  }
  
  // Step 3: Hit login page
  response = await fetch(`${baseUrl}/Login.aspx?dbid=0&repo=${repoName}`, {
    redirect: "manual",
    headers: { Cookie: cookieString(cookies) }
  });
  collectCookies(response);
  
  // Follow any remaining redirects...
  
  return cookies;
}
```

### Step 2: Make API Calls

```typescript
async function getFolderContents(
  baseUrl: string,
  repoName: string,
  folderId: number,
  cookies: Map<string, string>
): Promise<any> {
  const response = await fetch(`${baseUrl}/FolderListingService.aspx/GetFolderListing2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Cookie": cookieString(cookies),
    },
    body: JSON.stringify({
      repoName,
      folderId,
      getNewListing: true,
      start: 0,
      end: 500,
      sortColumn: "name",
      sortAscending: true,
    }),
  });
  
  return response.json();
}
```

### Step 3: Parse Results

```typescript
function parseEntries(response: any): Entry[] {
  const data = response.data || response.d;
  if (!data?.results) return [];
  
  return data.results.map((r: any) => ({
    id: r.entryId,
    name: r.name,
    type: r.type === 0 ? "Folder" : "Document",
    // Map additional columns as needed
  }));
}
```

---

## Adapting for Other Cities

### Finding WebLink Installations

Search for: `site:*.gov "WebLink" "Laserfiche"`

Common URL patterns:
- `laserfiche.{city}.gov/WebLink/`
- `{city}.gov/WebLink/`
- `records.{city}.gov/WebLink/`
- `documents.{city}.gov/WebLink/`

### Configuration Variables

Create a config object for each city:

```typescript
interface WebLinkConfig {
  // Required
  baseUrl: string;      // e.g., "https://laserfiche.arcadiaca.gov/WebLink"
  repoName: string;     // e.g., "CityofArcadia"
  
  // Usually constant
  dbid: number;         // Usually 0
  
  // Optional - for targeting specific content
  rootFolderId?: number;  // Starting folder ID
}

const CITIES: Record<string, WebLinkConfig> = {
  arcadia: {
    baseUrl: "https://laserfiche.arcadiaca.gov/WebLink",
    repoName: "CityofArcadia",
    dbid: 0,
  },
  // Add more cities...
};
```

### Discovering Repository Name

The repository name is in the URL parameter `repo=`. You can also find it in the page source:

```javascript
// Look for this in the HTML/JS:
run({ str_json: {"rootFolder":1, ..., "repoName":"CityofArcadia", ...}})
```

### Finding Root Folder IDs

1. Browse the WebLink portal manually
2. Note the `id` parameter in URLs
3. Or call `GetBreadCrumbs` with `folderId: 1` (root)

---

## Edge Cases & Gotchas

### 1. Cookie Redirect Loop

**Problem**: Server returns 302 to `CookieCheck.aspx` repeatedly

**Solution**: Ensure you're sending cookies AND handling the `AcceptsCookies` cookie properly

### 2. Empty Results Despite Valid Session

**Problem**: API returns empty results or error

**Possible Causes**:
- Missing `X-Requested-With` header
- Wrong `Content-Type` (must include `charset=utf-8`)
- `getNewListing` should be `true` for first request

### 3. Entry Type Inconsistency

**Problem**: Documents show as type `-2` instead of `1`

**Solution**: Check for multiple type values:
```typescript
const isDocument = [1, -2].includes(entry.type);
const isFolder = entry.type === 0;
```

### 4. Pagination Edge Cases

**Problem**: Large folders may timeout or return partial results

**Solution**: Use smaller page sizes (100-200) and implement proper pagination:
```typescript
let start = 0;
const pageSize = 100;
do {
  const response = await getFolderContents(folderId, start, start + pageSize);
  // ... process results
  start += pageSize;
} while (start < response.data.totalEntries);
```

### 5. Response Format Variations

**Problem**: Some endpoints return `{data: ...}`, others `{d: ...}`

**Solution**: Check both:
```typescript
const data = response.data || response.d;
```

### 6. Session Timeout

**Problem**: Session expires after inactivity

**Solution**: Re-initialize session if API returns 401 or redirect to login

### 7. Rate Limiting

**Problem**: Too many requests may trigger blocking

**Solution**: Add delays between requests:
```typescript
await new Promise(r => setTimeout(r, 100)); // 100ms delay
```

### 8. HTTPS Certificate Issues

**Problem**: Some government sites have certificate issues

**Solution**: In production, properly validate certs. For testing:
```typescript
// Node.js only - NOT for production
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
```

### 9. Virtual Directory Variations

**Problem**: WebLink might be at `/WebLink/` or `/weblink/` or custom path

**Solution**: Check the actual URL and adjust `baseUrl` accordingly

---

## Complete Example

See `arcadia-files.ts` in this repository for a complete, working implementation.

### Quick Start

```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Run the script
bun run arcadia-files.ts

# Fetch a specific folder
bun run arcadia-files.ts 874714
```

### Output

The script outputs:
1. Console listing of all folders and documents
2. `arcadia-entries.json` with full structured data

### JSON Output Format

```json
{
  "folderId": 874714,
  "folderName": "12/16/2025",
  "repository": "CityofArcadia",
  "folderUrl": "https://...",
  "fetchedAt": "2025-12-16T20:50:28.522Z",
  "totalEntries": 10,
  "folders": [],
  "documents": [
    {
      "id": 874740,
      "name": "Agenda - December 16, 2025",
      "type": "Document",
      "pageCount": 7,
      "template": "CC - Agendas",
      "url": "https://..."
    }
  ]
}
```

---

## Downloading Documents

### Document Viewer URL

The `DocView.aspx` page renders documents in a viewer. To access documents programmatically:

```
https://{baseUrl}/DocView.aspx?id={docId}&dbid=0&repo={repoName}
```

### Direct PDF Download

Laserfiche provides an `ElectronicFile.aspx` endpoint for direct file download:

```typescript
async function downloadDocument(
  baseUrl: string,
  docId: number,
  cookies: Map<string, string>
): Promise<ArrayBuffer | null> {
  // Method 1: ElectronicFile endpoint (preferred)
  const url = `${baseUrl}/ElectronicFile.aspx?docid=${docId}&dbid=0`;
  
  const response = await fetch(url, {
    headers: {
      Cookie: cookieString(cookies),
      Accept: "application/pdf,*/*",
    },
  });
  
  if (!response.ok) return null;
  
  // Check content type - might be PDF, TIFF, or other format
  const contentType = response.headers.get("content-type");
  console.log(`Document ${docId} content-type: ${contentType}`);
  
  return response.arrayBuffer();
}
```

### Handling Multi-Page Documents

Some documents are stored as multi-page TIFFs. The API may return individual pages:

```typescript
// Get specific page
const pageUrl = `${baseUrl}/ElectronicFile.aspx?docid=${docId}&page=${pageNum}&dbid=0`;

// Get all pages (when available)
const allPagesUrl = `${baseUrl}/ElectronicFile.aspx?docid=${docId}&dbid=0&allpages=1`;
```

### Document Metadata Endpoint

To get document metadata without downloading:

```typescript
async function getDocumentMetadata(docId: number) {
  const response = await fetch(`${baseUrl}/FolderListingService.aspx/GetMetadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Requested-With": "XMLHttpRequest",
      Cookie: cookieString(cookies),
    },
    body: JSON.stringify({
      repoName,
      entryId: docId,
    }),
  });
  return response.json();
}
```

---

## Recursive Folder Traversal

### Walking the Entire Repository

```typescript
interface Entry {
  id: number;
  name: string;
  type: "Folder" | "Document";
  path: string;
  children?: Entry[];
}

async function walkFolder(
  client: WebLinkClient,
  folderId: number,
  path: string = ""
): Promise<Entry[]> {
  const { folderName, entries } = await client.getAllEntries(folderId);
  const currentPath = path ? `${path}/${folderName}` : folderName;
  
  const results: Entry[] = [];
  
  for (const entry of entries) {
    const entryWithPath = { ...entry, path: currentPath };
    
    if (entry.type === "Folder") {
      // Recurse into subfolder
      console.log(`Entering folder: ${currentPath}/${entry.name}`);
      const children = await walkFolder(client, entry.id, currentPath);
      results.push({ ...entryWithPath, children });
      
      // Rate limiting - be nice to the server
      await sleep(100);
    } else {
      results.push(entryWithPath);
    }
  }
  
  return results;
}

// Usage
const allDocuments = await walkFolder(client, rootFolderId);
```

### Flattening for Document List

```typescript
function flattenEntries(entries: Entry[]): Entry[] {
  const flat: Entry[] = [];
  
  function recurse(items: Entry[]) {
    for (const item of items) {
      if (item.type === "Document") {
        flat.push(item);
      }
      if (item.children) {
        recurse(item.children);
      }
    }
  }
  
  recurse(entries);
  return flat;
}
```

---

## Hardcoded Values & How to Find Them

### Values That Are Always the Same

| Value | What It Is | Notes |
|-------|-----------|-------|
| `dbid=0` | Database ID | Always `0` for single-repo installations |
| `vdirName="WebLink"` | Virtual directory | Standard installation path |
| `getNewListing=true` | Fresh data flag | Use `true` for initial request |

### Values That Vary by Installation

| Value | Where to Find It | Example |
|-------|-----------------|---------|
| `repoName` | URL parameter `repo=` | `CityofArcadia` |
| `baseUrl` | Browser address bar | `https://laserfiche.arcadiaca.gov/WebLink` |
| `rootFolderId` | Browse to root, check `id=` param | `1` (often) |

### Extracting Config from Page Source

When you first visit a WebLink portal, the page contains a JavaScript initialization object:

```html
<script>
run({ str_json: {
  "rootFolder": 1,
  "repoName": "CityofArcadia",
  "hasSearchRights": true,
  "hasExportRights": true,
  "dbidRepoName": "dbid=0&repo=CityofArcadia",
  ...
}})
</script>
```

**Automated extraction:**

```typescript
async function extractConfig(baseUrl: string): Promise<WebLinkConfig | null> {
  const response = await fetch(`${baseUrl}/Browse.aspx?id=1&dbid=0`);
  const html = await response.text();
  
  // Extract the JSON config
  const match = html.match(/str_json:\s*(\{[^}]+\})/);
  if (!match) return null;
  
  const config = JSON.parse(match[1]);
  return {
    baseUrl,
    repoName: config.repoName,
    dbid: 0,
    rootFolderId: config.rootFolder,
  };
}
```

---

## Version Differences

### Identifying WebLink Version

The version is in the JavaScript file URLs:

```
app/dist/browse/main.js?v=11.0.2411.10
                          ^^^^^^^^^^^^
                          Version string
```

### Known Version Differences

| Version | Response Format | Notes |
|---------|----------------|-------|
| 10.x | `{ "d": { ... } }` | Legacy ASP.NET wrapper |
| 11.x | `{ "data": { ... } }` | Modern format |

**Handle both:**

```typescript
function unwrapResponse(response: any) {
  return response.data || response.d || response;
}
```

---

## Troubleshooting Guide

### Problem: "Cookies are not enabled" Error

**Symptoms**: Every request redirects to cookie check page

**Diagnosis**:
```typescript
console.log("Cookies being sent:", cookies.size);
console.log("Cookie header:", getCookieHeader());
```

**Solutions**:
1. Ensure you're handling redirects manually
2. Check that `AcceptsCookies=1` cookie is set
3. Verify cookies are being sent with each request

### Problem: 401 Unauthorized on API Calls

**Symptoms**: Session established but API returns 401

**Solutions**:
1. Verify `X-Requested-With: XMLHttpRequest` header is present
2. Check if portal requires authentication (not all are public)
3. Re-initialize session - it may have expired

### Problem: Empty Results Array

**Symptoms**: API returns success but `results: []`

**Possible Causes**:
1. Folder is genuinely empty
2. `folderId` is wrong (check URL in browser)
3. `getNewListing` should be `true`
4. Pagination issue - try `start: 0, end: 1000`

### Problem: Partial Results

**Symptoms**: Getting fewer results than `totalEntries` indicates

**Solution**: Implement pagination properly:

```typescript
async function getAllResults(folderId: number): Promise<any[]> {
  const allResults: any[] = [];
  let start = 0;
  const pageSize = 100;
  let total = Infinity;
  
  while (start < total) {
    const response = await getFolderListing(folderId, start, start + pageSize);
    const data = unwrapResponse(response);
    
    total = data.totalEntries || 0;
    allResults.push(...(data.results || []));
    start += pageSize;
    
    // Avoid infinite loops
    if (data.results?.length === 0) break;
  }
  
  return allResults;
}
```

### Problem: Different Column Data

**Symptoms**: Column indices don't match expected data

**Solution**: Always map columns dynamically:

```typescript
function getColumnValue(result: any, colTypes: any[], columnName: string): any {
  const idx = colTypes.findIndex(c => c.name === columnName);
  return idx >= 0 ? result.data?.[idx] : undefined;
}
```

---

## Building a Multi-City System

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    City Registry                         │
│  ┌──────────┬──────────────────┬───────────────────┐   │
│  │ city_id  │ base_url          │ repo_name         │   │
│  ├──────────┼──────────────────┼───────────────────┤   │
│  │ arcadia  │ laserfiche...    │ CityofArcadia     │   │
│  │ pasadena │ records.pasa...  │ CityofPasadena    │   │
│  └──────────┴──────────────────┴───────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Scraper Service                       │
│  • Session management per city                          │
│  • Rate limiting (per host)                             │
│  • Retry logic with backoff                             │
│  • Concurrent workers                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Document Store                        │
│  • Deduplicate by (city, doc_id)                        │
│  • Track last_seen, first_seen                          │
│  • Store metadata + raw files                           │
└─────────────────────────────────────────────────────────┘
```

### City Registry Schema

```typescript
interface CityConfig {
  id: string;
  name: string;
  baseUrl: string;
  repoName: string;
  dbid: number;
  rootFolders: {
    name: string;
    folderId: number;
    scrapeFrequency: "hourly" | "daily" | "weekly";
  }[];
  lastScraped?: Date;
  status: "active" | "inactive" | "error";
}
```

### Discovering New Cities

**Google Dorks:**
```
site:*.gov "WebLink" "Laserfiche" "public portal"
site:*.gov inurl:/WebLink/Browse.aspx
"Laserfiche Public Portal" site:*.gov
```

**Common Patterns:**
- `laserfiche.{city}.gov/WebLink/`
- `records.{city}.gov/WebLink/`
- `documents.{city}.gov/WebLink/`
- `{city}.gov/laserfiche/WebLink/`
- `ecm.{city}.gov/WebLink/`

**Auto-Discovery Script:**

```typescript
async function probeForWebLink(domain: string): Promise<string | null> {
  const paths = [
    "/WebLink/",
    "/weblink/",
    "/Laserfiche/WebLink/",
    "/laserfiche/WebLink/",
    "/records/WebLink/",
  ];
  
  for (const path of paths) {
    const url = `https://${domain}${path}`;
    try {
      const response = await fetch(url, { 
        redirect: "manual",
        signal: AbortSignal.timeout(5000) 
      });
      
      // WebLink returns 302 to cookie check
      if (response.status === 302) {
        const location = response.headers.get("location") || "";
        if (location.includes("CookieCheck") || location.includes("WebLink")) {
          return url;
        }
      }
      
      // Or 200 with WebLink content
      if (response.status === 200) {
        const html = await response.text();
        if (html.includes("Laserfiche") && html.includes("browse-app")) {
          return url;
        }
      }
    } catch {
      // Connection failed, try next path
    }
  }
  
  return null;
}
```

### Rate Limiting Strategy

```typescript
class RateLimiter {
  private lastRequest: Map<string, number> = new Map();
  private minInterval: number;
  
  constructor(requestsPerSecond: number = 2) {
    this.minInterval = 1000 / requestsPerSecond;
  }
  
  async throttle(host: string): Promise<void> {
    const now = Date.now();
    const last = this.lastRequest.get(host) || 0;
    const wait = Math.max(0, this.minInterval - (now - last));
    
    if (wait > 0) {
      await new Promise(r => setTimeout(r, wait));
    }
    
    this.lastRequest.set(host, Date.now());
  }
}
```

---

## Security Considerations

### Respecting robots.txt

Always check `robots.txt` before scraping:

```typescript
async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const url = new URL(baseUrl);
    const robotsUrl = `${url.origin}/robots.txt`;
    const response = await fetch(robotsUrl);
    const text = await response.text();
    
    // Simple check - real implementation should parse properly
    if (text.includes("Disallow: /WebLink")) {
      console.warn("robots.txt disallows /WebLink scraping");
      return false;
    }
    return true;
  } catch {
    return true; // No robots.txt = allowed
  }
}
```

### Terms of Service

- Most government portals are public records intended for access
- Check for Terms of Service links on the portal
- Avoid excessive request rates
- Don't bypass authentication if present

### Data Privacy

- Public records may still contain sensitive information
- Be cautious about storing/redistributing downloaded documents
- Some documents may have been posted in error

---

## Next Steps

### Building a Production System

1. **Config Management**: Create a database of city configurations
2. **Scheduler**: Set up cron jobs for regular scraping
3. **Deduplication**: Track document IDs to avoid re-downloading
4. **Document Download**: Use `ElectronicFile.aspx` for PDF download
5. **Full-Text Search**: Index document contents (OCR if needed)
6. **Change Detection**: Compare folder listings to detect new documents
7. **Alerting**: Notify on new documents in watched folders
8. **Dashboard**: Monitor scraping status across all cities

---

## Appendix A: Known WebLink Installations

### Verified Configurations

| City | Base URL | Repo Name | Notes |
|------|----------|-----------|-------|
| Arcadia, CA | `https://laserfiche.arcadiaca.gov/WebLink` | `CityofArcadia` | City Council, Planning Commission docs |

### Configuration Template

```typescript
// Add to your city registry
const newCity: CityConfig = {
  id: "your_city_id",
  name: "City Name, ST",
  baseUrl: "https://...",
  repoName: "CityOf...",  // Found in URL param: repo=
  dbid: 0,                // Almost always 0
  rootFolders: [
    { name: "City Council", folderId: 12345, scrapeFrequency: "daily" },
    { name: "Planning", folderId: 12346, scrapeFrequency: "weekly" },
  ],
  status: "active",
};
```

---

## Appendix B: API Quick Reference

### Session Initialization
```bash
# Step 1: Get initial cookies
curl -c cookies.txt -L "https://HOST/WebLink/"

# Step 2: Hit login
curl -b cookies.txt -c cookies.txt -L "https://HOST/WebLink/Login.aspx?dbid=0&repo=REPO"
```

### Get Folder Contents
```bash
curl -X POST "https://HOST/WebLink/FolderListingService.aspx/GetFolderListing2" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "X-Requested-With: XMLHttpRequest" \
  -b cookies.txt \
  -d '{"repoName":"REPO","folderId":123,"getNewListing":true,"start":0,"end":100,"sortColumn":"name","sortAscending":true}'
```

### Download Document
```bash
curl -b cookies.txt -o document.pdf "https://HOST/WebLink/ElectronicFile.aspx?docid=123&dbid=0"
```

---

## Appendix C: Common Folder Structures

Government WebLink portals typically organize documents like:

```
/ (Root)
├── City Council/
│   ├── Agendas/
│   │   └── 2025/
│   │       ├── 01-15-2025/
│   │       ├── 02-05-2025/
│   │       └── ...
│   └── Minutes/
│       └── 2025/
├── Planning Commission/
│   ├── Agendas/
│   └── Minutes/
├── Building Permits/
├── Public Records/
└── Historical Archives/
```

**Tip**: Start by scraping the root folder (`id=1`) to discover the structure, then configure specific folders to monitor.

---

## Resources

- [Laserfiche WebLink Documentation](https://doc.laserfiche.com/laserfiche.documentation/11/userguide/en-us/Subsystems/WebLink/Content/Introduction.htm)
- [Laserfiche Developer Portal](https://developer.laserfiche.com/)
- [Laserfiche Support KB](https://support.laserfiche.com/)

---

## Changelog

- **2025-12-16**: Initial documentation based on Arcadia, CA portal analysis
  - Discovered `FolderListingService.aspx` endpoints
  - Documented session initialization flow
  - Added multi-city system architecture

---

*Last updated: December 16, 2025*
