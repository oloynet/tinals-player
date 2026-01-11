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

This file contains the playlist and artist information. It is an array of objects, where each object represents a track/artist.

**Field Specification:**

| json key | required | type | description |
| ----- | :---: | :---: | ----- |
| group\_name | yes | text | Event name or artist name |
| image | yes | url | Image of the event |
| image\_mobile | no | url | Image of the event for the mobile version (if not available, uses “image”) |
| image\_thumbnail | no | url | Thumbnail image (if not available, uses “image”) |
| description | yes | text | Description of the event in French |
| descriptionEN | no | text | Description of the event in English (if not available, uses “description”) |
| youtube | no | url | YouTube video of the artist at the event (if unavailable, displays image only) |
| title | no | text | YouTube video title of the artist at the event |
| event\_day | no | text | Day of the week of the event |
| event\_date | no | date | Date of the event, format 'yyyy-mm-dd' |
| event\_time | no | time | Time of the event, format 'hh:mm' |
| event\_endtime | no | time | Event end time, format 'hh:mm' |
| event\_duration | no | time | Duration of the event in minutes, format 'hh:mm' |
| event\_place | no | text | Event location |
| event\_tags | no | list | Event tags |
| performer\_youtube\_channel | no | url | The artist's YouTube channel |
| performer\_facebook | no | url | The artist's Facebook page |
| performer\_tiktok | no | url | The artist's TikTok page |
| performer\_instagram | no | url | The artist's Instagram page |
| performer\_pinterest | no | url | The artist's Pinterest page |

**Example:**

```json
{
    "id": 2,
    "group_name": "PROJECTOR",
    "title": "Chemical",
    "youtube": "https://www.youtube.com/watch?v=...",
    "description": "Artist biography...",
    "descriptionEN": "English version...",
    "image": "URL to artist image",
    "image_mobile": "URL to mobile image",
    "image_thumbnail": "URL to thumbnail",
    "event_day": "vendredi",
    "event_date": "2025-06-27",
    "event_time": "19:15",
    "event_endtime": "20:00",
    "event_place": "Scène Extérieure Mosquito",
    "tags": ["vendredi", "tag-slug"],
    "performer_instagram": "https://instagram.com/..."
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
