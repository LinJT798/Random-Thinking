# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 Important Development Rules

**Git Push Policy - CRITICAL**:
- ⛔ **NEVER EVER** push code to remote repository without explicit user permission
- ⛔ **DO NOT** automatically push after committing
- ⛔ **DO NOT** push even if the feature seems complete
- ✅ **ALWAYS** commit changes locally first
- ✅ **ALWAYS** wait for user to say "push" or "push it" before pushing
- ✅ **ONLY** push when user explicitly requests: "push", "push code", "push it", "提交代码" etc.
- This is a **STRICT** rule - violating it causes problems for the user
- The user wants to review changes before they go to remote repository

## Project Overview

无边记 AI (Infinite Canvas AI) - A web-based infinite canvas note-taking tool with AI capabilities. Inspired by Apple Freeform, this tool helps extend human thinking by providing an unlimited canvas to organize ideas with AI-powered content expansion and summarization.

**Core Philosophy**: Human working memory (RAM) is limited, so external recording and AI-assisted thinking are essential.

## Key Technologies

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Local Storage**: Dexie.js (IndexedDB wrapper)
- **AI**: Anthropic Claude API (via proxy with native format support)
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

# Type checking (no dedicated script - use Next.js build)
npx tsc --noEmit
```

Development server runs at http://localhost:3000

**Note**: The project uses TypeScript strict mode. Build process includes type checking via Next.js. There is no dedicated test framework configured (no test script in package.json).

## Environment Setup

Required environment variables in `.env.local`:

```bash
# Required: Anthropic API Key
ANTHROPIC_API_KEY=your_api_key_here

# Optional: Supabase (for cloud sync and authentication)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Important**: This project uses a custom Claude API proxy at `https://lumos.diandian.info/winky/claude` with Anthropic native format support. The `/messages` endpoint supports Extended Thinking and native streaming format. Contact the administrator for API keys.

**Supabase Setup** (optional for cloud sync):
1. Create a project at https://supabase.com/dashboard
2. Execute the SQL schema from `supabase-schema.sql` in SQL Editor
3. Get credentials from Project Settings > API
4. Copy `.env.local.example` to `.env.local` and fill in credentials

The app works fully offline without Supabase (local-first with IndexedDB).

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
- **Tool Call Management**: Handles confirmation/rejection of AI-generated nodes with database persistence

All state mutations automatically sync to IndexedDB through the database layer.

**Key Store Methods**:
- `confirmToolCall(chatId, messageId, toolIndex)`: Marks tool call as confirmed and persists to DB
- `rejectToolCall(chatId, messageId, toolIndex)`: Deletes created nodes, marks as rejected, persists to DB

### Database Layer

The application supports dual-storage architecture:

**IndexedDB (Local-First)** - `lib/db.ts`:
- Uses Dexie.js to wrap IndexedDB with three main tables:
  - `canvases`: Canvas metadata (id, name, timestamps)
  - `nodes`: All node data with indexes on type, timestamps, and AI metadata
  - `chatSessions`: Chat history per canvas with window state and message history
- **Schema Version**: Currently at version 4
- **Key Pattern**: Store references nodes by ID. Canvas.nodes array stores node references, while actual node data lives in the nodes table. This prevents data duplication.

**Supabase (Cloud Sync)** - `lib/supabase-db.ts`:
- Optional cloud storage for multi-device sync and authentication
- Tables: `canvases`, `nodes`, `chat_sessions`
- Row-Level Security (RLS) ensures users only access their own data
- Schema defined in `supabase-schema.sql`

**Sync Manager** - `lib/sync-manager.ts`:
- Bidirectional sync between IndexedDB and Supabase
- Full sync on login (merges local and cloud data by timestamp)
- Incremental sync on canvas updates
- Offline queue for changes made while disconnected
- Conflict resolution: newest timestamp wins

**Schema Versioning**: When adding new tables or indexes to IndexedDB, increment the version number in `lib/db.ts` constructor and add a new `this.version(N).stores()` block. For Supabase, update `supabase-schema.sql`.

### Data Flow

