# AGENTS.md

This file provides context and guidelines for AI agents and human developers working on the **TINALS Playlist Player** repository.

## 1. Project Overview
This is a **static Single Page Application (SPA)** and **Progressive Web App (PWA)** built with **Vanilla JavaScript**. It is designed to be hosted on any static file server without a build step.

## 2. Core Directives

### 🚫 NO Build Tools / NO NPM
*   **Do not introduce `package.json`, `npm`, `yarn`, or build tools** (Webpack, Vite, Parcel, etc.).
*   The code must run directly in the browser.
*   All dependencies must be included as static assets or CDN links in `index.html`.

### 📂 File Structure & Paths
*   **Do not restructure the directories.** The app relies on specific relative paths for `assets/`, `config_*.json`, and `data.json`.
*   Resources are loaded via XHR/Fetch from the root. Moving files will break the application.

## 3. Configuration & Data
The application is **data-driven**. Before writing new code, check if the requirement can be met by changing a configuration file.

*   **`config/config_fr.json` / `config/config_en.json`**:
    *   Contains **Feature Flags** (e.g., `is_auto_play_next`, `is_display_time`).
    *   Contains **UI Strings** (i18n).
    *   Contains **Asset Paths**.
    *   *Agent Tip:* If asked to "hide the time" or "change the title," check these files first.

*   **`data/2026/data.json`**:
    *   Contains the actual playlist content (artists, video IDs, schedule).
    *   Do not hardcode artist data in `app.js`.

## 4. Development & Testing

### How to Run
Since there is no build step, use any static server to preview changes:
*   `python3 -m http.server`
*   `php -S localhost:8000`
*   `npx serve .`

### Verification
*   **Always** verify that the application loads without console errors.
*   **Always** check that `config_*.json` files are valid JSON after editing (trailing commas will break the app).

## 5. Coding Style
*   **JavaScript**: Use modern ES6+ features (Arrows, `const`/`let`, `async`/`await`) but ensure it remains compatible with modern browsers.
*   **CSS**: Use CSS Variables (`var(--color-primary)`) defined in `style.css` for consistency.
