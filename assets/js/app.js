// --- CENTRALISATION DE L'ÉTAT (STATE MANAGEMENT) ---
const AppState = {
    config: null,
    data: [],
    players: {},
    favorites: [],
    currentLang: 'fr',
    state: {
        activeId: null,
        previousId: null,
        isAutoNext: false,
        isMenuNavigation: false,
        isPlayingFavorites: false,
        currentTagFilter: null,
        isGlobalMuted: false,
        shareUrl: ""
    },
    timers: {
        menu: null,
        close: null,
        toast: null
    },
    settings: {
        isDebugJS: false,
        isDisplayVersion: false,
        versionNumber: "",
        isMenuAutoHide: false,
        isDisplayControlBar: true,
        isButtonSoundEnable: true,
        isButtonTopBottomEnable: false,
        isButtonPrevNextEnable: true,
        isFullscreenEnable: true,
        isDisplayDay: true,
        isDisplayDate: true,
        isDisplayTime: true,
        isDisplayYear: false,
        isDisplayTag: true,
        isDisplayPlace: true,
        isDisplayRecordName: false,
        isDisplayGroupDescription: true,
        isDescriptionAutoHide: true,
        isDisplayImageVideoPause: true,
        isDisplayImageVideoEnd: true,
        isAutoLoadVideo: false,
        isAutoPlayNext: true,
        isAutoPlayLoop: true,
        isAppInstall: false
    }
};

const translations = {
    days: {
        "lundi": "Monday",
        "mardi": "Tuesday",
        "mercredi": "Wednesday",
        "jeudi": "Thursday",
        "vendredi": "Friday",
        "samedi": "Saturday",
        "dimanche": "Sunday"
    },
    tags: {}
};

function deepMerge(target, source) {
    const isObject = (obj) => obj && typeof obj === 'object';

    if (!isObject(target) || !isObject(source)) {
        return source;
    }

    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            target[key] = targetValue.concat(sourceValue);
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            target[key] = deepMerge(Object.assign({}, targetValue), sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });

    return target;
}

function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .normalize('NFD')                  // separate accents
        .replace(/[\u0300-\u036f]/g, '')   // remove accents
        .replace(/[^a-z0-9]+/g, '-')       // replace non-alphanumeric chars with dash
        .replace(/^-+|-+$/g, '');          // remove leading/trailing dashes
}

function isLandscape() {
    return window.innerWidth > window.innerHeight;
}

async function init() {
    try {
        const urlParams               = new URLSearchParams( window.location.search );
        AppState.currentLang          = urlParams.get( 'lang' ) || 'fr';
        document.documentElement.lang = AppState.currentLang;

        const langConfigFile = AppState.currentLang === 'en' ? 'config_en.json' : 'config_fr.json';

        // 1. & 2. Charger les configs en parallèle
        const [mainConfigResponse, langConfigResponse] = await Promise.all([
            fetch('config.json'),
            fetch(langConfigFile)
        ]);

        if ( !mainConfigResponse.ok ) throw new Error( "Erreur config.json" );
        if ( !langConfigResponse.ok ) throw new Error( "Erreur config langue " + langConfigFile );

        const mainConfig = await mainConfigResponse.json();
        const langConfig = await langConfigResponse.json();

        // 3. Fusionner les configs (langue écrase main pour les clés existantes)
        // On clone mainConfig pour ne pas le muter directement si on devait le réutiliser
        AppState.config = deepMerge(JSON.parse(JSON.stringify(mainConfig)), langConfig);

        // Validation explicite pour éviter le crash "is_fullscreen_enable"
        if (!AppState.config.features) {
            console.error("Features manquantes dans la configuration fusionnée, utilisation d'un objet vide.");
            AppState.config.features = {};
        }

        applyConfigs();

        if ( AppState.settings.isDebugJS ) {
            console.log( "--- DEBUG MODE ACTIVATED ---" );
            attachDebugWrappers( VideoManager, "VideoManager" );
            attachDebugWrappers( ControlBar,   "ControlBar" );
        }

        const dataSource = (AppState.config.site && AppState.config.site.data_source) ? AppState.config.site.data_source : 'data.json';
        const response   = await fetch( dataSource );
        if ( !response.ok ) throw new Error( "Erreur " + dataSource );

        const rawData = await response.json();

        // VALIDATION
        AppState.data = rawData.filter( item => {
            const hasName  = item.event_name && item.event_name.trim() !== "";
            const hasImage = item.image && item.image.trim() !== "";
            const hasDesc  = item.description && item.description.trim() !== "";

            if ( !hasName || !hasImage || !hasDesc ) {
                console.error( "Skipping invalid item (missing required fields):", item );
                return false;
            }
            return true;
        });

        let storedFavs     = JSON.parse( localStorage.getItem( 'selected' ) ) || [];
        const validIds     = AppState.data.map( g => g.id );
        AppState.favorites = storedFavs.filter( id => validIds.includes( id ) );

        const filterParam  = urlParams.get( 'filter' );
        const favsParam    = urlParams.get( 'favorites' );
        const idParam      = urlParams.get( 'id' );

        renderFeed();
        renderFavorites();
        renderTimeline();

        if ( favsParam ) {
            const urlFavs = favsParam.split( ',' ).map( Number ).filter( id => validIds.includes( id ) );
            if ( urlFavs.length > 0 ) {
                AppState.favorites = [ ...new Set( [ ...AppState.favorites, ...urlFavs ] ) ];
                localStorage.setItem( 'selected', JSON.stringify( AppState.favorites ) );
                setTimeout( () => {
                    playFavorites();
                    updateURLState();
                }, 100 );
            } else {
                updateURLState();
            }
        } else if ( filterParam ) {
            setTimeout( () => {
                filterByTag( filterParam );
                updateURLState();
            }, 100 );
        } else if ( idParam && validIds.includes( Number( idParam ) ) ) {
            AppState.state.activeId = Number( idParam );
            setTimeout( () => {
                const target = document.getElementById( `video-${AppState.state.activeId}` );
                if ( target ) target.scrollIntoView( {
                    behavior: 'auto'
                } );
            }, 100 );
            updateURLState();
        } else {
            updateURLState();
        }

        setTimeout( () => {
            setupObserver();
        }, 800 );

        setupInteraction();
        setupDrawerListeners();
        setupSwipeGestures();
        setupScrollToasts();
        setupKeyboardControls();
        setupHapticFeedback();
        updateFavoritesIcon();
        updateStaticTexts();

        if ( AppState.settings.isAppInstall ) {
            PWAManager.init();
        }

        window.addEventListener('resize', handleOrientationChange);

        const loader = document.getElementById( 'loader' );
        if ( loader ) loader.classList.add( 'hidden' );

    } catch ( e ) {
        console.error( "Erreur d'initialisation :", e );
        const loader = document.getElementById( 'loader' );
        if ( loader ) loader.innerHTML = "<p class='loader-error-msg'>Erreur de chargement.<br>Vérifiez la console.</p>";
    }
}

