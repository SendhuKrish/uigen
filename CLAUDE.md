# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. It uses Claude AI to generate React components through a chat interface and displays them in real-time using a virtual file system (no files written to disk).

## Tech Stack

- Next.js 15 with App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Prisma with SQLite (database in `prisma/dev.db`)
- Anthropic Claude AI via Vercel AI SDK
- Babel Standalone (for runtime JSX transformation)
- Monaco Editor (code editor)
- Vitest (testing)

## Development Commands

```bash
# Install dependencies and initialize database
npm run setup

# Run development server (Turbopack enabled)
npm run dev

# Run tests
npm test

# Run linter
npm run lint

# Build for production
npm run build

# Start production server
npm start

# Reset database (deletes all data)
npm run db:reset
```

## Database Management

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name <migration-name>

# View database in Prisma Studio
npx prisma studio
```

Note: Prisma client is generated to `src/generated/prisma/` (not the default location).

## Architecture

### Virtual File System

The core architecture centers around a **VirtualFileSystem** class (`src/lib/file-system.ts`) that maintains an in-memory representation of files. This is not a real file system - no files are written to disk.

- Files are stored as a Map with path keys and FileNode values
- Tree structure maintained through parent-child relationships
- All file operations (create, read, update, delete, rename) happen in memory
- File system state is serialized to JSON and stored in the database for persistence

### AI Integration Flow

1. **Chat Interface** (`src/components/chat/ChatInterface.tsx`) collects user input
2. **API Route** (`src/app/api/chat/route.ts`) receives messages and current file system state
3. **AI Tools** provided to Claude:
   - `str_replace_editor` (view, create, str_replace, insert commands) - in `src/lib/tools/str-replace.ts`
   - `file_manager` (rename, delete) - in `src/lib/tools/file-manager.ts`
4. **AI generates/modifies files** through tool calls, updating the VirtualFileSystem
5. **File system serialized** and saved to database (for authenticated users)
6. **Preview rendered** by transforming JSX to ES modules using Babel

### Live Preview System

The preview system (`src/components/preview/PreviewFrame.tsx`) works by:

1. Collecting all files from VirtualFileSystem
2. Transforming JSX/TSX to JavaScript using Babel (`src/lib/transform/jsx-transformer.ts`)
3. Creating blob URLs for each transformed module
4. Generating an import map mapping module paths to blob URLs
5. Injecting a preview HTML document with the import map into an iframe
6. Entry point looks for `/App.jsx`, `/App.tsx`, `/index.jsx`, etc.

Key details:
- Uses import maps to support ES modules with blob URLs
- Handles `@/` path aliases mapping to root directory
- External packages loaded from `esm.sh` CDN
- CSS files collected and injected as `<style>` tags
- Syntax errors displayed with formatted error messages

### Authentication & Projects

- JWT-based authentication (`src/lib/auth.ts`) with httpOnly cookies
- Anonymous users tracked with a work counter in localStorage (`src/lib/anon-work-tracker.ts`)
- Projects stored in SQLite database with Prisma ORM
- Each project contains:
  - `messages`: Serialized chat history
  - `data`: Serialized VirtualFileSystem state

### State Management

Uses React Context for global state:
- **ChatContext** (`src/lib/contexts/chat-context.tsx`): Manages messages, streaming, and chat interactions
- **FileSystemContext** (`src/lib/contexts/file-system-context.tsx`): Provides access to VirtualFileSystem, tracks file changes

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/chat/          # Streaming chat API endpoint
│   └── [projectId]/       # Dynamic project page
├── components/
│   ├── auth/              # Sign in/up forms
│   ├── chat/              # Chat interface components
│   ├── editor/            # Monaco code editor & file tree
│   ├── preview/           # Preview iframe component
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── contexts/          # React Context providers
│   ├── prompts/           # System prompts for AI
│   ├── tools/             # AI tool implementations
│   ├── transform/         # JSX transformation logic
│   ├── file-system.ts     # Virtual file system implementation
│   ├── auth.ts            # JWT authentication
│   ├── prisma.ts          # Prisma client singleton
│   └── provider.ts        # AI model provider (mock or real)
├── actions/               # Next.js Server Actions
└── generated/prisma/      # Generated Prisma client
```

## Code Style

- Use comments sparingly. Only comment complex code.

## Testing

Tests use Vitest with jsdom environment. Test files located next to source files in `__tests__/` directories.

Run tests with:
```bash
npm test
```

## Environment Variables

The project works without any environment variables (uses mock AI provider).

Optional:
- `ANTHROPIC_API_KEY`: Claude API key (without this, static mock responses are used)
- `JWT_SECRET`: JWT signing secret (defaults to "development-secret-key")

## Important Notes

- The virtual file system is the single source of truth for all generated code
- When the AI calls tools, it modifies the VirtualFileSystem, which triggers a preview refresh
- Preview updates happen automatically via React Context state changes
- The system supports both authenticated users (data saved to DB) and anonymous users (localStorage only)
- Import maps are critical for the preview - they map module specifiers to blob URLs
- The `@/` path alias maps to the root `/` directory in the virtual file system
