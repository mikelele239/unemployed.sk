# Unemployed.sk — Design System

## Brand

- **Name**: unemployed.sk
- **Logo treatment**: "un" is same color as surrounding text, with an orange (#FF5C00) strikethrough line through "un"
- **Tagline SK**: Od prvej práce až po tvoj dream job
- **Tagline EN**: From your first job to your dream job

## Colors

### Dark Mode (Default)
| Token             | Value                    | Usage                    |
|-------------------|--------------------------|--------------------------|
| `--bg`            | `#0D0D0D`               | Page background          |
| `--bg-card`       | `#1A1A1A`               | Card backgrounds         |
| `--bg-card-hover` | `#222222`               | Card hover state         |
| `--text`          | `#F5F0E8`               | Primary text             |
| `--text-muted`    | `#999999`               | Secondary text           |
| `--accent`        | `#FF5C00`               | Primary accent (orange)  |
| `--accent-hover`  | `#FF7A2E`               | Accent hover state       |
| `--accent-light`  | `rgba(255,92,0,0.1)`    | Accent bg tint           |
| `--accent-lighter`| `rgba(255,92,0,0.05)`   | Subtle accent tint       |
| `--border`        | `#2A2A2A`               | Borders, dividers        |
| `--green`         | `#22C55E`               | Success states           |
| `--green-light`   | `rgba(34,197,94,0.12)`  | Success bg tint          |
| `--blue`          | `#3B82F6`               | Info/secondary accent    |
| `--purple`        | `#8B5CF6`               | Tertiary accent          |

### Light Mode
| Token             | Value                    |
|-------------------|--------------------------|
| `--bg`            | `#FFFFFF`               |
| `--bg-card`       | `#F7F7F7`               |
| `--bg-card-hover` | `#F0F0F0`               |
| `--text`          | `#1A1A1A`               |
| `--text-muted`    | `#666666`               |
| `--border`        | `#E0E0E0`               |

## Typography

| Role     | Font Family                              | Usage              |
|----------|------------------------------------------|--------------------|
| Display  | `'Instrument Serif', Georgia, serif`     | Headings, logo     |
| Body     | `'DM Sans', -apple-system, sans-serif`   | Body text, UI      |

### Type Scale
| Element     | Size                  | Weight | Letter-spacing |
|-------------|-----------------------|--------|----------------|
| H1 (hero)   | `clamp(3.5rem, 8vw, 6.5rem)` | 900 | -1px     |
| H2 (section)| `clamp(2.5rem, 5vw, 4rem)`   | 900 | -0.5px   |
| H3 (card)   | `1.35rem`            | 800    | -0.3px         |
| H4 (feature)| `1.3rem`             | 700    | -0.3px         |
| Body        | `16px`               | 400    | 0              |
| Small       | `0.875rem`           | 400    | 0              |
| Caption     | `0.75rem`            | 500    | 0              |
| Label       | `0.75rem`            | 600    | 3px (uppercase)|

## Spacing

| Token    | Value |
|----------|-------|
| xs       | 4px   |
| sm       | 8px   |
| md       | 16px  |
| lg       | 24px  |
| xl       | 32px  |
| 2xl      | 48px  |
| 3xl      | 64px  |

## Border Radius

| Token       | Value | Usage            |
|-------------|-------|------------------|
| `--radius`  | 16px  | Cards, modals    |
| `--radius-sm`| 10px | Inputs, buttons  |
| pill        | 100px | Chips, tags      |
| circle      | 50%   | Avatars          |

## Shadows

| Context   | Value                              |
|-----------|------------------------------------|
| Default   | `0 2px 12px rgba(0,0,0,0.2)`     |
| Card      | `0 8px 30px rgba(0,0,0,0.25)`    |
| Accent    | `0 4px 20px rgba(255,92,0,0.3)`  |
| Nav       | `0 8px 32px rgba(0,0,0,0.12)`    |

## Components

### Buttons
- **Primary**: `bg: --accent`, `color: #fff`, `radius: --radius-sm`, `padding: 14px 32px`
- **Outline**: `bg: transparent`, `border: 1px solid --border`, `color: --text`
- **Hover**: Scale 0.97 on active, glow shadow on hover

### Cards (Job Cards)
- `bg: --bg-card`, `border: 1px solid --border`, `radius: 20px`
- Header: avatar (44px, rounded-12px) + company info
- Tags: pill-shaped chips, first tag uses accent color
- Pay: large accent-colored rate with unit suffix
- Swipe buttons: 48px circles

### Chips/Tags
- `padding: 4px 12px` (tags) or `9px 16px` (selection chips)
- `border-radius: 100px` (pill)
- Selected state: `bg: --accent`, `color: #fff`
- Active transform: scale(0.95)

### Bottom Navigation
- 4-5 tabs with SVG icons (20x20) + label text
- Active state: `color: --accent` + animated indicator bar (3px)
- Background: `--bg` with top border

### Input Fields
- `padding: 12px 14px`, `border: 1.5px solid --border`, `radius: --radius-sm`
- Focus: `border-color: --accent`
- `font-size: 14px`, `bg: --bg-card`

### Overlays/Modals
- Full-screen slide-up: `transform: translateY(100%)`  → `translateY(0)`
- Backdrop blur: `blur(20px) saturate(180%)`
- Close button: 32px rounded square

## Animation Standards

| Type       | Duration | Easing                                   |
|------------|----------|------------------------------------------|
| Fade       | 300ms    | `ease`                                   |
| Slide      | 350ms    | `cubic-bezier(0.4, 0, 0.15, 1)`        |
| Tab switch | 300ms    | `cubic-bezier(0.4, 0, 0.15, 1)`        |
| Scale tap  | 100ms    | `ease`                                   |
| Progress   | 400ms    | `ease`                                   |
| Spring     | 500ms    | `cubic-bezier(0.34, 1.56, 0.64, 1)`    |

## Iconography
- Feather-style SVG icons (stroke-based, 2px weight)
- Size: 20px for nav, 16px inline
- Color inherits from `currentColor`

## Responsive Breakpoints
| Name     | Width    |
|----------|----------|
| Mobile   | < 480px  |
| Tablet   | < 768px  |
| Desktop  | < 900px  |
| Wide     | 1080px+  |
