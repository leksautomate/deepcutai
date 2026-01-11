# Faceless Video Generation Pipeline

## Overview

This project is an AI-powered tool designed to automate the creation of YouTube-style faceless videos. Users input a topic, and the system orchestrates the generation of scripts via Google Gemini, voiceovers using multi-provider Text-to-Speech (TTS) services, images from various AI providers, and finally assembles these components into a complete video. The application guides users through a multi-step wizard: Script, Assets, Preview, and Render, streamlining the video production workflow. The business vision is to provide an efficient and accessible platform for content creators, reducing the complexity and time involved in video production, thereby tapping into the growing demand for automated content creation tools.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18 and TypeScript, utilizing Wouter for routing and TanStack React Query for server state management. Styling is handled by Tailwind CSS with components from shadcn/ui (New York style), and Vite is used for fast development with HMR. The application features a multi-step wizard workflow (Script, Assets, Preview, Render) and supports a theme system with light/dark mode.

### Technical Implementations
The backend is a Node.js Express application written in TypeScript (ESM modules), providing RESTful JSON endpoints. It uses esbuild for production bundling. Data persistence is managed with Drizzle ORM for PostgreSQL, with schema definitions shared between frontend and backend via the `shared/` directory. Zod schemas are used for validation. Authentication is single-user mode via Passport.js Local Strategy with session-based authentication and secure password hashing (Scrypt).

### Feature Specifications
- **Multi-Provider Script Generation**: Supports Gemini AI and Groq AI for script writing, with automatic fallback if the primary provider fails. Configurable in Settings.
- **Multi-Provider TTS**: Supports Speechify and Inworld, with options for custom voices.
- **Multi-Provider Image Generation**: Integrates Seedream (Freepik AI), WaveSpeed, and RunPod, allowing per-project provider selection and configurable resolutions (16:9 aspect ratio).
- **API Key Management**: Centralized system for storing and managing API keys for various services, configurable via the Settings page or environment variables.
- **Video Encoding**: Uses CRF 18, medium preset, high profile (level 4.2), AAC audio, and configurable transitions.

### Audio-Video Synchronization (Critical)
- **Audio duration = Image display time**: Each scene's image displays for exactly as long as its audio narration lasts.
- **No audio cutoff**: The system uses ffprobe to detect the exact audio duration, then adds a 0.1s buffer to ensure complete playback.
- **No overlapping**: Each segment's text/voiceover completes fully before the next scene begins.
- **Implementation**: `server/services/ffmpeg.ts` - `getAudioDuration()` function probes audio files, `createSceneVideo()` uses audio duration as the video duration.

### System Design Choices
- **Shared Types**: Drizzle schema definitions and other types are shared between client and server for consistency.
- **Multi-Provider Pattern**: Abstracted interfaces allow for easy integration of multiple TTS and image generation providers.
- **Centralized Settings**: A dedicated service manages application settings, ensuring consistent behavior across different modules.
- **Deployment**: Designed for deployment on platforms like Replit, with explicit instructions for environment variable configuration and API key management. The application automatically creates an admin account on first startup if credentials are provided.

## External Dependencies

### AI Services
- **Google Gemini**: For script generation.
- **Groq AI**: For image prompt generation.
- **Speechify TTS**: For text-to-speech audio generation.
- **Inworld TTS**: For alternative text-to-speech audio generation.
- **Freepik AI (Seedream)**: For image generation.
- **WaveSpeed**: For alternative image generation.
- **RunPod**: For alternative image generation.

### Database
- **PostgreSQL**: Primary database for data storage.
- **Drizzle Kit**: Used for database migrations and schema management.

### UI Component Library
- **shadcn/ui**: Component library based on Radix UI and Tailwind CSS.
- **Lucide React**: Icon library.
- **Embla Carousel**: Carousel component.

### Key Runtime Dependencies
- **Express**: Web application framework for Node.js.
- **TanStack Query**: For asynchronous state management in the frontend.
- **Wouter**: Lightweight client-side router.
- **Zod**: For runtime schema validation.
- **date-fns**: For date manipulation.
- **node-fetch**: For making HTTP requests.