function attachDebugWrappers( obj, objName ) {
    for ( let prop in obj ) {
        if ( typeof obj[ prop ] === 'function' ) {
            const originalMethod = obj[ prop ];
            obj[ prop ] = function ( ...args ) {
                console.groupCollapsed( `[DEBUG] ${objName}.${prop}` );
                console.log( "Params:", args );
                console.groupEnd();
                return originalMethod.apply( this, args );
            };
        }
    }
}

function applyConfigs() {
    const c = AppState.config;
    document.title = c.site.title;
    if ( c.site.theme_color ) {
        document.documentElement.style.setProperty( '--primary-color', c.site.theme_color );
        document.querySelector( 'meta[name="theme-color"]' ).setAttribute( 'content', c.site.theme_color );
    }
    const f = c.features || {};
    const s = AppState.settings;
    s.isDebugJS                 = f.is_debug_js                  ?? false;
    s.isDisplayVersion          = f.is_display_version           ?? false;
    s.versionNumber             = c.site.version || "";
    s.isFullscreenEnable        = f.is_fullscreen_enable         ?? true;
    s.isButtonSoundEnable       = f.is_button_sound_enable       ?? true;
    s.isButtonTopBottomEnable   = f.is_button_top_bottom_enable  ?? false;
    s.isButtonPrevNextEnable    = f.is_button_prev_next_enable   ?? true;
    s.isMenuAutoHide            = f.is_menu_auto_hide            ?? false;
    s.isDisplayDay              = f.is_display_day               ?? true;
    s.isDisplayDate             = f.is_display_date              ?? true;
    s.isDisplayTime             = f.is_display_time              ?? true;
    s.isDisplayTag              = f.is_display_tag               ?? true;
    s.isDisplayPlace            = f.is_display_place             ?? true;
    s.isDisplayRecordName       = f.is_display_record_name       ?? false;
    s.isDisplayGroupDescription = f.is_display_group_description ?? true;
    s.isDescriptionAutoHide     = f.is_description_auto_hide     ?? true;
    s.isDisplayImageVideoEnd    = f.is_display_image_video_end   ?? true;
    s.isDisplayImageVideoPause  = f.is_display_image_video_pause ?? true;
    s.isDisplayYear             = f.is_display_year              ?? false;
    s.isDisplayControlBar       = f.is_display_control_bar       ?? true;
    s.isAutoLoadVideo           = f.is_auto_load_video           ?? false;
    s.isAutoPlayNext            = f.is_auto_play_next            ?? true;
    s.isAutoPlayLoop            = f.is_auto_play_loop            ?? true;
    s.isAppInstall              = f.is_app_install               ?? true;

    if ( s.isDescriptionAutoHide ) document.body.classList.add( 'hide-desc-mobile' );
    else document.body.classList.remove( 'hide-desc-mobile' );

    if ( !s.isButtonSoundEnable ) document.getElementById( 'btn-mute' ).style.display = 'none';
    if ( !s.isButtonTopBottomEnable ) {
        document.getElementById( 'btn-nav-top' ).style.display    = 'none';
        document.getElementById( 'btn-nav-bottom' ).style.display = 'none';
    }
    if ( !s.isButtonPrevNextEnable ) {
        document.getElementById( 'btn-nav-up' ).style.display   = 'none';
        document.getElementById( 'btn-nav-down' ).style.display = 'none';
    }

    const versionEl = document.getElementById('app-version-indicator');
    if (versionEl) {
        if (s.isDisplayVersion && s.versionNumber) {
            versionEl.innerText = s.versionNumber;
            versionEl.classList.add('visible');
        } else {
            versionEl.classList.remove('visible');
        }
    }

    if ( AppState.settings.isDebugJS ) {
        //console.log( 's.isDisplayVersion = ' + s.isDisplayVersion );
        console.log( 's.versionNumber = ' + s.versionNumber );
    }


    if ( c.images ) {
        const menuUse = document.getElementById( 'menu-logo-use' );
        if ( menuUse ) menuUse.setAttribute( 'href', `${c.images.sprite_path}#${c.images.menu_id}` );

        const langIconUse = document.getElementById( 'lang-icon-use' );
        if ( langIconUse ) {
            const targetFlagId = AppState.currentLang === 'fr' ? c.images.flag_en_id : c.images.flag_fr_id;
            const href = `${c.images.sprite_path}#${targetFlagId}`;
            langIconUse.setAttribute( 'href', href );
            langIconUse.setAttributeNS( 'http://www.w3.org/1999/xlink', 'href', href );
        }

        document.querySelector( 'link[rel="icon"]' ).href = c.images.favicon;
        document.querySelector( 'link[rel="apple-touch-icon"]' ).href = c.images.apple_touch_icon;

        const manifest = {
            manifest_version: c.manifest_version,
            version: c.version,
            version_name: c.version_name,
            name: c.site.title,
            short_name: c.site.short_name,
            description: c.site.description,
            //scope: c.site.scope,
            //id: c.site.id,
            start_url: window.location.origin + window.location.pathname,
            display_override: ["fullscreen", "minimal-ui"],
            display: c.site.display,
            orientation: c.site.orientation,
            background_color: c.site.background_color,
            theme_color: c.site.theme_color,
            default_locale: c.site.default_locale,
            author: c.site.author,
            url: c.site.url,
            homepage_url: c.site.url,
            background:
            {
                scripts: [
                    "service-worker.js",
                    "assets/js/app.js",
                    "assets/js/simple-audio-player.js",
                    "assets/js/control-bar.js",
                    "assets/js/video-manager.js"
                ],
                service_worker: "service-worker.js"
            },
            icons: [
                {
                    src: c.images.icon_32_maskable,
                    sizes: "32x32",
                    type: "image/png",
                    purpose: "maskable"
                },
                {
                    src: c.images.icon_48_maskable,
                    sizes: "48x48",
                    type: "image/png",
                    purpose: "maskable"
                },
                {
                    src: c.images.favicon,
                    sizes: "48x48",
                    type: "image/vnd.microsoft.icon",
                    purpose: "any"
                },
                {
                    src: c.images.apple_touch_icon,
                    sizes: "180x180",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: c.images.icon_maskable_192,
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "maskable"
                },
                {
                    src: c.images.icon_192,
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: c.images.icon_512_maskable,
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "maskable"
                },
                {
                    src: c.images.icon_512,
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: c.images.icon_svg,
                    sizes: "512x512",
                    type: "image/svg+xml",
                    purpose: "any"
                }
            ]
        };
        const blob = new Blob( [ JSON.stringify( manifest ) ], {
            type: 'application/json'
        } );

        if ( AppState.settings.isDebugJS ) {
            console.log( window.location.origin + window.location.pathname );
        }

        // DESACTIVATE document.querySelector( 'link[rel="manifest"]' ).href = URL.createObjectURL( blob );
    }
}

function toggleLanguage() {
    const newLang = AppState.currentLang === 'fr' ? 'en' : 'fr';
    const url = new URL( window.location );
    url.searchParams.set( 'lang', newLang );
    window.location.href = url.href;
}