**Local-Only Mode**:
1. User interactions → Store actions (`lib/store.ts`)
2. Store actions → IndexedDB operations (`lib/db.ts`)
3. Database updates → Store state updates
4. Store updates → React re-renders

**With Cloud Sync**:
1. User login → Authentication (`lib/auth-context.tsx` + Supabase Auth)
2. Store actions → IndexedDB (immediate) + Sync queue
3. Sync Manager → Uploads changes to Supabase (`lib/sync-manager.ts`)
4. Periodic sync → Downloads cloud changes to IndexedDB
5. Conflicts resolved by timestamp (newest wins)

### AI Integration

AI features use a client-server pattern:

- **Client**: `lib/ai.ts` - API wrappers for expand/summarize
- **Server**: `app/api/ai/[action]/route.ts` - Next.js API routes that call Claude
- **Models**:
  - `claude-3-5-haiku-20241022` - Fast, cost-effective model for expand/summarize operations
  - `claude-sonnet-4-5-20250929` - More powerful model for chat conversations with streaming support
- **Prompts**: Chinese language prompts optimized for brief content expansion
- **Format**: Anthropic native format with streaming support
- **Endpoint**: `https://lumos.diandian.info/winky/claude/messages`

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

**Streaming Response**: Server-sent events (SSE) format with `data:` prefixed JSON chunks.

Response types:
- `{ type: 'text', content: string }` - AI response text
- `{ type: 'tool_use', tool: string, input: any }` - Tool call request
- Stream ends with `data: [DONE]`

**Tool Use Flow**:
1. Server sends `{ type: 'tool_use', tool: 'add_text_node', input: {...} }`
2. Client executes tool via `handleToolCall()` and creates nodes
3. Tool call info stored in message with `status: 'pending'`
4. User can confirm or reject via UI buttons
5. Confirmation persists to database

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

**Tool Call Confirmation**: When AI creates nodes via tool calls (add_text_node, add_sticky_note, create_mindmap), the user can:
- **Confirm** (保留): Keep the created nodes and mark as confirmed
- **Reject** (删除): Delete the created nodes and mark as rejected
- Confirmation status persists to IndexedDB and survives page reloads
- UI shows pending/confirmed/rejected states with visual indicators

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

### API Routes Structure

The application uses Next.js API Routes for server-side operations:

```
app/
├── api/
│   └── ai/              # AI-powered features
│       ├── expand/route.ts     # Expand node content
│       ├── summarize/route.ts  # Summarize node content
│       ├── chat/route.ts       # AI chat with streaming (SSE)
│       └── welcome/route.ts    # Generate welcome message
├── auth/
│   └── callback/route.ts       # OAuth callback handler
├── login/page.tsx              # Login page
├── signup/page.tsx             # Signup page (disabled)
├── debug/page.tsx              # Debug/testing page
├── app/page.tsx                # App fallback route
├── page.tsx                    # Main canvas page
└── layout.tsx                  # Root layout with providers
```

All AI routes use POST method and return JSON (except `/api/ai/chat` which uses Server-Sent Events for streaming).

### Authentication System

The app supports optional user authentication via Supabase:

- **Auth Context** (`lib/auth-context.tsx`): React context providing auth state and methods
- **Supabase Client** (`lib/supabase.ts`): Browser-side Supabase client with cookie-based sessions
- **Server Client** (`lib/supabase-server.ts`): Server-side Supabase client for API routes
- **Auth Routes**:
  - `/login` - Email/password login page
  - `/signup` - User registration page
  - `/auth/callback` - OAuth callback handler
- **Protected Features**: Cloud sync, multi-device access
- **Unprotected**: Full app functionality works offline without authentication

When authenticated, the app automatically syncs data to cloud and enables the sync status indicator (top-right corner).

### Component Structure

