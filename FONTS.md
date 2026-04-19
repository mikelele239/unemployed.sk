# Unemployed.sk Typography & Font Architecture

This file serves as a strict technical constraint and historical record to ensure typography consistency across the monorepo and prevent the "Faux Bold" visual glitch from ever resurfacing.

## Core Typefaces

The project relies on two free Google Fonts that closely mimic the premium MyFonts (Kepler & Grayfel) used in initial design files:
1.  **Display Font**: `var(--font-display)` → **Instrument Serif** (mimics Kepler Cn Disp).
2.  **Body Font**: `var(--font-body)` → **DM Sans** (mimics Grayfel Medium).

## The "Faux Bold" CSP Glitch (Resolved)
**Issue**: Previously, the Node.js Express server (`server.js`) had a restrictive Content Security Policy (CSP) that inadvertently blocked `fonts.googleapis.com` and `fonts.gstatic.com`.
**Symptom**: This forced local development environments (specifically Windows/Chrome) to fall back to generic serif fonts (like `Georgia`) and synthesize a horribly warped, ultra-thick "faux bold" effect whenever hitting `font-weight: 800` or `900`. However, the live Netlify site (which bypassed the local Node server's CSP) rendered perfectly thin and elegant.
**Resolution**: The `style-src` and `font-src` directives in `server.js` were updated to explicitly permit Google Fonts. 

## Best Practices Established

To maintain UI parity between the Landing Page, Student App, and Employer App:

1.  **Direct HTML Injection**: ALL applications within this monorepo must load fonts via direct `<link>` tags in their respective `index.html` files, NOT via CSS `@import`.
    ```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    ```
2.  **Explicit Headings**: `Instrument Serif` only technically supports `font-weight: 400`, but its styling is structurally applied throughout the app using `font-weight: 900` or `font-weight: 800`. With the CSP unblocked, modern browsers handle this gracefully. Never attempt to "fix" perceived thickness by universally modifying weights—verify the CSP is allowing the web font to load first!
3.  **Rem vs Px scaling**: Components like `SwipeCard.jsx` dynamically align to root styling constraints (e.g., `1.35rem` instead of `26px`) to ensure absolute fidelity with the original layout structure.

*Do not alter or remove the CSP permissions for fonts in `server.js`.*
