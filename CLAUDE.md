# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

无边记 AI (Infinite Canvas AI) - A web-based infinite canvas note-taking tool with AI capabilities. Inspired by Apple Freeform, this tool helps extend human thinking by providing an unlimited canvas to organize ideas with AI-powered content expansion and summarization.

**Core Philosophy**: Human working memory (RAM) is limited, so external recording and AI-assisted thinking are essential.

## Key Technologies

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Local Storage**: Dexie.js (IndexedDB wrapper)
- **AI**: Custom Claude API proxy (OpenAI-compatible format)
- **UI Components**: Radix UI, cmdk, tldraw

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (uses Turbopack)
npm run dev

# Build for production (uses Turbopack)
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

Development server runs at http://localhost:3000

## Environment Setup

Required environment variable in `.env.local`:

```
ANTHROPIC_API_KEY=your_api_key_here
```

**Important**: This project uses a custom Claude API proxy at `https://lumos.diandian.info/winky/claude` with OpenAI-compatible format. Contact the administrator for API keys.

## Architecture

### State Management Architecture

The application uses a centralized Zustand store (`lib/store.ts`) for all canvas and node state management:

- **Canvas State**: Current canvas data, loading states
- **Node Management**: CRUD operations with automatic IndexedDB persistence
- **Selection State**: Multi-node selection tracking
- **AI Processing**: Global AI operation state
- **History/Undo**: Implements undo/redo via history stack
- **Mind Map Operations**: Special handlers for hierarchical node relationships
- **Chat System**: Chat window state, message history, and canvas context tracking

All state mutations automatically sync to IndexedDB through the database layer.

### Database Layer (`lib/db.ts`)

Uses Dexie.js to wrap IndexedDB with three main tables:

- `canvases`: Canvas metadata (id, name, timestamps)
- `nodes`: All node data with indexes on type, timestamps, and AI metadata
- `chatMessages`: Chat history per canvas with timestamps

**Key Pattern**: The store references nodes by ID. Canvas.nodes array stores node references, while actual node data lives in the nodes table. This prevents data duplication.

**Schema Versioning**: Currently at version 2. When adding new tables or indexes, increment the version number in the database constructor and add a new `this.version(N).stores()` block.

### Data Flow

1. User interactions → Store actions (`lib/store.ts`)
2. Store actions → Database operations (`lib/db.ts`)
3. Database updates → Store state updates
4. Store updates → React re-renders

### AI Integration

AI features use a client-server pattern:

- **Client**: `lib/ai.ts` - API wrappers for expand/summarize
- **Server**: `app/api/ai/[action]/route.ts` - Next.js API routes that call Claude
- **Models**:
  - `claude-3-5-haiku-20241022` - Fast, cost-effective model for expand/summarize operations
  - `claude-sonnet-4-5-20250929` - More powerful model for chat conversations with streaming support
- **Prompts**: Chinese language prompts optimized for brief content expansion
- **Format**: OpenAI-compatible format with `v1/chat/completions` endpoint

#### API Endpoints

| Endpoint | Model | Max Tokens | Streaming | Purpose |
|----------|-------|-----------|-----------|---------|
| `/api/ai/expand` | claude-3-5-haiku | 1024 | No | Expand node content in-place |
| `/api/ai/summarize` | claude-3-5-haiku | 512 | No | Create summary node above original |
| `/api/ai/chat` | claude-sonnet-4-5 | 4096 | Yes | Context-aware canvas conversations |

**Chat API Request Format**:
```typescript
POST /api/ai/chat
{
  userMessage: string,              // User's message with optional references
  initialNodes: CanvasNode[],       // Snapshot when chat opened
  nodeChanges: {                    // Changes since chat started
    newNodes: CanvasNode[],
    modifiedNodes: CanvasNode[],
    deletedNodeIds: string[]
  } | null,
  chatHistory: ChatMessage[]        // Previous conversation for context
}
```

**Streaming Response**: Server-sent events (SSE) format with `data:` prefixed JSON chunks, ending with `data: [DONE]`.

### Chat System Architecture

The chat system maintains context awareness by:

