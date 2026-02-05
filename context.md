# DeepCut AI - Django Version Context Document

## Project Overview

DeepCut AI is an AI-powered video generation platform that automates the entire video creation process. Users can generate scripts, voiceovers, and images that are automatically assembled into professional videos with captions, transitions, and effects.

---

## Core Features

### 1. AI Script Generation
- Generate video scripts from topic prompts using Google Gemini or Groq AI
- Script styles: educational, entertaining, documentary, storytelling
- Duration options: 30 seconds, 1 minute, 2 minutes, 10 minutes
- Scene-based script structure with configurable word counts

### 2. Text-to-Speech (TTS)
- **Speechify TTS**: Premium voices (George, Maisie, Henry, Carly, Oliver, Simone)
- **Inworld TTS**: Free alternative with multiple voices (Dennis, Alex, Craig, Mark, Shaun, Timothy, Ashley, Deborah, Elizabeth, Julia, Olivia, Sarah)
- Custom voice support
- Long-form TTS for extended narrations
- Background TTS generation with job tracking

### 3. AI Image Generation
- Multiple image generators:
  - **Seedream**: Default generator
  - **Wavespeed**: Alternative AI model
  - **RunPod**: Custom deployment support
  - **Pollinations**: Free tier with multiple models (flux, zimage, turbo, gptimage, kontext, seedream, nanobanana)
- Image styles: Cinematic, Anime, Realistic, Illustration, Abstract, 3D Pixar, Custom
- Custom style presets saved per user

### 4. Video Rendering
- FFmpeg-based video rendering pipeline
- Ken Burns motion effects: zoom-in, zoom-out, pan-left, pan-right, pan-up, pan-down
- Scene transitions: fade, dissolve, wipe-left, wipe-right, wipe-up, wipe-down
- Resolution options: 4K, 1080p, 720p, 480p, Vertical (9:16), Square (1:1)
- Background rendering with progress tracking

### 5. Caption System
- 8 caption style presets: Classic White, Bold Yellow, Minimal, Netflix Style, Karaoke Pop, Documentary, TikTok Viral, Boxed
- 7 position options: Bottom Center/Left/Right, Top Center/Left/Right, Center
- Word-limited captions (max 8 words per caption)
- ASS subtitle format burned into video

### 6. Post-Processing
- Thumbnail generation from video timestamp
- AI-powered thumbnail generation
- Video concatenation (merge multiple videos)
- Chapter markers support

---

## Database Schema

### Tables

#### 1. users
```python
class User(models.Model):
    id = models.CharField(primary_key=True, max_length=36)  # UUID
    username = models.CharField(unique=True, max_length=255)
    email = models.EmailField(null=True, blank=True)
    password = models.CharField(max_length=255)  # Hashed password
    is_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
```

#### 2. video_projects
```python
class VideoProject(models.Model):
    id = models.CharField(primary_key=True, max_length=36)  # UUID
    title = models.TextField()
    script = models.TextField()
    status = models.CharField(max_length=20, default='draft')  # draft, generating, ready, error
    voice_id = models.CharField(max_length=100, null=True)
    image_style = models.CharField(max_length=100, null=True)
    custom_style_text = models.TextField(null=True)
    image_generator = models.CharField(max_length=50, default='seedream')
    manifest = models.JSONField(null=True)  # VideoManifest JSON
    output_path = models.TextField(null=True)
    thumbnail_path = models.TextField(null=True)
    chapters = models.JSONField(null=True)  # Chapter[] JSON
    progress = models.IntegerField(default=0)
    progress_message = models.TextField(null=True)
    error_message = models.TextField(null=True)
    total_duration = models.FloatField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### 3. api_keys
```python
class ApiKey(models.Model):
    id = models.CharField(primary_key=True, max_length=36)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    provider = models.CharField(max_length=50)  # gemini, groq, speechify, freepik, wavespeed, runpod, pollinations
    api_key = models.TextField()  # Encrypted
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### 4. usage_analytics
```python
class UsageAnalytics(models.Model):
    id = models.CharField(primary_key=True, max_length=36)
    date = models.CharField(max_length=10)  # YYYY-MM-DD
    videos_created = models.IntegerField(default=0)
    videos_rendered = models.IntegerField(default=0)
    scripts_generated = models.IntegerField(default=0)
    images_generated = models.IntegerField(default=0)
    audio_generated = models.IntegerField(default=0)
    total_duration_seconds = models.FloatField(default=0)
```