```
components/
├── Canvas/           # Canvas rendering and interactions
│   ├── Canvas.tsx            # Main canvas component
│   ├── CanvasToolbar.tsx     # Add node buttons
│   ├── CanvasSwitcher.tsx    # Switch between canvases
│   ├── HelpButton.tsx        # Help dialog
│   └── SettingsMenu.tsx      # User settings dropdown
├── Nodes/            # Different node type renderers
│   ├── TextNode.tsx          # Standard text card
│   ├── StickyNote.tsx        # Sticky note component
│   ├── TextToolbar.tsx       # Node editing toolbar
│   └── AIConfirmToolbar.tsx  # Tool call confirmation UI
├── MindMap/          # Mind map specific components (feature disabled)
│   ├── MindMapNode.tsx       # Hierarchical node rendering
│   └── MindMapConnection.tsx # Parent-child connections
├── AI/               # AI feature UI
│   └── AIToolbar.tsx         # Expand/summarize buttons
├── Chat/             # Chat system UI
│   ├── ChatButton.tsx        # Toggle chat window
│   ├── ChatWindow.tsx        # Chat interface with streaming responses
│   └── ChatResizer.tsx       # Resize handle for split view
├── Auth/             # Authentication UI
│   ├── AuthForm.tsx          # Login/signup form
│   └── UserMenu.tsx          # User profile dropdown
├── LandingPage/      # Marketing/onboarding pages
│   ├── LandingPage.tsx       # Main landing page
│   ├── TerminalChat.tsx      # Interactive terminal demo
│   └── ScreenTextDebugger.tsx # Text rendering debugger
├── PropertyPanel/    # Node styling and properties
│   └── PropertyPanel.tsx     # Text color, background, font settings
├── Onboarding.tsx    # First-time user guide
├── SyncStatus.tsx    # Cloud sync status indicator
├── AddToButton.tsx   # Quick add node button
└── DraggingTextBubble.tsx # Visual feedback for text drag-to-create

hooks/                # Custom React hooks
└── useTextSelection.ts # Text selection utilities
```

### Design System

The application follows a carefully crafted **Natural Paper Theme** (自然纸感配色方案) defined in `app/globals.css`.

#### Color Palette

**🎨 Core Colors** (defined as CSS custom properties):

| Purpose | CSS Variable | Hex Value | Description |
|---------|-------------|-----------|-------------|
| Main Background | `--color-warm-ivory` | `#F8F4EF` | Warm ivory / light beige |
| Secondary Background | `--color-parchment` | `#EDE4D5` | Parchment paper color |
| Primary Text | `--color-coffee-brown` | `#3D342C` | Deep coffee brown |
| Secondary Text | `--color-taupe-gray` | `#7A6F67` | Taupe gray |
| Accent | `--color-olive-mist` | `#8B8E63` | Olive mist green |
| Secondary Accent | `--color-caramel-clay` | `#B4723C` | Caramel clay |
| Highlight | `--color-sage` | `#C6C8AA` | Sage green |

#### Visual Effects

**Pre-defined CSS Classes** (must be used consistently):

- **`.glass-effect`** - 3D glass edge effect with subtle shadows and highlights
  - Creates elevated appearance with light source from top
  - Used for buttons, toolbars, dropdowns

- **`.paper-texture`** - Paper texture background for main canvas areas
  - SVG noise filter + horizontal/vertical paper grain

- **`.paper-texture-light`** - Lighter paper texture for individual nodes
  - Enhanced noise with subtle horizontal lines

- **`.elastic-transition`** - Smooth elastic easing animation
  - Cubic bezier: `cubic-bezier(0.16, 1, 0.3, 1)`

- **`.dropdown-animate-in`** / **`.dropdown-animate-out`** - Smooth dropdown animations
  - Slide down with scale effect

- **`.bubble-animate-in`** - Chat bubble entrance animation
  - Scale up with slight upward motion

#### Development Rules - Design Consistency

When creating or modifying UI components, **STRICTLY FOLLOW** these rules:

⛔ **DO NOT**:
- Use custom colors not in the palette
- Use arbitrary hex values or RGB colors
- Create custom shadows or borders without using `.glass-effect`
- Use different corner radii (must use `rounded-2xl` for consistency)
- Skip animation classes for interactive elements

✅ **MUST DO**:
- Always use CSS variables from `app/globals.css` for colors
- Apply `.glass-effect` to elevated UI elements (buttons, panels, dropdowns)
- Use `rounded-2xl` for consistent corner rounding
- Apply paper texture classes to appropriate surfaces
- Use predefined animation classes for transitions
- Reference existing components for style patterns

