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

| json key | mandatory | type | description |
| ----- | :---: | :---: | ----- |
| event\_name | yes | text | Event name or artist name |
| image | yes | url | Image of the event |
| image\_mobile |  | url | Image of the event for the mobile version (if not available, use “image”) |
| image\_thumbnail |  | url | Thumbnail image (if not available, use “image”) |
| description | yes | text | Description of the event in French |
| descriptionEN |  | text | Description of the event in English (if not available, use “description” in French) |
| video\_url |  | url | YouTube video of the artist at the event (if unavailable, displays image only) |
| audio |  | url | The audio file of the artist at the event (MP3). Used if video_url is missing. |
| video\_title |  | text | YouTube video title of the artist at the event |
| event\_day |  | text | Day of the week of the event |
| event\_start\_date |  | date | The event start date, format 'yyyy-mm-dd' |
| event\_end\_date |  | date | The event end date, format 'yyyy-mm-dd' |
| event\_start\_time |  | time | The event start time, format 'hh:mm' |
| event\_end\_time |  | time | The event end time, format 'hh:mm' |
| event\_duration |  | time | The event duration in minutes, format 'hh:mm' |
| event\_place |  | text | Event location |
| event\_tags |  | list | Event tags (used for filtering) |
| other\_tags |  | list | Other tags (metadata) |
| event\_link |  | url | Link to the official event |
| event\_ticket |  | url | The event ticket link |
| event\_status |  | value | The values are: scheduled, rescheduled, postponed, moved\_online, and canceled. Default: "scheduled". |
| performer\_deezer |  | url | The artist's Deezer channel |
| performer\_facebook |  | url | The artist's Facebook page |
| performer\_instagram |  | url | The artist's Instagram page |
| performer\_pinterest |  | url | The artist's Pinterest page |
| performer\_spotify |  | url | The artist's Spotify channel |
| performer\_tiktok |  | url | The artist's TikTok page |
| performer\_website |  | url | The artist's website page |
| performer\_youtube |  | url | The artist's YouTube channel |

**Example:**

```json
{
    "id": 2,
    "event_name": "PROJECTOR",
    "video_title": "Chemical",
    "video_url": "https://www.youtube.com/watch?v=ZzwPfuLIw1o&t=30",
    "audio": "https://thisisnotalovesong.fr/wp-content/uploads/2025/03/projector--59792--zzwpfuliw1o--projector--chemical-official-video.mp3",
    "description": "Depuis sa formation en 2018, le groupe de Brighton creuse le sillon d’un post-punk frénétique et n’hésite pas à donner la priorité à l’ampleur sonore et à une attitude expérimentale à l’égard de la pop. Le premier album de Projector, « Now When We Talk It’s Violence”, fait le pont entre des expérimentations arty, l’agressivité du punk. Tantôt versé dans le brutalisme sombre et industriel de Joy Division ou dans une pop libre et brillamment composée, non sans rappeler Interpol ou The Organ, l’album empile des climax qui chancellent, véritable écrin pour les voix entrelacées de Lucy Sheehan et Edward Ensbury.",
    "descriptionEN": "Since forming in 2018, the Brighton-based band has been ploughing the furrow of frenetic post-punk, not hesitating to prioritize sonic breadth and an experimental attitude to pop. Projector’s debut album, “Now When We Talk It’s Violence”, bridges the gap between arty experimentation and punk aggression. At times versed in the dark, industrial brutalism of Joy Division, and at other times in brilliantly composed free pop reminiscent of Interpol and The Organ, the album piles up staggering climaxes, a veritable showcase for the intertwined voices of Lucy Sheehan and Edward Ensbury.",
    "image": "https://thisisnotalovesong.fr/wp-content/uploads/2025/03/unknown-2.jpeg",
    "image_mobile": "https://thisisnotalovesong.fr/wp-content/uploads/2025/03/unknown-2x400x400.jpeg",
    "image_thumbnail": "https://thisisnotalovesong.fr/wp-content/uploads/2025/03/unknown-2-150x150.jpeg",
    "event_day": "vendredi",
    "event_start_date": "2025-06-27",
    "event_end_date": "2025-06-27",
    "event_start_time": "19:15",
    "event_end_time": "20:00",
    "event_duration": "00:45",
    "event_place": "Scène Extérieure Mosquito",
    "event_tags": [
        "Day #1",
        "Envie d'en découdre"
    ],
    "other_tags": [
        "Post-Punk",
        "UK"
    ],
    "performer_youtube": "https://www.youtube.com/channel/UCrCCSSvWCIssWuGNzf2tW7w",
    "performer_facebook": "https://www.facebook.com/projectormusic/",
    "performer_instagram": "https://www.instagram.com/projectorprojector/",
    "performer_website": "https://www.projectorprojector.co.uk/",
    "performer_deezer": "https://www.deezer.com/fr/artist/4158077",
    "performer_spotify": "https://open.spotify.com/intl-fr/artist/25loVbwSp0xXNu4Ds1lTa9"
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