function translateText( text, type ) {
    if ( !text || AppState.currentLang === 'fr' ) return text;
    const lowerText = text.toLowerCase().trim();
    if ( translations[ type ] && translations[ type ][ lowerText ] ) return translations[ type ][ lowerText ];
    return text;
}

function getSvgHtml( spriteId, cssClass ) {
    return `<svg class="${cssClass}"><use href="${AppState.config.images.sprite_path}#${spriteId}"></use></svg>`;
}

function formatDate( dateStr ) {
    if ( !dateStr ) return "";
    const parts = dateStr.split( '-' );
    if ( parts.length !== 3 ) return dateStr;
    const day = parseInt( parts[ 2 ] );
    const yearShort = parts[ 0 ].slice( 2 );
    const monthIndex = parseInt( parts[ 1 ] ) - 1;
    const yearDisplay = AppState.settings.isDisplayYear ? ` ${yearShort}` : '';
    if ( AppState.currentLang === 'en' ) {
        const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
        const suffix = AppState.settings.isDisplayYear ? `, ${yearShort}` : '';
        return `${months[monthIndex]} ${day}${suffix}`;
    } else {
        const months = [ "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre" ];
        return `${day} ${months[monthIndex]}${yearDisplay}`;
    }
}

function updateStaticTexts() {
    const t = AppState.config.texts;
    document.getElementById( 'btn-header-prog' ).innerText   = t.nav_programming;
    document.getElementById( 'btn-header-ticket' ).innerText = t.nav_ticketing;
    document.getElementById( 'drawer-fav-title' ).innerText  = t.fav_title;
    document.getElementById( 'drawer-time-title' ).innerText = t.timeline_title;
    document.getElementById( 'btn-txt-play-fav' ).innerText  = t.fav_btn_play;
    document.getElementById( 'btn-txt-share-fav' ).innerText = t.fav_btn_share;
    document.getElementById( 'share-title-text' ).innerText  = t.share_title;
    document.getElementById( 'txt-share-fb' ).innerText      = t.share_facebook;
    document.getElementById( 'txt-share-tiktok' ).innerText  = t.share_tiktok;
    document.getElementById( 'txt-share-email' ).innerText   = t.share_email;
    document.getElementById( 'share-link-label' ).innerText  = t.share_link;
    document.getElementById( 'txt-share-qr' ).innerText      = t.share_qrcode;
    document.getElementById( 'btn-close-share' ).innerText   = t.share_btn_close;
    document.getElementById( 'fav-mode-bar' ).innerHTML      = `${t.filter_cancel_fav} <button class="close-fav-mode"><span class="material-icons">close</span></button>`;

    // Tag mode bar: we need to handle the text inside dynamically based on the slug -> name mapping or just display the current filter
    // For now we just put the template
    document.getElementById( 'tag-mode-bar' ).innerHTML      = `${t.filter_cancel_tags} <span id="active-tag-name" class="tag-name-label"></span> <button class="close-fav-mode"><span class="material-icons">close</span></button>`;
}

function renderFeed() {
    const feed = document.getElementById( 'main-feed' );
    const htmlParts = [ getIntroHtml(), ...AppState.data.map( group => getVideoCardHtml( group ) ), getTicketingHtml() ];
    feed.innerHTML = htmlParts.join( '' );
}

function getIntroHtml() {
    const c = AppState.config;
    const s = AppState.settings;
    const logoHtml = getSvgHtml( c.images.presentation_id, "intro-logo" );

    return `
        <section class="presentation-card section-snap">
            <div class="intro-content-top">
                <h1>${logoHtml}</h1>
                <h2 class="intro-subtitle">${c.texts.intro_subtitle}</h2>
            </div>
            <div class="intro-date"><span>${c.texts.intro_date}</span></div>
            <div class="intro-content-bottom">
                <div class="intro-buttons-container">
                    <button onclick="scrollToFirstVideo()" class="intro-btn">${c.texts.intro_btn_program}</button>
                    <button onclick="scrollToTicketing()" class="intro-btn">${c.texts.intro_btn_ticket}</button>
                </div>
                <p class="intro-note">${c.texts.intro_footer}</p>
            </div>
        </section>`;
}

function getSocialsHtml(g) {
    const networks = [
        { key: 'performer_facebook', label: 'Facebook' },
        { key: 'performer_instagram', label: 'Instagram' },
        { key: 'performer_tiktok', label: 'TikTok' },
        { key: 'performer_pinterest', label: 'Pinterest' },
        { key: 'performer_youtube', label: 'YouTube' },
        { key: 'performer_spotify', label: 'Spotify' },
        { key: 'performer_deezer', label: 'Deezer' },
        { key: 'performer_website', label: 'Website' },
        { key: 'event_link', label: 'Event' },
        { key: 'event_ticket', label: 'Tickets' }
    ];

    const links = networks.filter(n => g[n.key]).map(n => {
        return `<a href="${g[n.key]}" target="_blank" class="social-pill" title="${n.label}">${n.label}</a>`;
    });

    if (links.length === 0) return '';
    return `<div class="social-links-container">${links.join('')}</div>`;
}

