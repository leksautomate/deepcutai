# DeepCut AI - API Reference

Complete REST API documentation for DeepCut AI.

**Base URL**: `http://localhost:5001/api`

---

## Quick Reference

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/setup/status` | Check if setup is needed | No |
| POST | `/setup/register` | Register admin account | No |
| GET | `/settings` | Get user settings | Yes |
| POST | `/settings` | Update user settings | Yes |
| GET | `/settings/status` | Check API key status | Yes |
| POST | `/settings/api-keys` | Update API keys | Yes |
| GET | `/projects` | List all projects | Yes |
| GET | `/projects/:id` | Get project details | Yes |
| DELETE | `/projects/:id` | Delete a project | Yes |
| POST | `/projects/import` | Import a project | Yes |
| GET | `/projects/:id/chapters` | Get project chapters | Yes |
| POST | `/projects/:id/thumbnail` | Upload thumbnail | Yes |
| POST | `/projects/:id/thumbnail-ai` | Generate AI thumbnail | Yes |
| GET | `/voices` | List available TTS voices | No |
| POST | `/tts-preview` | Preview TTS audio | No |
| POST | `/generate-script` | Generate video script | Yes |
| POST | `/generate-image` | Generate scene image | Yes |
| POST | `/regenerate-scene-image` | Regenerate scene image | Yes |
| POST | `/generate-assets` | Generate all project assets | Yes |
| POST | `/render-video` | Render final video | Yes |
| POST | `/videos/concatenate` | Merge multiple videos | Yes |

---

## Authentication

DeepCut AI uses session-based authentication. After login, a session cookie is set that must be included in all authenticated requests.

### GET `/api/setup/status`

Check if initial setup (admin registration) is required.

**Response:**
```json
{
  "needsSetup": true,
  "message": "No admin account found. Please register."
}
```

### POST `/api/setup/register`

Register the admin account. Only available when no admin exists.

**Request Body:**
```json
{
  "username": "admin",
  "password": "your-secure-password"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Admin account created successfully"
}
```

**Error (400):**
```json
{
  "error": "Admin account already exists"
}
```

---

## Settings

### GET `/api/settings`

Get current user settings including preferences and configurations.

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "theme": "dark",
  "language": "en",
  "defaultVoice": "alloy",
  "defaultImageStyle": "cinematic",
  "autoSave": true,
  "createdAt": "2026-01-27T10:00:00Z",
  "updatedAt": "2026-01-27T12:00:00Z"
}
```

### POST `/api/settings`

Update user settings.

**Request Body:**
```json
{
  "theme": "matrix",
  "defaultVoice": "onyx",
  "defaultImageStyle": "historical"
}
```

### GET `/api/settings/status`

Check the validation status of configured API keys.

**Response:**
```json
{
  "gemini": { "configured": true, "valid": true },
  "groq": { "configured": true, "valid": true },
  "speechify": { "configured": false, "valid": false },
  "freepik": { "configured": true, "valid": true },
  "wavespeed": { "configured": false, "valid": false }
}
```

### POST `/api/settings/api-keys`

Update API keys in bulk.

**Request Body:**
```json
{
  "gemini": "your-gemini-api-key",
  "groq": "your-groq-api-key",
  "speechify": "your-speechify-api-key",
  "freepik": "your-freepik-api-key",
  "wavespeed": "your-wavespeed-api-key"
}
```

---

## Projects

### GET `/api/projects`

List all video projects for the authenticated user.

**Response:**
```json
[
  {
    "id": 1,
    "name": "History of Rome",
    "status": "completed",
    "thumbnailUrl": "/assets/thumbnails/1.jpg",
    "duration": 60,
    "createdAt": "2026-01-27T10:00:00Z",
    "updatedAt": "2026-01-27T12:00:00Z"
  }
]
```

### GET `/api/projects/:id`

Get detailed project information including scenes.

**Response:**
```json
{
  "id": 1,
  "name": "History of Rome",
  "status": "completed",
  "script": "In 753 BC, a city was founded...",
  "scenes": [
    {
      "id": "scene-uuid-1",
      "text": "In 753 BC, a city was founded.",
      "imageUrl": "/assets/images/scene-1.jpg",
      "audioUrl": "/assets/audio/scene-1.mp3",
      "duration": 5.2
    }
  ],
  "settings": {
    "voice": "alloy",
    "imageStyle": "historical"
  },
  "createdAt": "2026-01-27T10:00:00Z"
}
```

### DELETE `/api/projects/:id`

Delete a project and all associated assets.

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

### POST `/api/projects/import`

Import a project from exported JSON.

**Request Body:**
```json
{
  "name": "Imported Project",
  "script": "Script content here...",
  "scenes": [...],
  "settings": {...}
}
```

### GET `/api/projects/:id/chapters`

Get chapter markers for a rendered video.

**Response:**
```json
{
  "chapters": [
    { "title": "Introduction", "startTime": 0 },
    { "title": "The Rise", "startTime": 30 },
    { "title": "The Fall", "startTime": 90 }
  ]
}
```

