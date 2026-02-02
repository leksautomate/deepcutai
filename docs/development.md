# Development Guide

This guide covers how to set up the DeepCut AI development environment, the project structure, and coding standards.

## Prerequisites

- **Node.js**: v20 or higher
- **Docker**: For running the PostgreSQL database (optional but recommended)
- **VS Code**: Recommended editor (settings included)

## Getting Started

We provide a helper script to bootstrap your local environment.

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/leksautomate/deepcutai.git
    cd deepcutai
    ```

2.  **Run the setup script**:
    ```bash
    bash scripts/setup-dev.sh
    ```
    This script will:
    - Check for Node.js and Docker
    - Create `.env` from the template
    - Install dependencies (`npm install`)
    - Start a local PostgreSQL container (`deepcut-db-dev`)
    - Push the database schema (`npm run db:push`)

3.  **Start the development server**:
    ```bash
    npm run dev
    ```
    The app will be available at [http://localhost:5000](http://localhost:5000).

## Project Structure

```
deepcutai/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── styles/         # Design tokens & CSS
│   │   └── hooks/          # Custom React hooks
│
├── server/                 # Express Backend
│   ├── controllers/        # Request handlers (Business logic)
│   ├── services/           # External integrations (Gemini, RunPod, etc.)
│   ├── utils/              # Shared utilities (Retry, Secrets)
│   ├── db.ts               # Drizzle ORM setup
│   └── routes.ts           # Route definitions
│
├── shared/                 # Code shared between Frontend & Backend
│   └── schema.ts           # Drizzle schema & Zod types
│
├── scripts/                # Dev & Ops scripts
│   ├── setup-dev.sh        # Local setup
│   └── health-check.sh     # System diagnostics
│
├── docs/                   # Documentation
└── install.sh              # Production installation script
```

## Database Management

We use **Drizzle ORM** with PostgreSQL.

- **Schema Definition**: `shared/schema.ts`
- **Push Changes**: `npm run db:push` (Syncs schema with DB)
- **Studio**: `npm run db:studio` (Opens web UI to view/edit data)

## Coding Standards

### Controller Pattern
All business logic should reside in Controllers, extending `BaseController`.

```typescript
// server/controllers/MyController.ts
import { BaseController } from './BaseController';

export class MyController extends BaseController {
    async myHandler(req: Request, res: Response) {
        try {
            const data = await myService.doSomething();
            this.handleSuccess(res, data);
        } catch (error) {
            this.handleError(error, res, 'MyController.myHandler');
        }
    }
}
```

### Type Safety
- **Avoid `any`**: Use proper interfaces.
- **Zod Schemas**: Define validation schemas in `shared/schema.ts`.
- **JSON Types**: Use `.$type<MyInterface>()` for JSONB columns in Drizzle.

### Git Workflow
1.  Create a feature branch.
2.  Make changes.
3.  Run checks: `npm run check` (TypeScript), `npm test` (if available).
4.  Commit and push.
