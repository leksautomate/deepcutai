# Faceless Video Generation Pipeline

## Overview

This is an AI-powered faceless video generation tool that automates the creation of YouTube-style videos. Users provide a topic, and the system generates scripts using Google Gemini, creates voiceovers with multi-provider TTS (Speechify or Inworld), generates images via multi-provider AI (WaveSpeed, RunPod, or Seedream/Freepik), and assembles everything into a final video. The application follows a multi-step wizard workflow: Script → Assets → Preview → Render.

## Multi-Provider TTS (Text-to-Speech)

The system supports **two TTS providers** that can be selected in the Asset Configuration step:

### Supported TTS Providers
1. **Speechify** - Default provider with multiple voices (George, Maisie, Henry, Carly, Oliver, Simone)
2. **Inworld TTS** - Alternative provider with 12 voices:
   - Male: Dennis, Alex, Craig, Mark, Shaun, Timothy
   - Female: Ashley, Deborah, Elizabeth, Julia, Olivia, Sarah

### Custom Voices
Users can add custom voices for either provider:
1. Navigate to Settings > Voices tab
2. Select the TTS provider (Speechify or Inworld)
3. Enter a custom voice name and voice ID
4. Custom voices appear in the asset configuration dropdown

### Inworld Voice ID Format
Custom Inworld voices use the format: `default-<character-id>__<voice-name>`
Example: `default-xtytd8coit3byx-lffsuog__jordan`

## Authentication

The application uses **single-user mode** with username/password authentication via Passport.js Local Strategy:
- **Single admin account**: Only one admin user can access the app (no public registration)
- **Session-based auth**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **Password hashing**: Scrypt with random salt for secure password storage
- **Protected routes**: All main application routes require authentication
- **Auth endpoints**: `/api/login`, `/api/logout`, `/api/user`
- **Auth page**: Login form with hero branding section

### Required Environment Variables (Secrets)
| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | Secret key for session encryption |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |

The admin user is automatically created on first startup when credentials are provided.

## Multi-Provider Image Generation

The system now supports **three image generation providers** that can be selected per video project:

### Supported Providers
1. **Seedream (Freepik AI)** - Default provider, uses Freepik API
2. **WaveSpeed** - Fast, high-quality image generation (supports up to 1536x1536)
3. **RunPod** - Flexible image generation with endpoint-based API

### Image Generation Configuration
- **Aspect Ratio**: All images are generated in 16:9 format (default: 1024x576)
- **Resolution Options**: Width and height configurable from 256px to 1536px (maintains 16:9)
- **Prompt Language**: Supports both English and Chinese prompts
- **Seed Control**: Random (-1) or fixed integer for reproducible results
- **Provider Selection**: Can be changed per project in the "Asset Configure" tab during video creation

### API Key Management
Users can configure API keys from the Settings page:
1. Navigate to Settings (gear icon)
2. Click "Configure Keys"
3. Enter API keys for:
   - Gemini AI (script generation)
   - Groq AI (image prompt generation)
   - Speechify (text-to-speech)
   - Inworld TTS (text-to-speech)
   - Freepik (Seedream image generation)
   - WaveSpeed (image generation)
   - RunPod (image generation)
4. Save - keys are stored in the PostgreSQL database and persist across restarts

## Deployment

### Step 1: Configure Required Environment Variables
Before publishing, you MUST set these environment variables/secrets:

**Required for Login (MUST SET BEFORE FIRST USE):**
| Variable | Description | Example |
|----------|-------------|---------|
| `SESSION_SECRET` | Random string for session encryption | `your-random-secret-key-here` |
| `ADMIN_USERNAME` | Your admin login username | `admin` |
| `ADMIN_PASSWORD` | Your admin login password | `your-secure-password` |
| `DATABASE_URL` | PostgreSQL connection string | Auto-configured by Replit |

### Step 2: First Login After Deployment
1. Open your deployed app URL
2. You'll see the login page
3. Enter your `ADMIN_USERNAME` and `ADMIN_PASSWORD` (from Step 1)
4. The admin account is auto-created on first startup

