# TINALS 2026 Playlist Player

A Single Page Application (SPA) and Progressive Web App (PWA) designed to play the curated playlist for the **This Is Not A Love Song (TINALS) Festival 2026**. This player provides an immersive experience to discover the festival's lineup through music videos, complete with scheduling information and ticketing links.

<img src="assets/images/screenshot-TINALS-player-TINALS-fr.png" width="300" alt="TINALS Player Screenshot">

## Tech Stack

This project is built with a focus on simplicity, performance, and longevity. It does not require any build tools or compilation steps.

*   **HTML5**: Semantic markup.
*   **CSS3**: Custom styling with variables, responsive design, and animations.
*   **JavaScript (Vanilla)**: Core logic, state management, and YouTube API integration.
*   **JSON**: Used for configuration, internationalization, and content data.
*   **PWA**: Service Worker and Manifest for offline capabilities and installation.

## Installation / Setup

Since this is a static site, you simply need to serve the files via a web server. No `npm install` or build process is required.

You can use any static file server. Examples:

**Python:**
```bash
# Run inside the project directory
python3 -m http.server 8000
```

**PHP:**
```bash
php -S localhost:8000
```

**Node.js (using `serve`):**
```bash
npx serve .
```

Access the player at `http://localhost:8000` (or whatever port your server uses).

## Configuration

The application is highly configurable through JSON files located in the root directory.

### App Configuration (`config_en.json`, `config_fr.json`)

These files handle general settings, feature flags, and internationalization (i18n).

*   **`site`**: Metadata for the application (Version, Title, Description, PWA Start URL, Author).
*   **`images`**: Paths to static assets like logos, favicons, and sprites.
*   **`features`**: Boolean flags to toggle functionality.
    *   `is_debug_js`: Enable console debugging.
    *   `is_menu_auto_hide`: Toggle menu behavior.
    *   `is_auto_play_next`: Enable continuous playback.
    *   `is_display_day`, `is_display_time`, `is_display_place`: Toggle schedule visibility.
    *   ...and more.
*   **`texts`**: All UI text strings for localization (Buttons, Headers, Error messages).

### Content Data (`data.json`)

This file contains the playlist and artist information. It is an array of objects, where each object represents a track/artist:

```json
{
    "id": 2,
    "group_name": "PROJECTOR",
    "title": "Chemical",
    "youtube": "https://www.youtube.com/watch?v=...",
    "description": "Artist biography...",
    "descriptionEN": "English version (optional)...",
    "group_image": "URL to artist image",
    "event_day": "vendredi",
    "event_date": "2025-06-27",
    "event_time": "19:15",
    "event_endtime": "20:00",
    "event_place": "Scène Extérieure Mosquito",
    "tags": ["vendredi", "tag-slug"],
    "events_tags": ["Post-Punk", "UK"]
}
```

## Deployment

### To Do

*   [ ] Set up CI/CD pipeline.
*   [ ] Configure production environment variables.
*   [ ] Optimize asset caching strategies.

## Credits

**Developer**: Olivier LOYNET
**Festival**: This Is Not A Love Song (TINALS) - Paloma / Nîmes Métropole