function getVideoCardHtml( g ) {
    const s = AppState.settings;
    const tagsHtml = ( s.isDisplayTag && g.event_tags ) ? `<div class="tags-container">${g.event_tags.map(t => {
        const slug = slugify(t);
        return `<span class="tag-pill" onclick="filterByTag('${slug}', event)">${translateText(t, 'tags')}</span>`;
    }).join('')}</div>` : '';

    const songTitleOverlay = ( s.isDisplayRecordName && g.video_title ) ? `<h3 class="song-title-overlay">"${g.video_title}"</h3>` : '';
    const songTitleCenter  = ( s.isDisplayRecordName && g.video_title ) ? `<h3>"${g.video_title}"</h3>` : '';
    const dayName          = ( s.isDisplayDay && g.event_day ) ? translateText( g.event_day, 'days' ).toUpperCase() : '';
    const dateRaw          = ( s.isDisplayDate && g.event_start_date ) ? formatDate( g.event_start_date ) : '';

    let timeString         = '';
    if ( s.isDisplayTime ) {
        timeString = g.event_start_time || '';
        if ( timeString && g.event_end_time ) timeString += ` - ${g.event_end_time}`;
    }

    const placeName      = ( s.isDisplayPlace && g.event_place ) ? g.event_place : '';
    const overlayDetails = [ placeName, dayName, dateRaw, timeString ].filter( Boolean ).join( ' • ' );

    let splashHtml       = '';
    if ( s.isDisplayPlace && g.event_place ) splashHtml += `<span class="splash-meta-place">${g.event_place}</span>`;

    let dateTimeParts    = [];
    if ( dayName ) dateTimeParts.push( dayName );
    if ( dateRaw ) dateTimeParts.push( dateRaw );

    let dateTimeStr       = dateTimeParts.join( ' ' );
    if ( dateTimeStr && timeString ) dateTimeStr += ' • ' + timeString;
    else if ( !dateTimeStr && timeString ) dateTimeStr = timeString;

    if ( dateTimeStr ) splashHtml += `<span class="splash-meta-date">${dateTimeStr}</span>`;
    const splashMetaHtml  = splashHtml ? `<div class="splash-meta">${splashHtml}</div>` : '';

    const descriptionText = ( AppState.currentLang === 'en' && g.descriptionEN ) ? g.descriptionEN : g.description;
    const socialsHtml     = getSocialsHtml(g);
    const descHtml        = ( s.isDisplayGroupDescription && descriptionText ) ? `<div class="description" onclick="toggleDescription(this, event)">${descriptionText}${socialsHtml}</div>` : '';

    const avatarImg       = g.image_thumbnail || g.image;
    const avatarHtml      = `
        <div class="group-avatar-container" onclick="toggleDescription(this.parentNode.querySelector('.description'), event)">
            <img src="${avatarImg}" class="group-avatar" alt="${g.event_name}">
        </div>`;

    const isMobile = isMobileDevice();
    const bgImage = ( isMobile && g.image_mobile ) ? g.image_mobile : g.image;

    let statusBadge = '';
    if (g.event_status && g.event_status !== 'scheduled') {
        let statusClass = 'bg-red';
        if(g.event_status === 'rescheduled') statusClass = 'bg-orange';
        else if(g.event_status === 'postponed') statusClass = 'bg-orange';
        else if(g.event_status === 'moved_online') statusClass = 'bg-blue';

        const statusLabel = translateText(g.event_status, 'status') || g.event_status.replace('_', ' ').toUpperCase();
        statusBadge = `<div class="status-badge ${statusClass}">${statusLabel}</div>`;
    }

    return `
    <article class="video-card section-snap ${AppState.favorites.includes(g.id) ? 'is-favorite' : ''}" id="video-${g.id}" data-id="${g.id}">
        <div class="video-container">
            <div class="group-title-center">
                ${statusBadge}
                <h2>${g.event_name}</h2>
                ${songTitleCenter}
                ${splashMetaHtml}
            </div>
            <div class="video-background" style="background-image: url('${bgImage}');"></div>
            <div id="player-${g.id}" class="yt-placeholder"></div>
        </div>
        <div class="video-overlay">
            <div class="group-info">
                ${avatarHtml}
                <h2>${g.event_name}</h2>
                ${songTitleOverlay}
                ${tagsHtml}
                ${descHtml}
                <div class="event-details">${overlayDetails}</div>
            </div>
        </div>
    </article>`;
}

function getTicketingHtml() {
    const t = AppState.config.texts;
    const ticketing = AppState.config.ticketing || {};
    let blocksHtml = '';

    for (const key in ticketing) {
        if (ticketing.hasOwnProperty(key)) {
            const ticket = ticketing[key];
            const isAvailable = ticket.is_available !== false;
            const colorClass = ticket.button_color || '';
            const title = ticket.ticket_title || '';
            const subtitle = ticket.ticket_subtitle || '';
            const btnText = ticket.button_text || '';
            const url = ticket.button_url || '#';

            let btnHtml = '';
            if (isAvailable) {
                btnHtml = `<a href="${url}" target="_blank" class="ticket-btn ${colorClass}" title="${btnText}">${btnText}</a>`;
            } else {
                btnHtml = `<span class="ticket-btn ${colorClass} disabled" title="${btnText}">${btnText}</span>`;
            }

            blocksHtml += `
                <div class="ticket-block ${colorClass}">
                    <h2>${title}</h2>
                    <h3>${subtitle}</h3>
                    ${btnHtml}
                </div>`;
        }
    }

    return `
        <section class="ticketing-card section-snap" id="ticketing-section">
            <div class="ticket-title"><h2>${t.ticket_section_title}</h2></div>
            <div class="ticket-container">
                ${blocksHtml}
            </div>
        </section>`;
}

function renderFavorites() {
    const list = document.getElementById( 'favorites-list' );
    let favs = AppState.data.filter( g => AppState.favorites.includes( g.id ) );
    if ( AppState.state.currentTagFilter ) {
        // Filter using slug comparison
        favs = favs.filter( g => g.event_tags && g.event_tags.some(t => slugify(t) === AppState.state.currentTagFilter) );
    }

    // Use UL/LI for list semantics
    if (favs.length) {
        const itemsHtml = favs.map( g => {
            const thumb = g.image_thumbnail || g.image;
            return `
            <li class="favorite-item">
                <img src="${thumb}" alt="${g.event_name}">
                <div class="fav-title">${g.event_name}</div>
                <button onclick="shareSong(${g.id})" class="material-icons btn-fav-share">share</button>
                <button onclick="VideoManager.scrollTo(${g.id})" class="material-icons btn-fav-play">play_arrow</button>
                <button onclick="toggleFav(${g.id})" class="material-icons btn-fav-remove">close</button>
            </li>`;
        }).join('');
        list.innerHTML = `<ul>${itemsHtml}</ul>`;
    } else {
        list.innerHTML = `<p class="fav-empty-msg">${AppState.config.texts.fav_empty}</p>`;
    }

    const footer = document.getElementById( 'favorites-footer' );
    if ( favs.length > 0 ) footer.classList.add( 'visible' );
    else footer.classList.remove( 'visible' );
}

function renderTimeline() {
    const list       = document.getElementById( 'timeline-list' );
    const s          = AppState.settings;
    let dataToRender = AppState.data;

    if ( AppState.state.currentTagFilter ) {
        // Filter using slug comparison
        dataToRender = AppState.data.filter( g => g.event_tags && g.event_tags.some(t => slugify(t) === AppState.state.currentTagFilter) );
    }
    const sortedData = [ ...dataToRender ].sort( ( a, b ) => {
        const tA = ( a.event_start_date || '9999-99-99' ) + 'T' + ( a.event_start_time || '00:00' );
        const tB = ( b.event_start_date || '9999-99-99' ) + 'T' + ( b.event_start_time || '00:00' );
        return tA.localeCompare( tB );
    } );
    if ( sortedData.length === 0 ) {
        list.innerHTML = `<p class="list-empty-msg">${AppState.config.texts.timeline_empty}</p>`;
        return;
    }

    // Use UL/LI for list semantics
    const itemsHtml = sortedData.map( g => {
        const dayName  = ( s.isDisplayDay && g.event_day ) ? translateText( g.event_day, 'days' ).toUpperCase() : '';
        const dateRaw  = ( s.isDisplayDate && g.event_start_date ) ? formatDate( g.event_start_date ) : '';
        let timeString = '';
        if ( s.isDisplayTime ) {
            timeString = g.event_start_time || '';
            if ( timeString && g.event_end_time ) timeString += ` - ${g.event_end_time}`;
        }
        const placeName = ( s.isDisplayPlace && g.event_place ) ? g.event_place : '';
        const metaLine  = [ dayName, dateRaw, timeString, placeName ].filter( Boolean ).join( ' • ' );
        const tagsHtml  = ( s.isDisplayTag && g.event_tags ) ? g.event_tags.map( t => {
            const slug = slugify(t);
            return `<span class="time-tag" onclick="filterByTag('${slug}', event)">${translateText(t, 'tags')}</span>`;
        } ).join( '' ) : '';
        const isFav = AppState.favorites.includes( g.id );
        const thumb = g.image_thumbnail || g.image;
        return `
        <li class="timeline-item" onclick="VideoManager.scrollTo(${g.id})">
            <img src="${thumb}" class="time-thumb" loading="lazy" alt="${g.event_name}">
            <div class="time-info">
                <div class="time-row-1">
                    <h3>${g.event_name}</h3>
                    <button class="time-btn-fav material-icons ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFav(${g.id});">${isFav ? 'favorite' : 'favorite_border'}</button>
                </div>
                <div class="time-row-2">${metaLine}</div>
                <div class="time-row-3">${tagsHtml}</div>
            </div>
        </li>`;
    } ).join( '' );

    list.innerHTML = `<ul>${itemsHtml}</ul>`;
}