#### 5. system_logs
```python
class SystemLog(models.Model):
    id = models.CharField(primary_key=True, max_length=36)
    level = models.CharField(max_length=10, default='info')  # info, warn, error, debug
    category = models.CharField(max_length=20, default='system')  # image, tts, script, render, api, system
    message = models.TextField()
    details = models.JSONField(null=True)
    project = models.ForeignKey(VideoProject, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/setup/status` | Check if initial setup is needed |
| POST | `/api/setup/register` | Register first admin user |
| POST | `/api/login` | User login |
| POST | `/api/logout` | User logout |
| GET | `/api/user` | Get current user info |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get app settings |
| POST | `/api/settings` | Update app settings |
| GET | `/api/settings/status` | Get API keys status |
| POST | `/api/settings/api-keys` | Update API keys |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get single project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/import` | Import project from folder |

### AI Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generate-script` | Generate AI script |
| POST | `/api/generate-assets` | Generate all assets (sync) |
| POST | `/api/generate-background` | Generate assets (async) |
| POST | `/api/render-video` | Render final video |

### Assets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/voices` | Get available TTS voices |
| POST | `/api/tts-preview` | Preview TTS audio |
| POST | `/api/generate-image` | Generate single image |
| POST | `/api/regenerate-scene-image` | Regenerate scene image |

### Custom Styles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/custom-styles` | List custom image styles |
| POST | `/api/custom-styles` | Create custom style |
| PUT | `/api/custom-styles/:id` | Update custom style |
| DELETE | `/api/custom-styles/:id` | Delete custom style |

### Post-Processing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:id/thumbnail` | Generate thumbnail |
| POST | `/api/projects/:id/thumbnail-ai` | Generate AI thumbnail |
| POST | `/api/videos/concatenate` | Concatenate videos |
| GET | `/api/projects/:id/chapters` | Get video chapters |

### Long TTS
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/long-tts/voices` | List TTS voices |
| POST | `/api/long-tts/voices` | Add custom voice |
| PUT | `/api/long-tts/voices/:id` | Update custom voice |
| DELETE | `/api/long-tts/voices/:id` | Delete custom voice |
| GET | `/api/long-tts/files` | List generated files |
| DELETE | `/api/long-tts/files/:filename` | Delete TTS file |
| GET | `/api/long-tts/download/:filename` | Download TTS file |
| POST | `/api/long-tts/generate` | Generate TTS (sync) |
| POST | `/api/long-tts/generate-background` | Generate TTS (async) |
| GET | `/api/long-tts/job/:id` | Get job status |

### Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/logs` | Get system logs |
| DELETE | `/api/logs` | Clear system logs |

---

## Frontend Pages

### 1. Auth Page (`/auth`)
- Login form for existing users
- Redirects to setup if no users exist

### 2. Setup Page (`/setup`)
- First-time admin registration
- Only accessible when no users exist

### 3. Dashboard (`/dashboard`)
- Main workspace after login
- Shows usage analytics
- Quick access to features

### 4. Home/Pipeline Wizard (`/`)
- Step-by-step video creation wizard
- Topic input → Script generation → Voice selection → Image style → Generation

### 5. Project Editor (`/project/:id`)
- Edit individual scenes
- Preview and regenerate assets
- Render final video
- Download output

### 6. My Videos (`/my-videos`)
- List all created video projects
- Filter by status
- Delete projects

### 7. Image Generator (`/image-generator`)
- Standalone image generation tool
- Test different generators and prompts

### 8. Long TTS (`/long-tts`)
- Extended text-to-speech generation
- Manage custom voices
- Download audio files

### 9. Settings (`/settings`)
- Application preferences
- Scene settings (target words, max duration)
- Image style defaults
- Transition settings

### 10. API Settings (`/api-settings`)
- Configure API keys for external services
- View key status (configured/missing)

### 11. Logs Dashboard (`/logs`)
- View system logs
- Filter by level/category
- Debug errors

---

## Services Architecture

### 1. Script Generation Service
- Providers: Google Gemini, Groq
- Parses script into scenes with configurable word limits
- Generates prompts for images based on scene text

### 2. TTS Service
- Speechify integration (API key required)
- Inworld integration (free, no key needed)
- Generates MP3 audio files per scene
- Calculates scene duration from audio

### 3. Image Generation Service
- Multiple provider support with fallback
- Generates images matching video resolution
- Saves to project directory

### 4. FFmpeg Service
- Video assembly from images + audio
- Ken Burns motion effects
- Scene transitions
- Caption burning (ASS subtitles)
- Output encoding with quality presets

### 5. Caption Service
- Generates ASS subtitle files
- Configurable styles and positions
- Word-count based splitting (max 8 words)

### 6. Queue Service
- Background job processing
- Progress tracking
- Error handling with retries

