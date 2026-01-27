# Design Guidelines: Faceless Video Generation Pipeline

## Design Approach
**Selected Approach:** Design System (Material Design) with inspiration from video creation tools like Runway ML and Descript

**Rationale:** This is a utility-focused video production tool requiring clear workflows, technical precision, and efficient user interaction. Material Design provides robust patterns for forms, progress indicators, and media preview while maintaining visual polish.

---

## Core Design Elements

### Typography
- **Primary Font:** Inter (via Google Fonts CDN)
- **Headers:** Font weight 700, sizes: text-3xl (main), text-2xl (sections), text-xl (cards)
- **Body:** Font weight 400, text-base for content, text-sm for labels
- **Monospace:** JetBrains Mono for technical details (durations, file paths)

### Layout System
**Spacing Primitives:** Tailwind units of 4, 6, 8, 12, 16, 24
- **Cards/Panels:** p-6, gap-4 between elements
- **Page sections:** py-12, px-8
- **Form fields:** mb-4, gap-6 between groups
- **Container:** max-w-7xl with mx-auto

### Component Library

#### Navigation
- **Side Navigation:** Vertical sidebar with collapsible structure
- **Width:** w-64 (expanded), w-16 (collapsed)
- **Content:** Logo top, main nav items center, user/settings bottom
- **Styling:** Border-right, bg-background/95 backdrop-blur

#### Pipeline Wizard
- **Multi-step form** with visual progress indicator (4 steps: Script → Assets → Preview → Render)
- **Step indicator:** Horizontal stepper with numbered circles, connecting lines
- **Each step:** Full-width card (rounded-lg, shadow-md) containing relevant controls

#### Script Input Section
- **Two-column layout** (lg:grid-cols-2):
  - Left: Large textarea for script paste/edit (min-h-96, font-mono)
  - Right: AI generation panel with topic input + generate button + voice selection dropdown
- **Character counter** below textarea
- **Auto-save indicator** in top-right

#### Asset Configuration Panel
- **Grid layout** (grid-cols-1 md:grid-cols-2 gap-6):
  - Voice settings card: Dropdown selector with voice preview button
  - Image style card: Radio buttons for motion effects (zoom-in, zoom-out, pan-left, pan-right)
  - Advanced settings: Duration override, FPS selector (30/60), resolution dropdown
- **Each card:** p-6, rounded-lg border

#### Video Preview Section
- **Center-focused layout:**
  - Video player (16:9 aspect ratio, max-w-4xl, centered)
  - Timeline scrubber below showing scenes as thumbnails
  - Playback controls (play, pause, speed, volume)
- **Scene list sidebar** (w-80, right-aligned): Scrollable list of scenes with thumbnails, text snippets, duration badges

#### Generation Progress
- **Modal overlay** with:
  - Circular progress spinner (large, centered)
  - Step-by-step status list (script → audio → images → rendering)
  - Current task description with loading animation
  - Estimated time remaining
  - Cancel button at bottom

#### Asset Management
- **Table view** for generated assets:
  - Columns: Preview thumbnail, Filename, Type (audio/image), Duration, Actions (download, delete)
  - Row hover effects with quick preview on thumbnail hover
  - Bulk actions toolbar when items selected

#### Forms & Inputs
- **Text inputs:** h-12, px-4, rounded-lg, border focus:ring-2
- **Dropdowns:** Custom styled with chevron icon, smooth dropdown animation
- **Buttons:**
  - Primary: px-6 py-3, rounded-lg, font-medium
  - Secondary: border variant with transparent background
  - Icon buttons: h-10 w-10, rounded-full for compact actions
  - Blurred backgrounds when overlaying video preview

#### Footer
- **Compact, utility-focused:** Generation stats (videos created, total duration), API status indicators, documentation link, version number
- **Height:** py-8, border-top

---

## Images
- **Hero Section:** NO large hero image - this is a tool, not marketing page
- **Asset Thumbnails:** Preview thumbnails for generated images (4:3 aspect ratio, rounded)
- **Empty States:** Illustration placeholders when no videos/assets exist
- **Scene Timeline:** Small thumbnail previews in timeline scrubber (16:9, w-24)

---

## Animations
**Minimal & Purposeful:**
- Progress indicators: Smooth indeterminate loading bars
- Step transitions: Subtle slide-in (300ms ease-out) when moving between wizard steps
- Modal overlays: Fade + scale (200ms)
- NO Ken Burns effects in UI (save that for video output)

---

## Icons
**Library:** Heroicons (via CDN)
- Settings: cog-6-tooth
- Generate: sparkles
- Preview: play-circle
- Download: arrow-down-tray
- Edit: pencil-square
- Audio: speaker-wave
- Image: photo