# DeepCut AI - Architecture Documentation

## System Overview

DeepCut AI is a faceless video generation platform that automates the creation of YouTube-style videos through AI-powered script generation, text-to-speech, image generation, and video assembly.

## Architecture Diagram

```mermaid
graph TB
    subgraph Client["Frontend (React)"]
        UI[React UI Components]
        State[TanStack Query State]
        Router[Wouter Router]
    end

    subgraph Server["Backend (Express)"]
        API[Express API Routes]
        Controllers[Controllers Layer]
        Services[Services Layer]
        Queue[Job Queue System]
    end

    subgraph Database["Data Layer"]
        PG[(PostgreSQL)]
        DrizzleORM[Drizzle ORM]
    end

    subgraph External["External Services"]
        Gemini[Google Gemini API]
        TTS[TTS Providers]
        ImageGen[Image Generation APIs]
    end

    subgraph Processing["Video Processing"]
        FFmpeg[FFmpeg Engine]
        Assets[Asset Storage]
    end

    UI --> API
    API --> Controllers
    Controllers --> Services
    Services --> Queue
    Services --> DrizzleORM
    DrizzleORM --> PG
    Services --> Gemini
    Services --> TTS
    Services --> ImageGen
    Queue --> FFmpeg
    FFmpeg --> Assets
```

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React Router alternative)
- **State Management**: TanStack Query (React Query v5)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: TailwindCSS with custom design tokens
- **Build Tool**: Vite
- **Fonts**: Space Grotesk (display), Inter (body), JetBrains Mono (code)

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js with TypeScript
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL 16
- **Authentication**: Passport.js with local strategy
- **Session**: express-session with PostgreSQL store
- **Validation**: Zod schemas
- **Security**: Helmet (CSP, security headers)

### AI Services
- **Script Generation**: Google Gemini Pro / Groq (fallback)
- **Text-to-Speech**: 
  - Speechify API
  - Inworld TTS
  - Custom providers
- **Image Generation**:
  - Freepik AI
  - WaveSpeed AI
  - RunPod
  - Pollinations.ai
  - Seedream

### Video Processing
- **Engine**: FFmpeg
- **Features**:
  - Scene transitions
  - Audio mixing
  - Image animation (Ken Burns effect)
  - Text overlays
  - Multiple aspect ratios (16:9, 9:16, 1:1)

### Deployment
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose
- **Process Manager**: PM2 (production)
- **Reverse Proxy**: Nginx (optional)
- **OS**: Ubuntu/Debian (recommended)

---

## Directory Structure

```
deepcutai/
├── client/                    # Frontend application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── ui/           # shadcn/ui components
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── ...
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities
│   │   ├── styles/           # Global styles & design tokens
│   │   │   └── design-tokens.ts
│   │   ├── App.tsx           # Root component
│   │   └── main.tsx          # Entry point
│   ├── index.html
│   └── vite.config.ts
│
├── server/                    # Backend application
│   ├── controllers/          # API controllers (NEW)
│   │   └── BaseController.ts
│   ├── services/             # Business logic
│   │   ├── logger.ts        # Structured logging
│   │   ├── gemini.ts        # AI script generation
│   │   ├── tts-providers.ts # Text-to-speech
│   │   ├── image-generators.ts
│   │   └── queue.ts         # Job queue
│   ├── db/                   # Database
│   │   ├── schema.ts        # Drizzle schema
│   │   └── index.ts         # DB connection
│   ├── storage/              # Data access layer
│   │   └── index.ts
│   ├── routes.ts             # API routes (to be refactored)
│   └── index.ts              # Server entry point
│
├── shared/                    # Shared types/utilities
│   └── types.ts
│
├── public/                    # Static assets
│   ├── assets/               # Generated assets
│   └── tts-output/          # TTS audio files
│
├── logs/                      # Application logs
├── data/                      # User data
│
├── Dockerfile                 # Production container
├── docker-compose.yml         # Production orchestration
├── docker-compose.dev.yml     # Development override
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

---

## Data Flow

### Video Creation Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Gemini
    participant TTS
    participant ImageGen
    participant Queue
    participant FFmpeg
    participant Storage

    User->>Frontend: Enter topic & settings
    Frontend->>API: POST /api/generate/project
    API->>Gemini: Generate script
    Gemini-->>API: Return scenes
    API->>Storage: Save project
    API-->>Frontend: Return project ID

    Frontend->>API: POST /api/generate/assets
    API->>Queue: Add to job queue
    
    Queue->>TTS: Generate voiceovers
    TTS-->>Queue: Audio files
    Queue->>ImageGen: Generate images
    ImageGen-->>Queue: Images
    
    Queue->>FFmpeg: Assemble video
    FFmpeg->>Storage: Save video file
    FFmpeg-->>Queue: Complete
    
    Queue-->>API: Job finished
    API-->>Frontend: Video ready
    Frontend-->>User: Show download link
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant AuthMiddleware
    participant Database

    User->>Frontend: Login credentials
    Frontend->>API: POST /api/auth/login
    API->>AuthMiddleware: Validate
    AuthMiddleware->>Database: Check credentials
    Database-->>AuthMiddleware: User data
    AuthMiddleware->>API: Create session
    API-->>Frontend: Set session cookie
    Frontend-->>User: Redirect to dashboard
```