### 7. Cleanup Service
- Scheduled cleanup of old projects
- Removes orphaned files
- Manages disk space

---

## File Structure (Django)

```
deepcut_django/
├── manage.py
├── requirements.txt
├── deepcut/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── accounts/           # User authentication
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── projects/           # Video projects
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── generation/         # AI generation
│   │   ├── views.py
│   │   ├── tasks.py        # Celery tasks
│   │   └── urls.py
│   ├── assets/             # TTS, images
│   │   ├── views.py
│   │   └── urls.py
│   └── analytics/          # Usage tracking
│       ├── models.py
│       └── views.py
├── services/
│   ├── gemini.py           # Script generation
│   ├── groq.py             # Alternative LLM
│   ├── speechify.py        # TTS
│   ├── inworld.py          # Free TTS
│   ├── image_generators.py # Image generation
│   ├── ffmpeg.py           # Video rendering
│   ├── captions.py         # ASS subtitles
│   └── cleanup.py          # Scheduled cleanup
├── static/
│   └── (React build or Django templates)
├── media/
│   └── projects/           # Generated content
└── templates/
    └── (If using Django templates)
```

---

## External API Integrations

### Required API Keys
| Provider | Purpose | Required |
|----------|---------|----------|
| GEMINI_API_KEY | Script generation | Yes (or Groq) |
| GROQ_API_KEY | Alternative script generation | Optional |
| SPEECHIFY_API_KEY | Premium TTS voices | Optional |
| FREEPIK_API_KEY | Image generation | Optional |
| WAVESPEED_API_KEY | Alternative images | Optional |
| RUNPOD_API_KEY | Custom image models | Optional |

### Free Services (No Key Needed)
- Inworld TTS
- Pollinations Image Generation

---

## Video Manifest Schema

```python
{
    "fps": 30,
    "width": 1920,
    "height": 1080,
    "transitionDuration": 0.5,
    "captionStyle": "classic",
    "captionPosition": "bottom-center",
    "scenes": [
        {
            "id": "uuid",
            "text": "Scene narration text",
            "audioFile": "scene_001.mp3",
            "imageFile": "scene_001.png",
            "durationInSeconds": 5.2,
            "motion": "zoom-in",
            "transition": "fade"
        }
    ]
}
```

---

## Constants and Enums

### Video Status
- `draft` - Project created, not generated
- `generating` - Assets being generated
- `ready` - All assets ready, can render
- `error` - Generation failed

### Caption Styles
- `none`, `classic`, `bold-yellow`, `minimal`, `netflix`, `karaoke`, `documentary`, `tiktok`, `boxed`

### Caption Positions
- `bottom-center`, `bottom-left`, `bottom-right`, `top-center`, `top-left`, `top-right`, `middle-center`

### Motion Effects
- `zoom-in`, `zoom-out`, `pan-left`, `pan-right`, `pan-up`, `pan-down`

### Transitions
- `none`, `fade`, `dissolve`, `wipe-left`, `wipe-right`, `wipe-up`, `wipe-down`

### Image Generators
- `seedream`, `wavespeed`, `runpod`, `pollinations`

### Log Levels
- `info`, `warn`, `error`, `debug`

### Log Categories
- `image`, `tts`, `script`, `render`, `api`, `system`

---

## Tech Stack Comparison

| Feature | Current (Node.js) | Django Version |
|---------|-------------------|----------------|
| Backend | Express.js | Django REST Framework |
| Database ORM | Drizzle | Django ORM |
| Auth | Passport.js | Django Auth / JWT |
| Background Jobs | Custom Queue | Celery + Redis |
| File Uploads | Multer | Django Storage |
| API Validation | Zod | DRF Serializers |
| Frontend | React + Vite | React (separate) or Django Templates |

---

## Development Notes

### Environment Variables
```
DATABASE_URL=postgresql://user:pass@host:5432/db
SECRET_KEY=your-django-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CELERY_BROKER_URL=redis://localhost:6379/0
MEDIA_ROOT=/path/to/media
```

### FFmpeg Requirement
- FFmpeg must be installed system-wide
- Used for all video processing

### File Storage
- Projects stored in `media/projects/{project_id}/`
- Each project contains: audio files, images, manifest, output video

---

## Migration Considerations

1. **Database Migration**: Export PostgreSQL data, update schema for Django ORM
2. **API Compatibility**: Maintain same endpoint structure for frontend compatibility
3. **Auth System**: Migrate from Passport.js sessions to Django sessions or JWT
4. **Background Tasks**: Replace custom queue with Celery
5. **Frontend**: Can keep React frontend, just point to Django API

---

*Document Version: 1.0*
*Last Updated: February 2026*
