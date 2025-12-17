# Claude Development Guide

This document provides context for AI assistants (like Claude) working on this project.

## Project Overview

This is a TypeScript library and CLI tool for accessing Laserfiche WebLink public portals, specifically designed for the City of Arcadia's document repository. It provides both programmatic access (library) and interactive command-line tools (CLI) for browsing and fetching government documents.

## Runtime & Tooling

### Bun (Required)
- **This project uses Bun as its runtime**, not Node.js
- Run scripts with: `bun run <script>`
- No build step required - TypeScript is executed directly
- No npm install needed - Bun handles dependencies natively

### Key Commands
```bash
bun run browse          # Interactive folder browser
bun run fetch [id]      # Direct folder fetch
bun run arcadia-files.ts [id]  # Legacy script (deprecated)
```

## Architecture

### Clean Separation: Library + CLI

```
src/
├── lib/              # Reusable library (no console output, config-driven)
│   ├── types.ts      # TypeScript interfaces
│   ├── utils.ts      # Helper functions
│   ├── WebLinkClient.ts  # Core API client
│   └── index.ts      # Public exports
└── cli/              # CLI application (user-facing)
    ├── ui.ts         # Console UI helpers
    ├── commands/
    │   ├── browse.ts # Interactive browser with readline
    │   └── fetch.ts  # Direct fetch command
    └── index.ts      # CLI entry point
```

**Important Design Principles:**
1. **Library code (`src/lib/`)** should NEVER use `console.log` or have side effects
2. **Library is config-driven** - accepts `WebLinkConfig` to support multiple cities
3. **CLI code (`src/cli/`)** handles all user interaction and output
4. Keep backward compatibility with `arcadia-files.ts`

## Critical Implementation Details

### 1. Session Management
The Laserfiche WebLink API requires session initialization with cookies:
```typescript
const client = new WebLinkClient(config);
await client.initSession();  // MUST be called before any API requests
```

### 2. Readline Quirks
The browse command uses Node.js `readline` for interactive prompts:
- **Create ONE readline interface per session** and reuse it
- Readline interfaces close automatically when stdin receives EOF
- Testing with piped input (`echo | bun run browse`) won't work - requires real TTY
- Always check if interface is closed before calling `.question()`

See [src/cli/ui.ts:61-99](src/cli/ui.ts#L61-99) for the implemented solution.

### 3. API Response Format Variations
Laserfiche API can return data in two formats:
```typescript
response.data  // Modern format (v11.x)
response.d     // Legacy ASP.NET format (v10.x)
```
Always handle both: `const data = response.data || response.d;`

### 4. Entry Type Handling
Document types can be:
- `0` = Folder
- `1` = Document
- `-2` = Document (alternate)
- `2` = Shortcut

Always check for both `1` and `-2` when filtering documents.

### 5. Pagination
`getAllEntries()` handles pagination automatically with 500 items per page.
`browseFolder()` only fetches first 100 entries (for interactive browsing).

## Configuration

### Hardcoded for Now
Arcadia config is hardcoded in [src/cli/index.ts:13-17](src/cli/index.ts#L13-17):
```typescript
const ARCADIA_CONFIG: WebLinkConfig = {
  baseUrl: "https://laserfiche.arcadiaca.gov/WebLink",
  repoName: "CityofArcadia",
  dbid: 0,
};
```

### Future: Multi-City Support
The library is already config-driven. To add more cities:
1. Create a `cities.json` config file
2. Update CLI to accept `--city` flag
3. Library code requires NO changes

## Testing

### What Works
- `bun run fetch 874714` - Works perfectly (tested)
- Library functions work programmatically
- Browse command works in interactive terminal

### What Doesn't Work
- Piped input to browse: `echo "1\nq" | bun run browse`
  - This is expected - readline requires TTY
  - Test browse manually in terminal instead

### Test Commands
```bash
# Test fetch (automated)
bun run fetch 874714

# Test browse (manual - requires interactive terminal)
bun run browse
# Then type: 1 [Enter], q [Enter]
```

## Data Format

### Column Mapping
API returns data as parallel arrays:
```typescript
colTypes = [{ name: "PageCount" }, { name: "TemplateName" }, ...]
result.data = [7, "CC - Agendas", ...]
```

Find column indices dynamically:
```typescript
const pageCountIdx = colTypes.findIndex(c => c.name === "PageCount");
const pageCount = result.data[pageCountIdx];
```

### Date Fields
- `CreationDate` - Creation timestamp
- `LastModified` - Last modification timestamp

Format: "MM/DD/YYYY HH:MM:SS AM/PM"

## Common Tasks

### Adding a New CLI Command
1. Create `src/cli/commands/your-command.ts`
2. Export async function that accepts `WebLinkConfig`
3. Import and route in `src/cli/index.ts`
4. Add script to `package.json`

### Adding Library Functionality
1. Add method to `WebLinkClient` class in `src/lib/WebLinkClient.ts`
2. Add types to `src/lib/types.ts` if needed
3. Export from `src/lib/index.ts`
4. Update `README.md` library usage section

### Debugging API Issues
1. Check session is initialized: `await client.initSession()`
2. Verify cookies are being sent (check `getCookieHeader()`)
3. Check response format: `data` vs `d`
4. Verify folder ID is valid (browse in web UI first)

## File Changes to Avoid

### Protected Files
- `arcadia-files.ts` - Keep for backward compatibility, only update deprecation notice
- `LASERFICHE_API.md` - Comprehensive API documentation, don't modify unless adding new discoveries

### When Making Changes
- Library code: No console.log, no side effects, keep config-driven
- CLI code: All user interaction happens here
- Always run `bun run fetch` test after library changes
- Update README.md if adding user-facing features

## Documentation

- `README.md` - User-facing documentation (installation, usage, examples)
- `LASERFICHE_API.md` - Deep technical API documentation
- `CLAUDE.md` (this file) - AI assistant development guide

## Known Limitations

1. **Browse command requires interactive terminal** - No automated testing via pipes
2. **Hardcoded Arcadia config** - Multi-city support planned but not implemented
3. **No document download yet** - Only fetches metadata, not PDF files
4. **No recursive folder traversal** - Must navigate folders one level at a time
5. **No caching** - Each fetch makes fresh API requests

## Dependencies

- **Runtime:** Bun (no package.json dependencies)
- **Built-in APIs used:**
  - `fetch` - HTTP requests
  - `readline` - Interactive prompts
  - `fs` - File I/O for JSON output
  - `process` - stdin/stdout/argv

## Getting Started (for AI Assistants)

When starting work on this project:
1. Use `bun run` for all commands (not `node` or `npm`)
2. Read the architecture section above to understand lib/cli separation
3. Check `LASERFICHE_API.md` for API details
4. Test changes with `bun run fetch 874714`
5. Remember: library code = no side effects, CLI code = user interaction