---

## API Architecture

### Layered Architecture (Target State)

Following **backend-dev-guidelines** skill:

```
Routes → Controllers → Services → Repositories → Database
```

#### Current State
```typescript
// All in routes.ts (1966 lines)
router.post('/api/projects', async (req, res) => {
  // Validation, business logic, DB access all mixed
});
```

#### Target State
```typescript
// routes/projects.ts
router.post('/api/projects', ProjectController.create);

// controllers/ProjectController.ts
export class ProjectController extends BaseController {
  async create(req: Request, res: Response) {
    try {
      const data = this.validateBody(createProjectSchema, req.body);
      const userId = this.getUserId(req);
      
      const project = await ProjectService.create(userId, data);
      
      this.handleSuccess(res, project, 201);
    } catch (error) {
      this.handleError(error, res, 'ProjectController.create');
    }
  }
}

// services/ProjectService.ts
export class ProjectService {
  static async create(userId: number, data: ProjectInput) {
    // Business logic
    return ProjectRepository.create(userId, data);
  }
}

// repositories/ProjectRepository.ts
export class ProjectRepository {
  static async create(userId: number, data: ProjectInput) {
    return db.insert(projects).values({ ...data, userId });
  }
}
```

---

## Security

### Authentication
- **Strategy**: Passport.js local strategy
- **Session Storage**: PostgreSQL (persistent across restarts)
- **Cookie Settings**: 
  - httpOnly: true
  - secure: true (HTTPS only in production)
  - sameSite: 'lax'
  - maxAge: 30 days

### API Security
- **Rate Limiting**: 
  - Authentication endpoints: 5 req/15min
  - General API: 100 req/15min
- **CORS**: Same-origin only
- **CSP**: Strict content security policy
- **Helmet**: Security headers enabled

### Docker Security
- **Non-root user**: Runs as `deepcut:nodejs` (UID 1001)
- **Read-only layers**: Production layers immutable
- **Network isolation**: Database on internal network
- **Resource limits**: CPU/memory constraints configured

---

## Database Schema

### Core Tables

#### users
- `id` (primary key)
- `username` (unique)
- `password` (hashed with bcrypt)
- `createdAt`, `updatedAt`

#### video_projects
- `id` (primary key)
- `userId` (foreign key → users)
- `title`
- `description`
- `manifest` (JSON - scene data)
- `style` (video style preset)
- `duration` (target duration)
- `status` (draft, generating, complete, failed)
- `outputPath` (final video file)
- `createdAt`, `updatedAt`

#### app_settings
- `key` (primary key)
- `value` (JSON)
- `updatedAt`

### API Keys Storage
- Encrypted in database
- Also set in `process.env` at runtime for service access
- Configurable via Settings UI

---

## Configuration

### Environment Variables

```bash
# Server
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/deepcut

# Authentication
SESSION_SECRET=<secure-random-string>
COOKIE_SECURE=true  # Set to false for HTTP development

# AI Services (optional - can configure via UI)
GEMINI_API_KEY=
GROQ_API_KEY=
SPEECHIFY_API_KEY=
INWORLD_API_KEY=
FREEPIK_API_KEY=
WAVESPEED_API_KEY=
RUNPOD_API_KEY=
POLLINATIONS_API_KEY=
```

---

