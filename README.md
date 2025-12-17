# Laserfiche WebLink Client

A TypeScript library and CLI for accessing Laserfiche WebLink public portals, specifically designed for the City of Arcadia's document repository.

## Features

- **Library**: Reusable TypeScript client for Laserfiche WebLink API
- **CLI**: Interactive folder browser and direct fetch commands
- **Multi-select**: Select and fetch multiple folders at once
- **Metadata**: Includes creation and modification dates for all documents

## Installation

```bash
# Clone the repository
git clone <your-repo>
cd arcadia

# No installation needed - uses Bun runtime
```

## Usage

### Interactive Browse Mode

Navigate through folders interactively and select which ones to fetch:

```bash
bun run browse
```

**Commands:**
- Enter a number to navigate into a folder (e.g., `1`)
- Enter multiple numbers comma-separated to select multiple (e.g., `1,3,5`)
- Enter a range to select multiple (e.g., `1-5`)
- `a` - Select all visible folders
- `c` - Clear selection
- `f` - Fetch selected folder(s)
- `b` - Go back to parent folder
- `q` - Quit

### Direct Fetch Mode

Fetch a specific folder directly:

```bash
# Fetch default folder (874714)
bun run fetch

# Fetch specific folder by ID
bun run fetch 123456
```

### Legacy Script

The original `arcadia-files.ts` still works for backward compatibility:

```bash
bun run arcadia-files.ts 874714
```

## Library Usage

You can import and use the library in your own projects:

```typescript
import { WebLinkClient, type WebLinkConfig } from "./src/lib/index";

const config: WebLinkConfig = {
  baseUrl: "https://laserfiche.arcadiaca.gov/WebLink",
  repoName: "CityofArcadia",
  dbid: 0,
};

const client = new WebLinkClient(config);

// Initialize session
await client.initSession();

// Browse a folder
const { folderName, entries } = await client.browseFolder(1);

// Get all entries with pagination
const all = await client.getAllEntries(874714);
```

## Project Structure

```
arcadia/
├── src/
│   ├── lib/              # Reusable library code
│   │   ├── types.ts      # TypeScript interfaces
│   │   ├── utils.ts      # Helper functions
│   │   ├── WebLinkClient.ts  # Core API client
│   │   └── index.ts      # Public exports
│   └── cli/              # CLI application
│       ├── ui.ts         # UI helpers
│       ├── commands/     # CLI commands
│       │   ├── browse.ts # Interactive browser
│       │   └── fetch.ts  # Direct fetch
│       └── index.ts      # CLI entry point
├── package.json          # Package configuration
├── tsconfig.json         # TypeScript configuration
└── arcadia-files.ts      # Legacy script (deprecated)
```

## Output

Both CLI modes save results to JSON files:

- Fetch mode: `arcadia-entries.json`
- Browse mode (multi-select): `arcadia-<folder-name>-<id>.json`

Example output structure:

```json
{
  "folderId": 874714,
  "folderName": "12/16/2025",
  "repository": "CityofArcadia",
  "fetchedAt": "2025-12-16T21:08:46.772Z",
  "totalEntries": 10,
  "folders": [],
  "documents": [
    {
      "id": 874740,
      "name": "Agenda - December 16, 2025",
      "type": "Document",
      "pageCount": 7,
      "template": "CC - Agendas",
      "creationDate": "12/12/2025 12:04:57 AM",
      "modificationDate": "12/12/2025 12:05:03 AM",
      "url": "https://..."
    }
  ]
}
```

## Documentation

See [LASERFICHE_API.md](LASERFICHE_API.md) for detailed API documentation and information about adapting this for other cities.

## License

MIT