#### Common Style Patterns

**Buttons/Toolbars**:
```tsx
className="glass-effect rounded-2xl"
style={{
  background: '#EDE4D5',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  color: '#3D342C'
}}
```

**Dropdown Menus**:
```tsx
className="glass-effect rounded-2xl dropdown-animate-in"
style={{
  background: '#EDE4D5',
  border: '1px solid rgba(255, 255, 255, 0.3)',
}}
```

**Text Nodes**:
```tsx
className="paper-texture-light rounded-2xl"
style={{
  background: '#F8F4EF',
  border: '1px solid #EDE4D5',
  color: '#3D342C'
}}
```

**Authentication Pages**:
- Must use warm ivory background (`#F8F4EF`)
- Forms should have parchment background (`#EDE4D5`) with `.glass-effect`
- All text should be coffee brown (`#3D342C`)
- Input fields should have paper texture
- Buttons must follow the standard button pattern above

### Layout System

Mind map auto-layout is handled in `lib/mindmap-layout.ts`:

- Calculates positions based on tree structure
- Supports horizontal and vertical layouts
- Handles collapsed node visibility
- Uses configurable spacing constants (HORIZONTAL_SPACING, VERTICAL_SPACING)

**Key Functions**:
- `calculateMindMapLayout()`: Returns Map of node IDs to new positions
- `getAllDescendantIds()`: Gets all children recursively for collapse operations

## TypeScript Configuration

**Path Aliases**: The project uses `@/*` path alias mapped to the root directory:

```typescript
import { db } from '@/lib/db';
import type { CanvasNode } from '@/types';
```

**Compiler Options** (tsconfig.json):
- Target: ES2017
- Strict mode: Enabled
- Module resolution: Bundler (Next.js 15)
- JSX: Preserve (handled by Next.js)

## Application Entry Points

**Main Canvas Application**:
1. `app/layout.tsx` - Root layout with AuthProvider and Toaster
2. `app/page.tsx` - Main canvas page (client component)
3. `components/Canvas/Canvas.tsx` - Core canvas component
4. `lib/store.ts` - Zustand store initialization

**Data Initialization Flow**:
```
User loads page → Layout wraps with AuthProvider
  → page.tsx loads → Canvas component mounts
  → Store initializes → Loads last canvas from IndexedDB
  → Renders nodes from canvas.nodes array
  → If authenticated → Starts sync manager
```

**First-Time User Flow**:
- New users see onboarding component (Onboarding.tsx)
- Empty canvas with default welcome message
- Help button available in top-right corner

## Canvas Interaction Patterns

### Mouse/Trackpad Interactions
- **Pan**: Shift + drag mouse, middle-click drag
- **Zoom**: Ctrl/Cmd + scroll wheel (range: 0.1x - 3x)
- **Move Canvas**: Scroll wheel
- **Select Node**: Click node
- **Deselect All**: Click canvas background
- **Edit Node**: Double-click node
- **Drag Node**: Click and drag (single or multi-select)

### Keyboard Shortcuts
- **Save Edit**: Ctrl/Cmd + Enter
- **Cancel Edit**: Esc
- **Delete Node**: Backspace/Delete (when node selected)
- **Undo**: Ctrl/Cmd + Z
- **Redo**: Ctrl/Cmd + Shift + Z (or Ctrl/Cmd + Y on Windows)
- **Show AI Toolbar**: Tab key (when node selected)
- **Show Properties**: Shift key (when node selected)
- **Add Mind Map Child**: Tab key (when in mind map node edit mode)

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
   - **Endpoint**: `https://lumos.diandian.info/winky/claude/messages` (native Anthropic format)
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

- All IDs use `crypto.randomUUID()` (via `lib/uuid.ts`)
- Timestamps are Unix epoch milliseconds (IndexedDB) or ISO strings (Supabase)
- Canvas updates automatically update `updatedAt` timestamp
- Node deletion cascades to remove from canvas references
- **IndexedDB schema version**: Currently at **version 4** (increment if schema changes)
- When upgrading IndexedDB schema, add a new `this.version(N).stores()` block in `lib/db.ts`
- Supabase uses PostgreSQL with JSONB columns for complex data (position, size, metadata)
- Supabase Row-Level Security (RLS) policies enforce user data isolation