function toggleMute() {
    VideoManager.toggleMute();
}

function scrollToFirstVideo() {
    const firstVideo = document.querySelector( '.video-card[data-id]' );
    if ( firstVideo ) {
        const id = Number( firstVideo.dataset.id );
        if ( !isNaN( id ) ) {
            VideoManager.scrollTo( id, false );
        }
    }
}

function playFavorites() {
    if ( AppState.favorites.length === 0 ) return;
    clearTagFilter();
    AppState.state.isPlayingFavorites = true;
    document.body.classList.add( 'favorites-mode' );
    document.getElementById( 'fav-mode-bar' ).classList.add( 'active' );
    AppState.state.isMenuNavigation = true;
    VideoManager.scrollTo( AppState.favorites[ 0 ] );
}

function exitFavoritesMode() {
    AppState.state.isPlayingFavorites = false;
    document.body.classList.remove( 'favorites-mode' );
    document.getElementById( 'fav-mode-bar' ).classList.remove( 'active' );
    if ( AppState.state.activeId ) {
        setTimeout( () => {
            const el = document.getElementById( `video-${AppState.state.activeId}` );
            if ( el ) el.scrollIntoView( {
                behavior: 'auto',
                block: 'start'
            } );
        }, 50 );
    }
    updateActionButtons( AppState.state.activeId );
    updateNavButtons();
}

function toggleFav( id ) {
    if ( AppState.favorites.includes( id ) ) {
        AppState.favorites = AppState.favorites.filter( f => f !== id );
        showToast( AppState.config.texts.bar_fav_removed );
    } else {
        AppState.favorites.push( id );
        showToast( AppState.config.texts.bar_fav_added );

        const drawer = document.getElementById( 'combined-drawer' );

        if ( !drawer.classList.contains( 'active' ) &&
            !AppState.state.isPlayingFavorites ) {

            toggleCombinedDrawer( 'favorites' );
            startAutoCloseTimer();
        }
    }
    localStorage.setItem( 'selected', JSON.stringify( AppState.favorites ) );
    updateActionButtons( AppState.state.activeId );
    renderFavorites();
    renderTimeline();
    updateFavoritesIcon();
}

function toggleFavCurrent() {
    toggleFav( AppState.state.activeId );
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test( navigator.userAgent );
}

function getBaseShareUrl() {
    const url = new URL( window.location.origin + window.location.pathname );
    url.searchParams.set( 'share', 'web' );
    if ( AppState.currentLang ) {
        url.searchParams.set( 'lang', AppState.currentLang );
    }
    return url;
}

async function shareCurrent() {
    let urlObj = getBaseShareUrl();

    if ( AppState.state.isPlayingFavorites && AppState.favorites.length > 0 ) {
        urlObj.searchParams.set( 'favorites', AppState.favorites.join( ',' ) );
    } else if ( AppState.state.currentTagFilter ) {
        urlObj.searchParams.set( 'filter', AppState.state.currentTagFilter );
    } else if ( AppState.state.activeId !== null && !isNaN( AppState.state.activeId ) ) {
        urlObj.searchParams.set( 'id', AppState.state.activeId );
    }

    const url = urlObj.href;
    AppState.state.shareUrl = url;

    if ( isMobileDevice() && navigator.share ) {
        try {
            await navigator.share( {
                title: document.title,
                text: AppState.config.texts.share_title,
                url: url
            } );
        } catch ( err ) {}
    } else {
        openShareModal();
    }
}

async function shareSong( id ) {
    let urlObj = getBaseShareUrl();
    urlObj.searchParams.set( 'id', id );

    const url = urlObj.href;
    AppState.state.shareUrl = url;

    if ( isMobileDevice() && navigator.share ) {
        try {
            await navigator.share( {
                title: AppState.config.texts.share_title,
                text: 'Écoute ce morceau !',
                url: url
            } );
        } catch ( err ) {}
    } else {
        openShareModal();
    }
}

async function shareFavoritesList() {
    if ( AppState.favorites.length === 0 ) return;
    toggleCombinedDrawer( 'favorites' );

    let urlObj = getBaseShareUrl();
    urlObj.searchParams.set( 'favorites', AppState.favorites.join( ',' ) );

    const url = urlObj.href;
    AppState.state.shareUrl = url;

    if ( isMobileDevice() && navigator.share ) {
        try {
            await navigator.share( {
                title: AppState.config.texts.share_title,
                text: AppState.config.texts.fav_title,
                url: url
            } );
        } catch ( err ) {}
    } else {
        openShareModal();
    }
}

function openShareModal() {
    document.getElementById( 'share-link-display' ).innerText = AppState.state.shareUrl;
    document.getElementById( 'share-modal' ).classList.add( 'active' );
}

function closeShareModal() {
    document.getElementById( 'share-modal' ).classList.remove( 'active' );
    document.getElementById( 'qr-result' ).style.display = 'none';
}

function shareTo( platform ) {
    const url = encodeURIComponent( AppState.state.shareUrl );
    const text = encodeURIComponent( AppState.config.texts.share_title );
    if ( platform === 'facebook' ) window.open( `https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank' );
    else if ( platform === 'email' ) window.location.href = `mailto:?subject=${text}&body=${url}`;
    else if ( platform === 'tiktok' || platform === 'copy' ) {
        navigator.clipboard.writeText( AppState.state.shareUrl ).then( () => {
            alert( "Lien copié !" );
            if ( platform === 'tiktok' ) window.open( 'https://www.tiktok.com', '_blank' );
        } );
    } else if ( platform === 'qrcode' ) {
        const qrContainer = document.getElementById( 'qr-result' );
        qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${url}" alt="QR Code">`;
        qrContainer.style.display = 'block';
        return;
    }
    closeShareModal();
}