1. **Initial Snapshot**: When chat opens, records current node IDs and timestamp
2. **Change Detection**: `lib/context-builder.ts` tracks new/modified/deleted nodes since chat started
3. **Context Building**: Formats canvas state and changes into readable Chinese text for AI
4. **References**: Users can explicitly attach node content to messages via chat references

**Multi-Session Support**: The chat system supports multiple concurrent chat sessions per canvas, each with:
- Independent message history
- Separate window position and size
- Own set of references
- Isolated context snapshots

### Node Types

The system supports multiple node types (defined in `types/index.ts`):

- `text`: Standard text cards
- `sticky`: Colored sticky notes
- `mindmap`: Hierarchical mind map nodes with parent-child relationships
- `ai-generated`: Deprecated in favor of `aiMetadata` field

Mind map nodes include `mindMapMetadata` with level, collapse state, order, and layout type.

### Node Customization

All nodes support style customization through the PropertyPanel:

- **Text Color**: 9 preset colors (black, gray, red, orange, yellow, green, blue, purple, pink)
- **Background Color**: 6 preset colors plus transparent option (for text nodes)
- **Font Size**: Adjustable in pixels
- **Font Weight**: Normal or bold

Access the PropertyPanel by selecting a node and pressing the Shift key.

### Component Structure

```
components/
├── Canvas/           # Canvas rendering and interactions
│   ├── Canvas.tsx            # Main canvas component
│   ├── CanvasToolbar.tsx     # Add node buttons
│   └── HelpButton.tsx        # Help dialog
├── Nodes/            # Different node type renderers
│   ├── TextNode.tsx
│   └── StickyNote.tsx
├── MindMap/          # Mind map specific components
│   ├── MindMapNode.tsx       # Hierarchical node rendering
│   └── MindMapConnection.tsx # Parent-child connections
├── AI/               # AI feature UI
│   └── AIToolbar.tsx         # Expand/summarize buttons
├── Chat/             # Chat system UI
│   ├── ChatButton.tsx        # Toggle chat window
│   └── ChatWindow.tsx        # Chat interface with streaming
└── PropertyPanel/    # Node styling and properties
    └── PropertyPanel.tsx     # Text color, background, font settings
```

### Layout System

Mind map auto-layout is handled in `lib/mindmap-layout.ts`:

- Calculates positions based on tree structure
- Supports horizontal and vertical layouts
- Handles collapsed node visibility
- Uses configurable spacing constants (HORIZONTAL_SPACING, VERTICAL_SPACING)

**Key Functions**:
- `calculateMindMapLayout()`: Returns Map of node IDs to new positions
- `getAllDescendantIds()`: Gets all children recursively for collapse operations

## TypeScript Path Aliases

The project uses `@/*` path alias mapped to the root directory:

```typescript
import { db } from '@/lib/db';
import type { CanvasNode } from '@/types';
```

## Canvas Interaction Patterns

- **Pan**: Shift + drag mouse, middle-click drag
- **Zoom**: Ctrl/Cmd + scroll wheel (range: 0.1x - 3x)
- **Move Canvas**: Scroll wheel
- **Select Node**: Click node
- **Deselect All**: Click canvas background
- **Edit Node**: Double-click node
- **Save Edit**: Ctrl/Cmd + Enter
- **Cancel Edit**: Esc
- **Delete Node**: Backspace/Delete when selected
- **Undo**: Ctrl/Cmd + Z
- **Redo**: Ctrl/Cmd + Shift + Z (or Ctrl/Cmd + Y on Windows)
- **Show AI Toolbar**: Tab key (when node selected)
- **Show Properties**: Shift key (when node selected)
- **Add Mind Map Child**: Tab key (in mind map node)

### Viewport Coordinate System

The canvas maintains two coordinate systems that must be converted between:

**Screen Coordinates**: Mouse/viewport pixel positions (origin: top-left of viewport)
**Canvas Coordinates**: Node positions (origin: arbitrary, supports negative coordinates)

**Transformation Formulas**:
```typescript
// Screen → Canvas (for mouse events)
canvasX = (screenX - viewportOffset.x) / zoom
canvasY = (screenY - viewportOffset.y) / zoom

// Canvas → Screen (for rendering)
screenX = (canvasX * zoom) + viewportOffset.x
screenY = (canvasY * zoom) + viewportOffset.y
```