## Utility Libraries

The `lib/` directory contains several specialized utilities:

**AI & Context**:
- **ai.ts**: Client-side API wrappers for AI operations (expand, summarize, chat)
- **context-builder.ts**: Formats canvas state for AI chat context
  - `formatNodesForContext()`: Converts nodes to structured Chinese text
  - `detectNodeChanges()`: Tracks modifications since chat started
  - `buildIncrementalContext()`: Generates change summaries

**Database**:
- **db.ts**: IndexedDB wrapper using Dexie.js (local-first storage)
- **supabase-db.ts**: Supabase database operations (cloud sync)
- **sync-manager.ts**: Bidirectional sync between IndexedDB and Supabase

**State Management**:
- **store.ts**: Zustand store with canvas, node, chat, and sync state

**Authentication**:
- **supabase.ts**: Browser-side Supabase client
- **supabase-server.ts**: Server-side Supabase client for API routes
- **auth-context.tsx**: React context for auth state

**Layout & Positioning**:
- **mindmap-layout.ts**: Auto-layout algorithm for mind maps
  - `calculateMindMapLayout()`: Tree-based position calculation
  - `getAllDescendantIds()`: Recursive child node traversal
- **mindmap-creator.ts**: Batch creation of mind map structures
- **smart-layout.ts**: Intelligent node positioning to avoid overlaps

**Utilities**:
- **text-size-calculator.ts**: DOM-based text measurement for node sizing
- **uuid.ts**: Centralized UUID generation (`crypto.randomUUID()`)
- **types/index.ts**: Core TypeScript interfaces (CanvasNode, Canvas, ChatMessage, etc.)
- **types/database.types.ts**: Supabase-generated database types

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

**Testing Strategy**:
- ⚠️ **No automated tests configured** - No test framework (Jest, Vitest, etc.) is set up
- Manual testing via browser DevTools
- TypeScript strict mode provides compile-time safety

**Development Tools**:
- **Browser DevTools → Application → IndexedDB**: Inspect canvas/nodes/chatSessions tables
- **React DevTools**: Monitor Zustand store state and component re-renders
- **Network Tab**: Debug AI API calls and streaming responses
- **Debug Route**: `/debug` page available for testing (if exists)

**Data Persistence Verification**:
- All node operations should persist immediately to IndexedDB
- Chat history persists per canvas and survives page reloads
- Use browser's Application tab to verify data structure

**Local Development**:
- The app is local-first with no backend dependency beyond AI API calls
- Can develop fully offline after initial `npm install`
- Supabase is optional (only needed for cloud sync testing)

## Common Development Tasks

### Enabling Cloud Sync for Development

To test cloud sync features:

1. Create a Supabase project at https://supabase.com
2. Run the SQL schema from `supabase-schema.sql` in the SQL Editor
3. Get your project URL and anon key from Project Settings > API
4. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```
5. Restart dev server
6. Sign up at `/signup` and log in
7. Canvas changes will now sync to Supabase

**Testing Multi-Device Sync**:
- Open app in two browser windows with same account
- Changes in one window appear in the other after sync interval
- Test offline: disconnect network, make changes, reconnect to see sync

### Adding a New Node Type

1. Define the node type in `types/index.ts` (extend `NodeType` union)
2. Add type-specific metadata interface if needed
3. Create a new component in `components/Nodes/`
4. Update `Canvas.tsx` to render the new node type
5. Add creation button/logic in `CanvasToolbar.tsx`
6. Implement drag, edit, and selection behavior
7. Update database schema if adding new indexed fields

### Adding a New AI Feature

1. Create API route: `app/api/ai/[feature]/route.ts`
   - Use OpenAI-compatible format with proxy endpoint
   - Add proper error handling and validation
2. Create client wrapper in `lib/ai.ts`
3. Add UI controls (typically in `AIToolbar.tsx` or context menu)
4. Tag AI-generated content with `aiMetadata` field
5. Handle loading states in the UI
6. Test error scenarios (network failure, API errors)

### Modifying Database Schema

1. Increment version number in `lib/db.ts` constructor
2. Add new `this.version(N).stores({ ... })` block
3. Define new tables or add indexes to existing tables
4. Test migration by opening app with old data
5. Update TypeScript types in `types/index.ts`
6. Update store actions in `lib/store.ts` if needed

### Debugging Canvas Coordinate Issues

When node positions seem incorrect:
1. Check if screen→canvas conversion is applied during mouse events
2. Verify canvas→screen conversion for rendering
3. Ensure viewport offset and zoom are factored correctly
4. Log both coordinate systems to console for comparison
5. Check that positions are stored in canvas coordinates, not screen

## Troubleshooting

### AI Features Not Working

**Symptom**: Expand/summarize buttons don't work or show errors

**Solutions**:
1. Check `.env.local` has `ANTHROPIC_API_KEY` set
2. Verify API proxy is accessible: `https://lumos.diandian.info/winky/claude`
3. Check browser console for error messages
4. Verify API key is valid (contact administrator)
5. Check network tab for failed API requests

### IndexedDB Data Loss

**Symptom**: Canvas state doesn't persist after reload

**Solutions**:
1. Check browser DevTools → Application → IndexedDB for database presence
2. Verify IndexedDB is not disabled (private/incognito mode may block it)
3. Check console for Dexie initialization errors
4. Ensure sufficient storage quota available
5. Try clearing browser cache and reloading (last resort)

### Performance Issues with Large Canvases

**Symptom**: Canvas becomes laggy with many nodes

**Solutions**:
1. Check node count (>1000 nodes may cause performance issues)
2. Consider implementing viewport culling (only render visible nodes)
3. Profile with React DevTools to identify unnecessary re-renders
4. Verify React.memo is applied to node components
5. Check for memory leaks in event handlers or store subscriptions

### Mind Map Layout Issues

**Symptom**: Mind map nodes overlap or have incorrect positions

**Solutions**:
1. Verify parent-child relationships in `mindMapMetadata`
2. Check that `calculateMindMapLayout()` is called after structure changes
3. Ensure collapsed state propagates to all descendants
4. Review spacing constants in `lib/mindmap-layout.ts`
5. Check that layout updates trigger store updates properly

### Chat Context Not Working

**Symptom**: AI chat doesn't know about canvas content

**Solutions**:
1. Verify `initialNodes` snapshot is captured when chat opens
2. Check that `detectNodeChanges()` is detecting modifications
3. Review context-builder output in console logs
4. Ensure chat references are properly attached
5. Verify node content is being serialized correctly

### Tool Call Confirmation State Lost After Reload

**Symptom**: Tool call confirmation status resets to 'pending' after page refresh

**Solutions**:
1. ✅ Fixed: `confirmToolCall()` and `rejectToolCall()` now persist to IndexedDB
2. Verify `db.updateChatSession()` is being called after confirmation
3. Check browser console for database update errors
4. Ensure chat session messages are properly loaded from database on page load
5. Inspect IndexedDB (Application tab) to verify `chatSessions` table has updated messages

### Cloud Sync Not Working

**Symptom**: Changes don't sync between devices or to cloud

**Solutions**:
1. Verify Supabase environment variables are set in `.env.local`
2. Check that user is authenticated (login icon in top-right)
3. Inspect SyncStatus indicator for error state
4. Open browser console and look for sync-related errors
5. Verify Supabase RLS policies are correctly configured
6. Check Network tab for failed API requests to Supabase
7. Ensure Supabase project is not paused (free tier auto-pauses after inactivity)
8. Test database connection: run `supabaseDB.getAllCanvases(userId)` in console

**Symptom**: "Full sync failed" error on login

**Solutions**:
1. App will continue working with local data (degraded but functional)
2. Check Supabase project status and quota limits
3. Verify database schema matches `supabase-schema.sql`
4. Check browser console for detailed error message
5. Try logging out and back in to retry sync