function setupInteraction() {
    document.querySelectorAll( '.video-card' ).forEach( container => {
        container.addEventListener( 'click', function ( e ) {
            if ( closeDrawerIfOpen() ) {
                e.stopPropagation();
                return;
            }
            const id = Number( this.dataset.id );
            if ( !isNaN( id ) ) {
                VideoManager.togglePlayPause( id );
                if ( AppState.state.isPlayingFavorites && !AppState.favorites.includes( id ) ) {
                    exitFavoritesMode();
                }
            }
        } );
    } );
}

function setupObserver() {
    const observer = new IntersectionObserver( ( entries ) => {
        entries.forEach( entry => {
            if ( entry.isIntersecting ) {
                if ( entry.target.hasAttribute( 'data-id' ) ) {
                    const id = Number( entry.target.dataset.id );
                    entry.target.classList.add( 'active' );
                    let shouldPlay = false;
                    if ( AppState.state.isMenuNavigation ) shouldPlay = false;
                    else if ( AppState.state.isAutoNext ) {
                        shouldPlay = true;
                        AppState.state.isAutoNext = false;
                    } else if ( AppState.state.previousId !== null && VideoManager.instances[ AppState.state.previousId ] ) {
                        if ( typeof VideoManager.instances[ AppState.state.previousId ].getPlayerState === 'function' ) {
                            const prevState = VideoManager.instances[ AppState.state.previousId ].getPlayerState();
                            if ( prevState === 1 ) shouldPlay = true;
                        }
                    }
                    if ( !AppState.state.isMenuNavigation ) {
                        if ( AppState.state.previousId !== null && VideoManager.instances[ AppState.state.previousId ] && typeof VideoManager.instances[ AppState.state.previousId ].pauseVideo === 'function' ) {
                            VideoManager.instances[ AppState.state.previousId ].pauseVideo();
                        }
                        if ( shouldPlay ) VideoManager.play( id );
                    }
                    AppState.state.previousId = AppState.state.activeId = id;
                    updateActionButtons( id );
                    updateURLState();

                    if ( AppState.settings.isDisplayControlBar ) {
                        document.getElementById( 'control-bar' ).classList.add( 'visible' );
                        ControlBar.syncUI( id );
                    }

                } else {
                    AppState.state.activeId = null;
                    if ( AppState.state.previousId !== null && VideoManager.instances[ AppState.state.previousId ] && typeof VideoManager.instances[ AppState.state.previousId ].pauseVideo === 'function' ) {
                        VideoManager.instances[ AppState.state.previousId ].pauseVideo();
                    }
                    updateActionButtons( null );
                    updateURLState();
                    document.querySelectorAll( '.section-snap' ).forEach( s => s.classList.remove( 'active' ) );
                    entry.target.classList.add( 'active' );

                    if ( AppState.settings.isDisplayControlBar ) {
                        document.getElementById( 'control-bar' ).classList.remove( 'visible' );
                    }
                }
                updateNavButtons();
            } else {
                entry.target.classList.remove( 'active' );
                if ( entry.target.querySelector( '.description' ) ) {
                    entry.target.querySelector( '.description' ).classList.remove( 'expanded' );
                }
            }
        } );
    }, {
        threshold: 0.6
    } );
    document.querySelectorAll( '.section-snap' ).forEach( el => observer.observe( el ) );
}

function setupSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    document.addEventListener( 'touchstart', e => {
        touchStartX = e.changedTouches[ 0 ].screenX;
        touchStartY = e.changedTouches[ 0 ].screenY;
    } );
    document.addEventListener( 'touchend', e => {
        let touchEndX = e.changedTouches[ 0 ].screenX;
        let touchEndY = e.changedTouches[ 0 ].screenY;
        handleGesture( touchStartX, touchStartY, touchEndX, touchEndY );
    } );
}

function handleGesture( startX, startY, endX, endY ) {
    let xDiff = startX - endX;
    let yDiff = startY - endY;
    if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
        if ( Math.abs( xDiff ) > 50 ) {
            const drawer = document.getElementById( 'combined-drawer' );
            if ( drawer.classList.contains( 'active' ) ) {
                 // If dragging right (startX < endX), we might want to close?
                 // Current logic: any swipe > 50 horizontal triggers toggle.
                 // We will maintain toggle behavior: if open, close.
                 closeAllDrawers();
            } else {
                 // If closed, maybe open?
                 // Original logic opened favorites drawer if nothing was open.
                 toggleCombinedDrawer('favorites');
            }
        }
    }
}

function setupKeyboardControls() {
    document.addEventListener( 'keydown', ( e ) => {
        const key = e.key.toLowerCase();
        const activeId = AppState.state.activeId;
        if ( e.key === 'Escape' ) {
            const shareModal = document.getElementById( 'share-modal' );
            if ( shareModal.classList.contains( 'active' ) ) {
                closeShareModal();
                return;
            }
            const drawers = document.querySelectorAll( '.drawer-right.active' );
            if ( drawers.length > 0 ) {
                closeAllDrawers();
                return;
            }
            if ( document.fullscreenElement ) document.exitFullscreen();
            return;
        }
        if ( e.key === 'Enter' ) {
            e.preventDefault();
            if ( activeId !== null && !isNaN( activeId ) ) toggleFavCurrent();
        }
        if ( key === 'f' ) {
            e.preventDefault();
            if ( AppState.settings.isFullscreenEnable && activeId ) VideoManager.toggleFullscreen( activeId );
        }
        if ( key === 's' ) shareCurrent();
        if ( key === 'm' ) VideoManager.toggleMute();
        if ( key === 'k' || e.code === 'Space' ) {
            e.preventDefault();
            if ( activeId !== null && !isNaN( activeId ) ) VideoManager.togglePlayPause( activeId );
        }
        if ( e.key === 'ArrowUp' ) {
            e.preventDefault();
            navigateScroll( 'up' );
        }
        if ( e.key === 'ArrowDown' ) {
            e.preventDefault();
            navigateScroll( 'down' );
        }
        if ( activeId && VideoManager.instances[ activeId ] && typeof VideoManager.instances[ activeId ].getCurrentTime === 'function' ) {
            const p = VideoManager.instances[ activeId ];
            const current = p.getCurrentTime();
            if ( key === 'j' || e.key === 'ArrowLeft' ) p.seekTo( current - 10, true );
            if ( key === 'l' || e.key === 'ArrowRight' ) p.seekTo( current + 10, true );
        }
    } );
}

function showToast( message ) {
    const toast = document.getElementById( 'scroll-toast' );
    if ( toast.classList.contains( 'visible' ) && toast.innerText === message ) return;
    toast.innerText = message;
    toast.classList.add( 'visible' );
    if ( AppState.timers.toast ) clearTimeout( AppState.timers.toast );
    AppState.timers.toast = setTimeout( () => {
        toast.classList.remove( 'visible' );
    }, 2000 );
}