### Step 3: Configure API Keys (After Logging In)
**IMPORTANT: You must be logged in to save API keys. If you get a 401 Unauthorized error, it means you're not logged in.**

1. Click the Settings icon (gear) in the sidebar
2. Go to "API Keys" tab
3. Enter your API keys:
   - **Gemini AI** - For script generation (required)
   - **Speechify** - For TTS (optional, if using Speechify)
   - **Inworld TTS** - For TTS (optional, if using Inworld)
   - **Freepik/Seedream** - For image generation (optional)
   - **WaveSpeed** - For image generation (optional)
   - **RunPod** - For image generation (optional)
4. Click "Save" - keys are stored in the database

### Alternative: Set API Keys via Environment Variables
You can also set API keys as environment variables (useful for VPS/server deployments):
| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `SPEECHIFY_API_KEY` | Speechify API key |
| `INWORLD_API_KEY` | Inworld TTS API key |
| `FREEPIK_API_KEY` | Freepik/Seedream API key |
| `WAVESPEED_API_KEY` | WaveSpeed API key |
| `RUNPOD_API_KEY` | RunPod API key |

The app checks both database-stored keys AND environment variables. Database keys take priority.

### Troubleshooting Deployment Issues

**401 Unauthorized when saving API keys:**
- You are not logged in. Go to the login page and enter your admin credentials first.
- Make sure `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables are set correctly.

**Can't log in:**
- Verify `SESSION_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` are set in your environment.
- Check that the database is connected (`DATABASE_URL` is set).
- Try restarting the server after setting environment variables.

**API keys not working:**
- Make sure you're using the correct API key format for each provider.
- WaveSpeed keys start with `wsk_...`
- Inworld keys require the full API key from your Inworld account.

### Publishing on Replit
Use Replit's built-in deployment to publish the app. The platform handles:
- Building the application
- SSL/TLS certificates
- Health checks
- Custom domain support (optional)

### Self-Hosting on VPS
1. Clone the repository
2. Set all required environment variables (see Step 1 and Alternative section)
3. Run `npm install`
4. Run `npm run db:push` to set up the database
5. Run `npm run build` then `npm start` for production

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Build Tool**: Vite with HMR support
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Style**: RESTful JSON endpoints under `/api/`
- **Build**: esbuild for production bundling with selective dependency bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Validation**: Zod schemas with drizzle-zod integration
- **Storage**: PostgreSQL database via `DatabaseStorage` class in `server/storage.ts`
- **Database Connection**: `server/db.ts` - Drizzle connection pool using `DATABASE_URL`

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` directory are imported by both frontend and backend
- **Multi-Step Wizard**: Pipeline implemented as a 4-step process with step validation
- **API Request Helper**: Centralized `apiRequest` function handles all HTTP calls with error handling
- **Theme System**: CSS variables with light/dark mode toggle, stored in localStorage
- **Multi-Provider Pattern**: Image generation abstracted to support multiple providers (Seedream, WaveSpeed, RunPod)

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # UI components (wizard steps, previews, asset config)
│   ├── components/ui/   # shadcn/ui primitives
│   ├── pages/           # Route pages (image-generator, settings, etc.)
│   ├── lib/             # Utilities (queryClient, theme)
│   └── hooks/           # Custom React hooks
├── server/              # Express backend
│   ├── services/        # External API integrations
│   │   ├── gemini.ts    # Gemini script generation
│   │   ├── groq.ts      # Groq image prompts
│   │   ├── speechify.ts # Text-to-speech
│   │   ├── freepik.ts   # Seedream image generation
│   │   └── image-generators.ts # WaveSpeed & RunPod
│   ├── routes.ts        # API endpoint definitions
│   ├── storage.ts       # Data persistence layer
│   └── auth.ts          # Authentication middleware
├── shared/              # Shared types and schemas
└── migrations/          # Drizzle database migrations
```

### Video Encoding Settings
- **CRF**: 18 (high quality)
- **Preset**: medium
- **Profile**: high, level 4.2
- **Audio**: AAC at 256kbps
- **Transitions**: Configurable in Settings (fade, dissolve, wipe-left, wipe-right, wipe-up, wipe-down)
- **Image Format**: 16:9 aspect ratio, 1024x576 default

## External Dependencies

### AI Services
- **Google Gemini** (`@google/genai`): Script generation - requires `GEMINI_API_KEY`
- **Groq AI**: Image prompt generation - requires `GROQ_API_KEY`
- **Speechify TTS**: Text-to-speech audio generation - requires `SPEECHIFY_API_KEY`
- **Freepik AI** (Seedream): Image generation via `/api/generate-image` endpoint - requires `FREEPIK_API_KEY`
- **WaveSpeed**: Alternative image generation provider - requires `WAVESPEED_API_KEY`
- **RunPod**: Alternative image generation provider - requires `RUNPOD_API_KEY`

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migration and schema push tool

### UI Component Library
- **shadcn/ui**: Radix UI primitives with Tailwind styling
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel component
- **Recharts**: Charting library (available but not currently used)

### Key Runtime Dependencies
- **Express**: HTTP server framework
- **TanStack Query**: Async state management
- **Wouter**: Client routing
- **Zod**: Runtime validation
- **date-fns**: Date utilities
- **node-fetch**: HTTP client for API calls

## Recent Changes (Dec 25, 2025)

### Critical Bug Fixes
- **Fixed database schema**: Pushed missing `image_generator` column that was causing 500 errors on /api/projects endpoint
- **Fixed audio generation**: Replaced deprecated `response.buffer()` with `response.arrayBuffer()` and `Buffer.from()` in Speechify TTS service
- **Fixed Scene Duration Settings**: Created shared settings service (`server/services/settings.ts`) so both routes.ts and queue.ts use the same app settings. Scene duration settings (targetWords, maxWords) from the Settings page are now properly applied during video generation
- **Centralized settings management**: Removed hardcoded values from queue.ts - now uses `getAppSettings()` for sceneSettings, imageStyleSettings, and transitionSettings
- **Fixed Vertical (9:16) Aspect Ratio**: Images now correctly generate with proper 9:16 dimensions when "Vertical" resolution is selected. The fix calculates imageWidth and imageHeight based on aspect ratio (portrait: height=1024, landscape: width=1024)
- **Fixed API Key Persistence**: API keys are now saved to the PostgreSQL database (persistent) instead of `.env.local` file (which doesn't persist on Replit). Created centralized `getResolvedApiKey()` helper in `server/services/api-keys.ts` that checks database with provider aliases (e.g., "seedream" or "freepik") then falls back to environment variables. Works even without logged-in user for env-only configurations
- **Fixed Queue Multi-Provider Support**: Queue.ts now supports WaveSpeed and RunPod image generators with proper aspect ratio calculations and uses the centralized API key resolver

### Settings Architecture
The app now has a centralized settings service at `server/services/settings.ts` that:
- Exports `getAppSettings()` to get current settings
- Exports `updateAppSettings()` to modify settings
- Exports `splitScriptIntoScenes()` that uses the current scene settings
- Both routes.ts and queue.ts import from this service to ensure consistent behavior

## Previous Changes (Dec 23, 2025)

### Multi-Provider Image Generation System
- **Added image generator selection** in Asset Configure tab during video creation
- **Integrated WaveSpeed** image generation service with async polling
- **Integrated RunPod** image generation service with async polling
- **Fixed 16:9 aspect ratio** enforcement (1024x576px) across all providers
- **Updated database schema** to track selected image generator per project
- **Added API key management** for WaveSpeed and RunPod in Settings page
- **Enhanced backend routes** to route image generation to selected provider
- **Fixed Speechify audio** handling for both JSON and binary response formats
- **Added API key validation** for all three image generation providers