### POST `/api/projects/:id/thumbnail`

Upload a custom thumbnail for the project.

**Request (multipart/form-data):**
- `thumbnail`: Image file (JPG/PNG, max 5MB)

### POST `/api/projects/:id/thumbnail-ai`

Generate an AI thumbnail based on project content.

**Request Body:**
```json
{
  "style": "cinematic",
  "prompt": "Optional custom prompt"
}
```

---

## Content Generation

### POST `/api/generate-script`

Generate a video script using AI.

**Request Body:**
```json
{
  "topic": "The Fall of the Roman Empire",
  "style": "documentary",
  "duration": "1min",
  "provider": "groq"
}
```

**Parameters:**
- `topic` (required): Subject matter for the script
- `style` (optional): `"documentary"` | `"storytelling"` | `"educational"` | `"entertaining"`
- `duration` (optional): `"30s"` | `"1min"` | `"2min"` | `"10min"`
- `provider` (optional): `"gemini"` | `"groq"` (defaults to user preference)

**Response:**
```json
{
  "title": "Video about The Fall of the Roman Empire",
  "script": "In 476 AD, a empire fell...",
  "scenes": [
    "In 476 AD, a empire fell.\nThe Western Roman Empire had ruled for centuries.",
    "Barbarian tribes crossed the borders.\nRome could not defend itself."
  ]
}
```

### POST `/api/generate-image`

Generate an image for a scene.

**Request Body:**
```json
{
  "projectId": 1,
  "sceneIndex": 0,
  "sceneText": "A Roman soldier standing at the gates.",
  "imageStyle": "historical",
  "customStyle": {
    "art_style": "Oil painting with soft brush strokes",
    "composition": "Centered subject with depth",
    "color_style": "Warm golden tones",
    "fine_details": "Weathered armor, stone architecture"
  }
}
```

**Response:**
```json
{
  "imageUrl": "/assets/images/project-1-scene-0.jpg",
  "prompt": "A Roman soldier in weathered bronze armor..."
}
```

### POST `/api/regenerate-scene-image`

Regenerate an existing scene image with new settings.

**Request Body:**
```json
{
  "projectId": 1,
  "sceneIndex": 0,
  "newPrompt": "A Roman soldier at night, dramatic lighting"
}
```

### POST `/api/generate-assets`

Generate all assets (images + audio) for a project.

**Request Body:**
```json
{
  "projectId": 1,
  "regenerateExisting": false,
  "imageStyle": "historical",
  "voiceId": "alloy"
}
```

**Response (streams progress):**
```json
{
  "status": "processing",
  "progress": 65,
  "currentStep": "Generating image for scene 4/6"
}
```

---

## Voice & Audio

### GET `/api/voices`

List all available TTS voices.

**Response:**
```json
{
  "voices": [
    {
      "id": "alloy",
      "name": "Alloy",
      "provider": "speechify",
      "gender": "neutral",
      "accent": "american"
    },
    {
      "id": "onyx",
      "name": "Onyx",
      "provider": "speechify",
      "gender": "male",
      "accent": "british"
    }
  ]
}
```

### POST `/api/tts-preview`

Generate a preview audio clip.

**Request Body:**
```json
{
  "text": "Hello, this is a preview.",
  "voiceId": "alloy"
}
```

**Response:**
```json
{
  "audioUrl": "/assets/audio/preview-uuid.mp3",
  "duration": 2.5
}
```

---

## Video Rendering

### POST `/api/render-video`

Render a project into a final video file.

**Request Body:**
```json
{
  "projectId": 1,
  "format": "mp4",
  "quality": "1080p",
  "includeSubtitles": true
}
```

**Parameters:**
- `projectId` (required): ID of the project to render
- `format` (optional): `"mp4"` | `"webm"` (defaults to mp4)
- `quality` (optional): `"720p"` | `"1080p"` | `"4k"` (defaults to 1080p)
- `includeSubtitles` (optional): Boolean (defaults to true)

**Response:**
```json
{
  "videoUrl": "/assets/videos/project-1-final.mp4",
  "duration": 63.5,
  "fileSize": "45MB"
}
```

### POST `/api/videos/concatenate`

Merge multiple video projects into one.

**Request Body:**
```json
{
  "projectIds": [1, 2, 3],
  "outputName": "Complete Documentary"
}
```

---

## Error Handling

All endpoints return consistent error responses:

**Client Error (4xx):**
```json
{
  "error": "Validation failed",
  "details": "Topic is required for script generation"
}
```

**Server Error (5xx):**
```json
{
  "error": "Internal server error",
  "message": "Failed to connect to image generation API"
}
```

**Authentication Error (401):**
```json
{
  "error": "Unauthorized",
  "message": "Please log in to access this resource"
}
```

---

## Rate Limits

- **Script Generation**: 10 requests/minute
- **Image Generation**: 30 requests/minute
- **Video Rendering**: 2 concurrent renders

Exceeded limits return `429 Too Many Requests`.

---

## WebSocket Events (Future)

*Coming in a future version for real-time progress updates.*