function setupScrollToasts() {
    const feed = document.getElementById( 'main-feed' );
    let lastScrollTop = feed.scrollTop;
    feed.addEventListener( 'scroll', () => {
        const st = feed.scrollTop;
        const h = feed.clientHeight;
        const sh = feed.scrollHeight;
        if ( st <= 5 && st < lastScrollTop ) showToast( AppState.config.texts.bar_top_page );
        else if ( st + h >= sh - 5 && st > lastScrollTop ) showToast( AppState.config.texts.bar_bottom_page );
        lastScrollTop = st <= 0 ? 0 : st;
    } );
}

function navigateScroll( direction ) {
    const sections     = Array.from( document.querySelectorAll( '.section-snap' ) ).filter( el => el.offsetParent !== null );
    const currentIndex = sections.findIndex( sec => sec.classList.contains( 'active' ) );

    if ( currentIndex === -1 ) return;
    let nextIndex = direction === 'down' ? currentIndex + 1 : currentIndex - 1;

    if ( nextIndex >= 0 && nextIndex < sections.length ) {
        const target = sections[ nextIndex ];
        if ( target.hasAttribute( 'data-id' ) ) {
            const id = Number( target.dataset.id );
            VideoManager.scrollTo( id );
        } else {
            VideoManager.pauseAll( null );
            AppState.state.isMenuNavigation = true;
            target.scrollIntoView( {
                behavior: 'smooth'
            } );
            setTimeout( () => {
                AppState.state.isMenuNavigation = false;
            }, 1200 );
        }
    }
}

function updateNavButtons() {
    const sections     = Array.from( document.querySelectorAll( '.section-snap' ) ).filter( el => el.offsetParent !== null );
    const currentIndex = sections.findIndex( sec => sec.classList.contains( 'active' ) );
    const btnTop       = document.getElementById( 'btn-nav-top' );
    const btnUp        = document.getElementById( 'btn-nav-up' );
    const btnDown      = document.getElementById( 'btn-nav-down' );
    const btnBottom    = document.getElementById( 'btn-nav-bottom' );
    if ( currentIndex <= 0 ) {
        btnTop.classList.add( 'disabled' );
        btnUp.classList.add( 'disabled' );
    } else {
        btnTop.classList.remove( 'disabled' );
        btnUp.classList.remove( 'disabled' );
    }
    if ( currentIndex >= sections.length - 1 ) {
        btnDown.classList.add( 'disabled' );
        btnBottom.classList.add( 'disabled' );
    } else {
        btnDown.classList.remove( 'disabled' );
        btnBottom.classList.remove( 'disabled' );
    }
}

function updateActionButtons( id ) {
    const heartBtn = document.getElementById( 'dynamic-heart' );
    const icon = heartBtn.querySelector( '.material-icons:not(.btn-bg)' );
    const bg = heartBtn.querySelector( '.btn-bg' );
    if ( id === null || isNaN( id ) ) {
        heartBtn.classList.add( 'disabled' );
        bg.classList.remove( 'bright' );
    } else {
        heartBtn.classList.remove( 'disabled' );
        if ( AppState.favorites.includes( id ) ) {
            icon.innerHTML = 'favorite';
            bg.classList.add( 'bright' );
            icon.style.color = 'var(--primary-color)';
        } else {
            icon.innerHTML = 'favorite_border';
            bg.classList.remove( 'bright' );
            icon.style.color = 'white';
        }
    }
}

function filterByTag( tagSlug, event ) {
    if ( event ) event.stopPropagation();
    exitFavoritesMode();
    AppState.state.currentTagFilter = tagSlug;
    document.body.classList.add( 'tag-filtering' );
    document.getElementById( 'tag-mode-bar' ).classList.add( 'active' );

    // Find the original name for this slug to display
    let tagName = tagSlug;
    for (const group of AppState.data) {
        if (group.event_tags) {
            const found = group.event_tags.find(t => slugify(t) === tagSlug);
            if (found) {
                tagName = found;
                break;
            }
        }
    }
    document.getElementById( 'active-tag-name' ).innerText = tagName;

    document.querySelectorAll( '.video-card' ).forEach( card => {
        const id = Number( card.dataset.id );
        const group = AppState.data.find( g => g.id === id );
        if ( group && group.event_tags && group.event_tags.some(t => slugify(t) === tagSlug) ) card.classList.add( 'has-matching-tag' );
        else card.classList.remove( 'has-matching-tag' );
    } );
    document.getElementById( 'fav-filter-info' ).innerText  = `(${tagName})`;
    document.getElementById( 'time-filter-info' ).innerText = `(${tagName})`;
    renderTimeline();
    renderFavorites();
    updateURLState();
    const firstMatch = document.querySelector( '.video-card.has-matching-tag' );
    if ( firstMatch ) firstMatch.scrollIntoView( {
        behavior: 'smooth'
    } );
}

function clearTagFilter() {
    if ( !AppState.state.currentTagFilter ) return;
    AppState.state.currentTagFilter = null;
    document.body.classList.remove( 'tag-filtering' );
    document.getElementById( 'tag-mode-bar' ).classList.remove( 'active' );
    document.getElementById( 'fav-filter-info' ).innerText  = '';
    document.getElementById( 'time-filter-info' ).innerText = '';
    renderTimeline();
    renderFavorites();
    updateURLState();
    updateActionButtons( AppState.state.activeId );
    updateNavButtons();
}

function updateURLState() {
    const url = new URL( window.location );

    url.searchParams.delete( 'id' );
    url.searchParams.delete( 'filter' );
    url.searchParams.delete( 'favorites' );
    url.searchParams.delete( 'share' );

    if ( AppState.currentLang && AppState.currentLang !== 'fr' ) {
        url.searchParams.set( 'lang', AppState.currentLang );
    } else {
        url.searchParams.delete( 'lang' );
    }

    if ( AppState.state.isPlayingFavorites && AppState.favorites.length > 0 ) {
        url.searchParams.set( 'favorites', AppState.favorites.join( ',' ) );
    } else if ( AppState.state.currentTagFilter ) {
        url.searchParams.set( 'filter', AppState.state.currentTagFilter );
    } else if ( AppState.state.activeId !== null && !isNaN( AppState.state.activeId ) ) {
        url.searchParams.set( 'id', AppState.state.activeId );
    }

    window.history.replaceState( null, '', url );
}

function startAutoCloseTimer() {
    clearTimeout( AppState.timers.close );
    AppState.timers.close = setTimeout( () => {
        const drawer = document.getElementById( 'combined-drawer' );
        if ( drawer.classList.contains( 'active' ) ) closeAllDrawers();
    }, 1000 );
}

function setupDrawerListeners() {
    const drawer = document.getElementById( 'combined-drawer' );
    if(!drawer) return;
    const stop = () => clearTimeout( AppState.timers.close );
    drawer.addEventListener( 'touchstart', stop );
    drawer.addEventListener( 'mouseenter', stop );
    drawer.addEventListener( 'click', stop );
}