## Monitoring & Logging

### Logging System
- **Service**: Custom structured logger ([server/services/logger.ts](file:///C:/Users/leksi/Desktop/Project/deepcutai/deepcutai/server/services/logger.ts))
- **Levels**: ERROR, WARN, INFO, DEBUG
- **Output**: 
  - Console (captured by PM2)
  - File (`logs/error.log`, `logs/info.log`)
  - In-memory (last 500 entries for dashboard)
- **Format**: JSON for parsing, human-readable for console

### Health Checks
- **Endpoint**: `GET /api/setup/status`
- **Docker**: Health check every 30s
- **Checks**:
  - Database connectivity
  - File system access
  - Memory usage

### Metrics (Future)
- Request latency
- Video generation success rate
- API error rates
- Resource utilization

---

## Deployment Architectures

### Development (docker-compose.dev.yml)
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│  App (5000) │────▶│ PostgreSQL   │
│  + Vite Dev │     │   (exposed)  │
│  Hot Reload │     └──────────────┘
└─────────────┘
```

### Production (VPS with Nginx)
```
┌─────────┐
│ Internet│
└────┬────┘
     │
     ▼
┌──────────┐
│  Nginx   │ (Port 80/443)
│   SSL    │
└────┬─────┘
     │
     ▼
┌──────────┐     ┌──────────────┐
│   PM2    │────▶│  PostgreSQL  │
│DeepCut AI│     │  (internal)  │
│ (5000)   │     └──────────────┘
└──────────┘
```

### Production (Docker Compose)
```
┌─────────┐
│ Internet│
└────┬────┘
     │
     ▼
┌─────────────┐
│   Nginx     │ (Optional)
│  Container  │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│     App     │────▶│  PostgreSQL  │
│  Container  │     │   Container  │
│  (non-root) │     │  (internal)  │
└─────────────┘     └──────────────┘
  │
  ▼
┌──────────────┐
│   Volumes    │
│ assets/data/ │
│    logs/     │
└──────────────┘
```

---

## Performance Considerations

### Frontend
- **Code Splitting**: All pages lazy-loaded
- **Query Caching**: TanStack Query caches API responses
- **Image Optimization**: Progressive loading
- **Bundle Size**: < 500KB initial load

### Backend
- **Job Queue**: Async video generation doesn't block API
- **Database Pooling**: Connection pool for efficiency
- **Static Assets**: Served with efficient headers
- **Streaming**: Large files streamed, not loaded into memory

### Video Generation
- **FFmpeg Optimization**: Hardware acceleration where available
- **Parallel Processing**: Multiple scenes rendered concurrently
- **Asset Caching**: Generated images/audio reused when possible

---

## Future Enhancements

### High Priority
1. **Sentry Integration**: Error tracking in production
2. **TypeScript Strict Mode**: Fix all `any` types
3. **Controller Migration**: Complete routes.ts refactoring
4. **API Documentation**: OpenAPI/Swagger spec

### Medium Priority
5. **WebSocket Support**: Real-time progress updates
6. **Redis Queue**: Replace in-memory queue with Redis
7. **S3 Storage**: Cloud storage for generated assets
8. **Multi-tenant**: Support multiple organizations

### Low Priority
9. **Analytics Dashboard**: Usage metrics and insights
10. **A/B Testing**: Test different AI providers
11. **Mobile App**: React Native companion app
12. **Plugin System**: User-extensible features

---

## Contributing

### Development Setup
```bash
# Install dependencies
npm install

# Setup database
npm run db:push

# Start development server
npm run dev
```

### Code Standards
- Follow **clean-code** principles
- Use **backend-dev-guidelines** for server code
- Apply **frontend-dev-guidelines** for React components
- Maintain **frontend-design** aesthetic standards

### Git Workflow
1. Create feature branch from `main`
2. Make changes with clear commit messages
3. Ensure `npm run check` passes
4. Submit pull request for review

---

## Support & Resources

- **GitHub**: [leksautomate/deepcutai](https://github.com/leksautomate/deepcutai)
- **Documentation**: [README.md](../README.md)
- **API Docs**: [docs/api.md](api.md)
- **Issues**: GitHub Issues

---

*Last Updated*: 2026-01-27  
*Version*: 1.0.0  
*Architecture*: Monolithic with microservice transition planned