When implementing canvas features that involve mouse interaction (dragging, clicking), always convert screen coordinates to canvas coordinates before storing positions in the database.

## AI Feature Implementation

When implementing AI features:

1. Add API route in `app/api/ai/[feature]/route.ts`
2. Create client wrapper in `lib/ai.ts`
3. Add UI trigger in appropriate component (usually AIToolbar)
4. Use the proxy endpoint format with OpenAI-compatible schema:
   - **Endpoint**: `https://lumos.diandian.info/winky/claude/v1/chat/completions`
   - **Authorization**: `Bearer ${process.env.ANTHROPIC_API_KEY}`
   - **Content-Type**: `application/json`
5. Tag generated nodes with proper `aiMetadata`

**Request Format**:
```typescript
{
  model: 'claude-3-5-haiku-20241022' | 'claude-sonnet-4-5-20250929',
  max_tokens: number,
  messages: [{ role: 'user' | 'assistant' | 'system', content: string }],
  stream?: boolean  // Enable for chat, disable for expand/summarize
}
```

Prompts should be in Chinese and optimized for brevity since the UI targets Chinese users.

## Database Schema Notes

- All IDs use `crypto.randomUUID()`
- Timestamps are Unix epoch milliseconds
- Canvas updates automatically update `updatedAt` timestamp
- Node deletion cascades to remove from canvas references
- IndexedDB schema version is currently 2 (increment if schema changes)
- When upgrading schema, add a new `this.version(N).stores()` block in `lib/db.ts`

## Context Building System

The `lib/context-builder.ts` module provides:

- **formatNodesForContext()**: Converts nodes to structured Chinese text grouped by type
- **buildInitialContext()**: Creates initial canvas snapshot description
- **detectNodeChanges()**: Compares current state against initial snapshot
- **buildIncrementalContext()**: Generates change summary for AI awareness

This system enables the chat AI to understand what's on the canvas and what changed during the conversation.

## Error Handling Strategy

The application implements multi-layered error handling:

### Component Level
- Try-catch blocks in async event handlers
- Local error state with automatic timeout (typically 3 seconds)
- User-friendly error messages displayed in UI
- Example: AIToolbar shows error message when AI request fails

### Store Level
- Catch errors in async store actions
- Log errors to console for debugging
- Re-throw for component-level handling when appropriate

### API Level
- Input validation returns 400 Bad Request
- External API failures return 500 Internal Server Error
- Streaming errors handled via error event handlers
- Missing API key returns clear error message

### Database Level
- Catch Dexie errors on database open
- Schema migration errors logged to console
- Silent failure for non-critical updates (e.g., timestamp updates)
- Cascade deletion ensures referential integrity

**Pattern**: Fail gracefully at each layer, log for developers, show friendly messages to users.

## Performance Considerations

### Current Optimizations
- **React.memo**: Node components memoized to prevent unnecessary re-renders
- **Lazy Layout Calculation**: Mind map layout computed on-demand, not stored
- **IndexedDB Indexing**: Efficient queries on id, type, timestamps, and aiMetadata
- **Streaming Responses**: Chat uses SSE for perceived faster AI responses
- **Viewport Culling**: Only visible nodes rendered (future enhancement)

### Known Limitations
- Large canvases (>10,000 nodes) may experience performance degradation
- No pagination of chat history (all messages loaded at once)
- Mind map layout recalculation is O(n) for entire tree
- No virtualization for off-screen nodes (assumed <1000 nodes typical)

### Scalability Notes
- IndexedDB scales to millions of records efficiently
- Zustand store handles thousands of nodes in memory
- Performance bottleneck likely in React rendering, not data layer
- Consider implementing viewport-based virtualization for very large canvases

## Testing & Development

- The app is local-first with no backend dependency beyond AI API calls
- Test canvas operations in browser DevTools → Application → IndexedDB
- Use React DevTools to inspect Zustand store state
- All node operations should persist immediately to IndexedDB
- Chat history persists per canvas and survives page reloads