function toggleCombinedDrawer(tabName) {
    const drawer = document.getElementById('combined-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const isActive = drawer.classList.contains('active');

    // If already open
    if (isActive) {
        // If same tab, close it (toggle)
        if (AppState.state.activeTab === tabName) {
            closeAllDrawers();
        } else {
            // Switch tab
            switchTab(tabName);
        }
    } else {
        // Open drawer and select tab
        switchTab(tabName);
        drawer.classList.add('active');
        overlay.classList.add('active');
    }

    // Update button icon state
    const btnFloat = document.getElementById('btn-float');
    const icon = btnFloat.querySelector('.material-icons:not(.btn-bg)');

    if (drawer.classList.contains('active') && AppState.state.activeTab === 'favorites') {
        icon.textContent = 'chevron_right';
    } else {
        icon.textContent = 'bookmarks';
        updateFavoritesIcon();
    }
}

function switchTab(tabName) {
    AppState.state.activeTab = tabName;

    // Update Tab Buttons
    document.querySelectorAll('.drawer-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update Content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const activeContent = document.getElementById(`${tabName}-content`);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // Update floating button icon if switching tabs while open
    const drawer = document.getElementById('combined-drawer');
    if (drawer.classList.contains('active')) {
         const btnFloat = document.getElementById('btn-float');
         const icon = btnFloat.querySelector('.material-icons:not(.btn-bg)');
         if (tabName === 'favorites') {
             icon.textContent = 'chevron_right';
         } else {
             icon.textContent = 'bookmarks';
             updateFavoritesIcon();
         }
    }
}


function closeAllDrawers() {
    document.querySelectorAll( '.drawer-right' ).forEach( el => el.classList.remove( 'active' ) );
    document.getElementById( 'drawer-overlay' ).classList.remove( 'active' );

    const btnFloat   = document.getElementById( 'btn-float' );
    const icon       = btnFloat.querySelector( '.material-icons:not(.btn-bg)' );
    icon.textContent = 'bookmarks';
    updateFavoritesIcon();
}

function closeDrawerIfOpen() {
    const drawer = document.getElementById( 'combined-drawer' );
    if ( drawer.classList.contains( 'active' ) ) {
        closeAllDrawers();
        return true;
    }
    return false;
}

function toggleText( el, event ) {
    event.stopPropagation();
    if ( closeDrawerIfOpen() ) return;
    el.classList.toggle( 'expanded' );
}

function scrollToTop() {
    document.getElementById( 'main-feed' ).scrollTo( {
        top: 0,
        behavior: 'smooth'
    } );
}

function scrollToTicketing() {
    const ticketSection = document.getElementById( 'ticketing-section' );
    if ( ticketSection ) ticketSection.scrollIntoView( {
        behavior: 'smooth'
    } );
}

function setupHapticFeedback() {
    const buttons = document.querySelectorAll( '.btn-fav-float, .btn-drawer-action, .btn-program, .btn-ticket, .intro-btn, .ticket-btn' );
    buttons.forEach( btn => {
        btn.addEventListener( 'touchstart', () => triggerHaptic( btn ), {
            passive: true
        } );
        btn.addEventListener( 'mousedown', () => triggerHaptic( btn ) );
    } );
}

function triggerHaptic( el ) {
    const target = el.tagName === 'BUTTON' || el.tagName === 'A' ? el : el.closest( 'button, a' );
    if ( !target ) return;
    target.classList.add( 'visual-haptic' );
    setTimeout( () => {
        target.classList.remove( 'visual-haptic' );
    }, 250 );
}

function updateFavoritesIcon() {
    const btn = document.getElementById( 'btn-float' );
    const icon = btn.querySelector( '.material-icons:not(.btn-bg)' );
    const bg = btn.querySelector( '.btn-bg' );
    if ( AppState.favorites.length > 0 ) {
        bg.classList.add( 'bright' );
        icon.style.color = 'var(--primary-color)';
    } else {
        bg.classList.remove( 'bright' );
        icon.style.color = 'white';
    }
}

function toggleDescription( element, event ) {
    if ( event ) event.stopPropagation();
    element.classList.add( 'manual-toggle' );
    element.classList.toggle( 'expanded' );
    setTimeout( () => {
        element.classList.remove( 'manual-toggle' );
    }, 50 );
}

function handleOrientationChange() {
    const s         = AppState.settings;
    const topDrawer = document.getElementById( 'top-drawer' );
    const tm        = AppState.timers;

    // Only relevant if a video is playing
    if ( AppState.state.activeId === null ) return;
    const player = VideoManager.instances[AppState.state.activeId];

    // Check player state safely
    let isPlaying = false;
    if (player && typeof player.getPlayerState === 'function') {
        isPlaying = (player.getPlayerState() === 1);
    }

    if(!isPlaying) return;

    // We are playing. Check logic.
    if ( s.isMenuAutoHide || isLandscape() ) {
        // Should be auto-hidden.
        // If it's not already scheduled to hide and not hidden, schedule it.
        if ( !topDrawer.classList.contains('auto-hidden') && !tm.menu ) {
             tm.menu = setTimeout( () => {
                topDrawer.classList.add( 'auto-hidden' );
            }, 3000 );
        }
    } else {
        // Should stay visible (Portrait + config=false)
        clearTimeout( tm.menu );
        tm.menu = null;
        topDrawer.classList.remove( 'auto-hidden' );
    }
}

const PWAManager = {
    deferredPrompt: null,
    init: function() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.checkAndShow();
        });

        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            localStorage.setItem('app_install_seen', 'true');
            console.log('PWA was installed');
        });

        // Setup buttons
        const btnInstall = document.getElementById('btn-pwa-install');
        const btnLater = document.getElementById('btn-pwa-later');
        if(btnInstall) btnInstall.addEventListener('click', () => this.install());
        if(btnLater) btnLater.addEventListener('click', () => this.dismiss());
    },
    checkAndShow: function() {
        const seen = localStorage.getItem('app_install_seen');
        if (!seen) {
            setTimeout(() => {
                this.showModal();
            }, 2000);
        }
    },
    showModal: function() {
        const modal = document.getElementById('install-modal');
        if (modal) {
            // Update texts
            const t = AppState.config.texts;
            if(t) {
                if(t.install_modal_title) document.getElementById('pwa-title').innerText = t.install_modal_title;
                if(t.install_modal_text) document.getElementById('pwa-text').innerText = t.install_modal_text;
                if(t.install_modal_btn_yes) document.getElementById('btn-pwa-install').innerText = t.install_modal_btn_yes;
                if(t.install_modal_btn_no) document.getElementById('btn-pwa-later').innerText = t.install_modal_btn_no;
            }
            modal.classList.add('active');
        }
    },
    dismiss: function() {
        const modal = document.getElementById('install-modal');
        if (modal) modal.classList.remove('active');
        localStorage.setItem('app_install_seen', 'true');
    },
    install: async function() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            this.deferredPrompt = null;
        }
        this.dismiss();
    }
};

window.onload = init;
if ( 'serviceWorker' in navigator ) {
    navigator.serviceWorker.register( 'service-worker.js?v=1.05' )
        .then( ( reg ) => console.log( 'Service Worker enregistré', reg ) )
        .catch( ( err ) => console.log( 'Erreur Service Worker', err ) );
}