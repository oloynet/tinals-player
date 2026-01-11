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
        debugJS: false,
        displayVersion: false,
        versionNumber: "",
        menuAutoHide: false,
        displayControlBar: true,
        soundEnabled: true,
        navTopBottom: false,
        navPrevNext: true,
        fullscreen: false,
        displayDay: true,
        displayDate: true,
        displayTime: true,
        displayYear: false,
        displayTag: true,
        displayPlace: true,
        displayRecordName: false,
        displayDescription: true,
        descAutoHide: true,
        imgVideoPause: true,
        imgVideoEnd: true,
        autoLoad: false,
        autoPlayNext: true,
        autoPlayLoop: true
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

async function init() {
    try {
        const urlParams = new URLSearchParams( window.location.search );
        AppState.currentLang = urlParams.get( 'lang' ) || 'fr';
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

        if ( AppState.settings.debugJS ) {
            console.log( "--- DEBUG MODE ACTIVATED ---" );
            attachDebugWrappers( VideoManager, "VideoManager" );
            attachDebugWrappers( ControlBar,   "ControlBar" );
        }

        const dataSource = (AppState.config.site && AppState.config.site.data_source) ? AppState.config.site.data_source : 'data.json';
        const response = await fetch( dataSource );
        if ( !response.ok ) throw new Error( "Erreur " + dataSource );

        const rawData = await response.json();

        // VALIDATION
        AppState.data = rawData.filter( item => {
            const hasName = item.group_name && item.group_name.trim() !== "";
            const hasImage = item.image && item.image.trim() !== "";
            const hasDesc = item.description && item.description.trim() !== "";

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
        const currentParam = urlParams.get( 'current' );

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
        } else if ( currentParam && validIds.includes( Number( currentParam ) ) ) {
            AppState.state.activeId = Number( currentParam );
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

        const loader = document.getElementById( 'loader' );
        if ( loader ) loader.classList.add( 'hidden' );

    } catch ( e ) {
        console.error( "Erreur d'initialisation :", e );
        const loader = document.getElementById( 'loader' );
        if ( loader ) loader.innerHTML = "<p style='color:white; text-align:center;'>Erreur de chargement.<br>Vérifiez la console.</p>";
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
        document.documentElement.style.setProperty( '--primary-blue', c.site.theme_color );
        document.documentElement.style.setProperty( '--festival-color', c.site.theme_color );
        document.querySelector( 'meta[name="theme-color"]' ).setAttribute( 'content', c.site.theme_color );
    }
    const f = c.features || {};
    const s = AppState.settings;
    s.fullscreen         = f.is_fullscreen_enable         ?? false;
    s.soundEnabled       = f.is_button_sound_enable       ?? true;
    s.navTopBottom       = f.is_button_top_bottom_enable  ?? false;
    s.navPrevNext        = f.is_button_prev_next_enable   ?? true;
    s.menuAutoHide       = f.is_menu_auto_hide            ?? false;
    s.displayDay         = f.is_display_day               ?? true;
    s.displayDate        = f.is_display_date              ?? false;
    s.displayTime        = f.is_display_time              ?? false;
    s.displayTag         = f.is_display_tag               ?? false;
    s.displayPlace       = f.is_display_place             ?? false;
    s.displayRecordName  = f.is_display_record_name       ?? false;
    s.displayDescription = f.is_display_group_description ?? true;
    s.descAutoHide       = f.is_description_auto_hide     ?? true;
    s.imgVideoEnd        = f.is_display_image_video_end   ?? true;
    s.imgVideoPause      = f.is_display_image_video_pause ?? true;
    s.displayYear        = f.is_display_year              ?? false;
    s.displayControlBar  = f.is_display_control_bar       ?? false;
    s.debugJS            = f.is_debug_js                  ?? false;
    s.isDisplayVersion   = f.is_display_version           ?? false;
    s.versionNumber      = c.site.version || "";
    s.autoLoad           = f.is_auto_load_video           ?? false;
    s.autoPlayNext       = f.is_auto_play_next            ?? true;
    s.autoPlayLoop       = f.is_auto_play_loop            ?? true;

    if ( s.descAutoHide ) document.body.classList.add( 'hide-desc-mobile' );
    else document.body.classList.remove( 'hide-desc-mobile' );

    if ( !s.soundEnabled ) document.getElementById( 'btn-mute' ).style.display = 'none';
    if ( !s.navTopBottom ) {
        document.getElementById( 'btn-nav-top' ).style.display    = 'none';
        document.getElementById( 'btn-nav-bottom' ).style.display = 'none';
    }
    if ( !s.navPrevNext ) {
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

    //onsole.log( 's.isDisplayVersion = ' + s.isDisplayVersion );
    console.log( 's.versionNumber = ' + s.versionNumber );

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
                scripts: ["service-worker.js", "assets/js/app.js"],
                service_worker: "service-worker.js"
            },


            icons: [
                // {
                //     src: c.images.icon_svg,
                //     sizes: "512x512",
                //     type: "image/svg+xml",
                //     purpose: "any"
                // },
                {
                    src: c.images.icon_512,
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: c.images.icon_192,
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: c.images.apple_touch_icon,
                    sizes: "180x180",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: c.images.icon,
                    sizes: "48x48",
                    type: "image/vnd.microsoft.icon",
                    purpose: "any"
                },
                {
                    src: c.images.icon_32,
                    sizes: "32x32",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: c.images.icon_16,
                    sizes: "16x16",
                    type: "image/png",
                    purpose: "any"
                }
            ]
        };
        const blob = new Blob( [ JSON.stringify( manifest ) ], {
            type: 'application/json'
        } );

        console.log( window.location.origin + window.location.pathname );


        // DESACTIVATE document.querySelector( 'link[rel="manifest"]' ).href = URL.createObjectURL( blob );
    }
}

// ... [Reste des fonctions inchangées : toggleLanguage, translateText, getSvgHtml, formatDate, updateStaticTexts, renderFeed, getIntroHtml,getVideoCardHtml, getTicketingHtml, renderFavorites, renderTimeline, ControlBar, VideoManager, etc.] ...

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
    const yearDisplay = AppState.settings.displayYear ? ` ${yearShort}` : '';
    if ( AppState.currentLang === 'en' ) {
        const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
        const suffix = AppState.settings.displayYear ? `, ${yearShort}` : '';
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
    document.getElementById( 'tag-mode-bar' ).innerHTML      = `${t.filter_cancel_tags} <span id="active-tag-name" style="margin-left: 5px; color: white;"></span> <button class="close-fav-mode"><span class="material-icons">close</span></button>`;
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
                ${logoHtml}
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
        { key: 'performer_youtube_channel', label: 'YouTube' }
    ];

    const links = networks.filter(n => g[n.key]).map(n => {
        return `<a href="${g[n.key]}" target="_blank" class="social-link">${n.label}</a>`;
    });

    if (links.length === 0) return '';
    return `<div class="social-links" style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">${links.join('')}</div>`;
}

function getVideoCardHtml( g ) {
    const s = AppState.settings;
    const tagsHtml = ( s.displayTag && g.tags ) ? `<div class="tags-container">${g.tags.map(t => `<span class="tag-pill" onclick="filterByTag('${t}', event)">${translateText(t, 'tags')}</span>`).join('')}</div>` : '';
    const songTitleOverlay = ( s.displayRecordName && g.title ) ? `<h3 class="song-title-overlay">"${g.title}"</h3>` : '';
    const songTitleCenter = ( s.displayRecordName && g.title ) ? `<h3>"${g.title}"</h3>` : '';
    const dayName = ( s.displayDay && g.event_day ) ? translateText( g.event_day, 'days' ).toUpperCase() : '';
    const dateRaw = ( s.displayDate && g.event_date ) ? formatDate( g.event_date ) : '';
    let timeString = '';
    if ( s.displayTime ) {
        timeString = g.event_time || '';
        if ( timeString && g.event_endtime ) timeString += ` - ${g.event_endtime}`;
    }
    const placeName = ( s.displayPlace && g.event_place ) ? g.event_place : '';
    const overlayDetails = [ placeName, dayName, dateRaw, timeString ].filter( Boolean ).join( ' • ' );
    let splashHtml = '';
    if ( s.displayPlace && g.event_place ) splashHtml += `<span class="splash-meta-place">${g.event_place}</span>`;
    let dateTimeParts = [];
    if ( dayName ) dateTimeParts.push( dayName );
    if ( dateRaw ) dateTimeParts.push( dateRaw );
    let dateTimeStr = dateTimeParts.join( ' ' );
    if ( dateTimeStr && timeString ) dateTimeStr += ' • ' + timeString;
    else if ( !dateTimeStr && timeString ) dateTimeStr = timeString;
    if ( dateTimeStr ) splashHtml += `<span class="splash-meta-date">${dateTimeStr}</span>`;
    const splashMetaHtml = splashHtml ? `<div class="splash-meta">${splashHtml}</div>` : '';

    const descriptionText = ( AppState.currentLang === 'en' && g.descriptionEN ) ? g.descriptionEN : g.description;
    const descHtml = ( s.displayDescription && descriptionText ) ? `<div class="description" onclick="toggleDescription(this, event)">${descriptionText}</div>` : '';

    const socialsHtml = getSocialsHtml(g);

    const avatarHtml = `
        <div class="group-avatar-container" onclick="toggleDescription(this.parentNode.querySelector('.description'), event)">
            <img src="${g.image}" class="group-avatar" alt="${g.group_name}">
        </div>`;

    const isMobile = isMobileDevice();
    const bgImage = ( isMobile && g.image_mobile ) ? g.image_mobile : g.image;

    return `
    <section class="video-card section-snap ${AppState.favorites.includes(g.id) ? 'is-favorite' : ''}" id="video-${g.id}" data-id="${g.id}">
        <div class="video-container">
            <div class="group-title-center">
                <h2>${g.group_name}</h2>
                ${songTitleCenter}
                ${splashMetaHtml}
            </div>
            <div class="video-background" style="background-image: url('${bgImage}');"></div>
            <div id="player-${g.id}" class="yt-placeholder"></div>
        </div>
        <div class="video-overlay">
            <div class="group-info">
                ${avatarHtml}
                <h2>${g.group_name}</h2>
                ${songTitleOverlay}
                ${tagsHtml}
                ${descHtml}
                ${socialsHtml}
                <div class="event-details">${overlayDetails}</div>
            </div>
        </div>
    </section>`;
}

function getTicketingHtml() {
    const t = AppState.config.texts;
    return `
        <section class="ticketing-card section-snap" id="ticketing-section">
            <div class="ticket-container">
                <div class="ticket-block" style="background-color: #fd3d00;">
                    <h2>${t.ticket_all_days_title}</h2>
                    <h3>${t.ticket_all_days_subtitle}</h3>
                    <a href="https://billetterie.paloma-nimes.fr/agenda/747-Pass-2-jours-This-Is-Not-A-Love-Song?session=747" target="_blank" class="ticket-btn" style="color: #fd3d00;">${t.ticket_all_days_button}</a>
                </div>
                <div class="ticket-block" style="background-color: #35bb05;">
                    <h2>${t.ticket_day_1_title}</h2>
                    <h3>${t.ticket_day_1_subtitle}</h3>
                    <a href="https://billetterie.paloma-nimes.fr/agenda/748-Pass-1-jour-vendredi-This-Is-Not-A-Love-Song?session=748" target="_blank" class="ticket-btn" style="color: #35bb05;">${t.ticket_day_1_button}</a>
                </div>
                <div class="ticket-block" style="background-color: #0500ff;">
                    <h2>${t.ticket_day_2_title}</h2>
                    <h3>${t.ticket_day_2_subtitle}</h3>
                    <a href="https://billetterie.paloma-nimes.fr/agenda/749-Pass-1-jour-samedi-This-Is-Not-A-Love-Song?session=749" target="_blank" class="ticket-btn" style="color: #0500ff;">${t.ticket_day_2_button}</a>
                </div>
            </div>
        </section>`;
}

function renderFavorites() {
    const list = document.getElementById( 'favorites-list' );
    let favs = AppState.data.filter( g => AppState.favorites.includes( g.id ) );
    if ( AppState.state.currentTagFilter ) {
        favs = favs.filter( g => g.tags && g.tags.includes( AppState.state.currentTagFilter ) );
    }
    list.innerHTML = favs.length ? favs.map( g => {
        const thumb = g.image_thumbnail || g.image;
        return `
        <div class="favorite-item">
            <img src="${thumb}">
            <div class="fav-title">${g.group_name}</div>
            <button onclick="shareSong(${g.id})" class="material-icons" style="background:none; border:none; cursor:pointer; margin-right:5px; opacity:0.7;">share</button>
            <button onclick="VideoManager.scrollTo(${g.id})" class="material-icons" style="background:none; border:none; cursor:pointer;">play_arrow</button>
            <button onclick="toggleFav(${g.id})" class="material-icons" style="opacity:0.3; background:none; border:none; cursor:pointer;">close</button>
        </div>
    ` }).join( '' ) : `<p style="padding:40px; text-align:center; opacity:0.5;">${AppState.config.texts.fav_empty}</p>`;
    const footer = document.getElementById( 'favorites-footer' );
    if ( favs.length > 0 ) footer.classList.add( 'visible' );
    else footer.classList.remove( 'visible' );
}

function renderTimeline() {
    const list = document.getElementById( 'timeline-list' );
    const s = AppState.settings;
    let dataToRender = AppState.data;
    if ( AppState.state.currentTagFilter ) {
        dataToRender = AppState.data.filter( g => g.tags && g.tags.includes( AppState.state.currentTagFilter ) );
    }
    const sortedData = [ ...dataToRender ].sort( ( a, b ) => {
        const tA = ( a.event_date || '9999-99-99' ) + 'T' + ( a.event_time || '00:00' );
        const tB = ( b.event_date || '9999-99-99' ) + 'T' + ( b.event_time || '00:00' );
        return tA.localeCompare( tB );
    } );
    if ( sortedData.length === 0 ) {
        list.innerHTML = `<p style="padding:20px; text-align:center; opacity:0.6;">${AppState.config.texts.timeline_empty}</p>`;
        return;
    }
    list.innerHTML = sortedData.map( g => {
        const dayName = ( s.displayDay && g.event_day ) ? translateText( g.event_day, 'days' ).toUpperCase() : '';
        const dateRaw = ( s.displayDate && g.event_date ) ? formatDate( g.event_date ) : '';
        let timeString = '';
        if ( s.displayTime ) {
            timeString = g.event_time || '';
            if ( timeString && g.event_endtime ) timeString += ` - ${g.event_endtime}`;
        }
        const placeName = ( s.displayPlace && g.event_place ) ? g.event_place : '';
        const metaLine = [ dayName, dateRaw, timeString, placeName ].filter( Boolean ).join( ' • ' );
        const tagsHtml = ( s.displayTag && g.tags ) ? g.tags.map( t => `<span class="time-tag" onclick="filterByTag('${t}', event)">${translateText(t, 'tags')}</span>` ).join( '' ) : '';
        const isFav = AppState.favorites.includes( g.id );
        const thumb = g.image_thumbnail || g.image;
        return `
        <div class="timeline-item" onclick="VideoManager.scrollTo(${g.id})">
            <img src="${thumb}" class="time-thumb" loading="lazy">
            <div class="time-info">
                <div class="time-row-1">
                    <h3>${g.group_name}</h3>
                    <button class="time-btn-fav material-icons ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFav(${g.id});">${isFav ? 'favorite' : 'favorite_border'}</button>
                </div>
                <div class="time-row-2">${metaLine}</div>
                <div class="time-row-3">${tagsHtml}</div>
            </div>
        </div>`;
    } ).join( '' );
}


// --- GESTION CONTROL BAR ---
const ControlBar = {
    interval: null,
    isDragging: false,

    startTracking: function ( id ) {
        this.stopTracking();

        if ( AppState.settings.displayControlBar ) {
            document.getElementById( 'control-bar' ).classList.add( 'visible' );
            this.syncUI( id );
        }

        this.updatePlayPauseIcon( true );

        this.interval = setInterval( () => {
            if ( this.isDragging ) return;
            const player = VideoManager.instances[ id ];

            if ( player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function' ) {
                if ( typeof player.getPlayerState === 'function' && player.getPlayerState() !== 1 ) {
                    return;
                }
                const current = player.getCurrentTime();
                const duration = player.getDuration();
                this.updateUI( current, duration );
            }
        }, 200 );
    },

    syncUI: function ( id ) {
        this.resetUI();
        let player = VideoManager.instances[ id ];

        if ( !player ) {
            VideoManager.create( id, false );
            return;
        }

        if ( typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function' ) {
            const current = player.getCurrentTime();
            const duration = player.getDuration();

            if ( duration > 0 ) {
                this.updateUI( current, duration );
            }

            if ( typeof player.getPlayerState === 'function' ) {
                const state = player.getPlayerState();
                this.updatePlayPauseIcon( state === 1 );
            }
        }
    },

    updateUI: function ( current, duration ) {
        if ( duration > 0 ) {
            const pct = ( current / duration ) * 100;
            document.getElementById( 'cb-slider' ).value = pct;
            document.getElementById( 'cb-current-time' ).innerText = this.formatTime( current );
            document.getElementById( 'cb-duration' ).innerText = this.formatTime( duration );
        }
    },

    resetUI: function () {
        document.getElementById( 'cb-slider' ).value = 0;
        document.getElementById( 'cb-current-time' ).innerText = "0:00";
        document.getElementById( 'cb-duration' ).innerText = "0:00";
    },

    stopTracking: function () {
        if ( this.interval ) clearInterval( this.interval );
        this.updatePlayPauseIcon( false );
    },

    togglePlay: function () {
        if ( AppState.state.activeId !== null ) {
            VideoManager.togglePlayPause( AppState.state.activeId );
        }
    },

    updatePlayPauseIcon: function ( isPlaying ) {
        const icon = document.querySelector( '#cb-play-pause .material-icons' );
        if ( icon ) icon.innerText = isPlaying ? 'pause' : 'play_arrow';
    },

    onSeekInput: function () {
        this.isDragging = true;
    },

    onSeekChange: function () {
        const val = document.getElementById( 'cb-slider' ).value;
        const id = AppState.state.activeId;
        const player = VideoManager.instances[ id ];
        if ( player && typeof player.getDuration === 'function' && typeof player.seekTo === 'function' ) {
            const duration = player.getDuration();
            const time = ( val / 100 ) * duration;
            player.seekTo( time, true );
        }
        this.isDragging = false;
    },

    formatTime: function ( seconds ) {
        const m = Math.floor( seconds / 60 );
        const s = Math.floor( seconds % 60 );
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
};


function parseYoutubeData(url) {
    let videoId = '';
    let startSeconds = 0;

    try {
        const urlObj = new URL(url);

        // Récupération ID
        if (urlObj.hostname.includes('youtu.be')) {
            videoId = urlObj.pathname.slice(1);
        } else {
            videoId = urlObj.searchParams.get('v');
        }

        // Récupération Temps (t)
        const t = urlObj.searchParams.get('t');
        if (t) {
            // Convertit "30s" ou "30" en entier
            startSeconds = parseInt(t.replace('s', ''), 10);
        }
    } catch (e) {
        console.warn("URL YouTube invalide ou format non géré", url);
    }

    return { id: videoId, start: startSeconds };
}


const VideoManager = {
    instances: {},
    create: function ( id, isAutoPlay = true ) {
        if ( this.instances[ id ] ) {
            if ( isAutoPlay && typeof this.instances[ id ].playVideo === 'function' ) {
                if ( AppState.state.isGlobalMuted ) this.instances[ id ].mute();
                else this.instances[ id ].unMute();
                this.instances[ id ].playVideo();
            }
            return;
        }
        const card = document.getElementById( `video-${id}` );
        const group = AppState.data.find( g => g.id == id );
        if ( !group ) return;

        const ytData = parseYoutubeData(group.youtube);
        let videoId      = ytData.id
        let startSeconds = ytData.start

        if (startSeconds === undefined) {
            startSeconds = 0;
        }

        //console.log( 'group.youtube = ' + group.youtube );
        //console.log( 'videoId       = ' + videoId );
        //console.log( 'startSeconds  = ' + startSeconds );

        if ( !videoId ) return;
        const ampersandPosition = videoId.indexOf( '&' );
        if ( ampersandPosition != -1 ) videoId = videoId.substring( 0, ampersandPosition );
        if ( isAutoPlay ) this.pauseAll( id );
        this.instances[ id ] = new YT.Player( `player-${id}`, {
            videoId: videoId,
            host: 'https://www.youtube-nocookie.com',
            playerVars: {
                'start': startSeconds,
                'autoplay': isAutoPlay ? 1 : 0,
                'controls': 0,
                'modestbranding': 1,
                'rel': 0,
                'origin': window.location.origin,
                'playsinline': 1
            },
            events: {
                'onReady': ( e ) => {
                    if ( AppState.state.isGlobalMuted ) e.target.mute();
                    else e.target.unMute();

                    if ( AppState.settings.displayControlBar && id === AppState.state.activeId ) {
                        ControlBar.syncUI( id );
                    }
                },
                'onStateChange': ( e ) => this.onStateChange( e, id, card ),
                'onError': ( e ) => {
                    console.log( "Erreur Youtube", e.data );
                }
            }
        } );
    },
    onStateChange: function ( e, id, card ) {
        const s = AppState.settings;
        const tm = AppState.timers;
        if ( e.data === 1 ) {
            card.classList.remove( 'ended' );
            card.classList.add( 'playing' );
            card.classList.remove( 'paused-manual' );

            if ( s.displayControlBar ) ControlBar.startTracking( id );

            clearTimeout( tm.menu );
            const topDrawer = document.getElementById( 'top-drawer' );
            topDrawer.classList.remove( 'auto-hidden' );
            topDrawer.style.transform = '';
            if ( s.menuAutoHide ) {
                tm.menu = setTimeout( () => {
                    topDrawer.classList.add( 'auto-hidden' );
                }, 3000 );
            }
            if ( s.autoLoad ) this.preloadNext( id );
        } else if ( e.data === 2 || e.data === 0 ) {
            clearTimeout( tm.menu );
            document.getElementById( 'top-drawer' ).classList.remove( 'auto-hidden' );

            ControlBar.updatePlayPauseIcon( false );

            if ( e.data === 2 ) {
                if ( s.imgVideoPause ) card.classList.remove( 'playing' );
                else card.classList.add( 'playing' );
            } else {
                ControlBar.stopTracking();
                card.classList.remove( 'playing' );
            }

            card.classList.add( 'paused-manual' );

            if ( e.data === 0 ) {
                if ( s.imgVideoEnd ) card.classList.add( 'ended' );
                this.goToNext( id );
            }
        }
    },
    play: function ( id ) {
        this.pauseAll( id );
        if ( !this.instances[ id ] ) this.create( id );
        else {
            if ( typeof this.instances[ id ].playVideo === 'function' ) {
                if ( AppState.state.isGlobalMuted ) this.instances[ id ].mute();
                else this.instances[ id ].unMute();
                this.instances[ id ].playVideo();
            }
        }
    },
    pauseAll: function ( exceptId ) {
        Object.keys( this.instances ).forEach( key => {
            const p = this.instances[ key ];
            if ( p && typeof p.pauseVideo === 'function' && parseInt( key ) !== exceptId ) {
                p.pauseVideo();
            }
        } );
        ControlBar.stopTracking();
    },
    togglePlayPause: function ( id ) {
        if ( !this.instances[ id ] ) {
            this.play( id );
        } else {
            if ( typeof this.instances[ id ].getPlayerState === 'function' ) {
                const state = this.instances[ id ].getPlayerState();
                if ( state === 1 ) this.instances[ id ].pauseVideo();
                else {
                    this.pauseAll( id );
                    this.instances[ id ].playVideo();
                }
            }
        }
    },
    preloadNext: function ( currentId ) {
        if ( !AppState.settings.autoPlayNext ) return;
        const currentIndex = AppState.data.findIndex( g => g.id === currentId );
        if ( currentIndex === -1 || currentIndex >= AppState.data.length - 1 ) return;
    },
    goToNext: function ( currentId ) {
        const s = AppState.settings;
        if ( !s.autoPlayNext ) return;
        const favs = AppState.favorites;
        if ( AppState.state.isPlayingFavorites && favs.length > 0 ) {
            const currentFavIndex = favs.indexOf( currentId );
            let nextId;
            if ( currentFavIndex === -1 ) nextId = favs[ 0 ];
            else {
                if ( currentFavIndex >= favs.length - 1 && !s.autoPlayLoop ) return;
                const nextFavIndex = ( currentFavIndex + 1 ) % favs.length;
                nextId = favs[ nextFavIndex ];
            }
            AppState.state.isAutoNext = true;
            this.scrollTo( nextId );
            return;
        }
        const currentIndex = AppState.data.findIndex( g => g.id === currentId );
        if ( currentIndex >= AppState.data.length - 1 && !s.autoPlayLoop ) return;
        const nextIndex = ( currentIndex + 1 ) % AppState.data.length;
        const nextId = AppState.data[ nextIndex ].id;
        AppState.state.isAutoNext = true;
        const nextCard = document.getElementById( `video-${nextId}` );
        nextCard.scrollIntoView( {
            behavior: 'smooth'
        } );
    },
    scrollTo: function ( id, autoPlay = true ) {
        if ( autoPlay ) {
            this.pauseAll( id );
            this.play( id );
        } else {
            this.pauseAll( null );
            if ( !this.instances[ id ] ) this.create( id, false );
            if ( AppState.settings.displayControlBar ) {
                setTimeout( () => {
                    document.getElementById( 'control-bar' ).classList.add( 'visible' );
                    ControlBar.syncUI( id );
                }, 100 );
            }
        }
        closeAllDrawers();
        AppState.state.isMenuNavigation = true;
        setTimeout( () => {
            const el = document.getElementById( `video-${id}` );
            if ( el ) el.scrollIntoView( {
                behavior: 'auto',
                block: 'start'
            } );
        }, 100 );
        const lockTime = autoPlay ? 1200 : 500;
        setTimeout( () => {
            AppState.state.isMenuNavigation = false;
        }, lockTime );
    },
    toggleMute: function () {
        AppState.state.isGlobalMuted = !AppState.state.isGlobalMuted;
        const btn = document.getElementById( 'btn-mute' );
        const icon = btn.querySelector( '.material-icons:not(.btn-bg)' );
        if ( AppState.state.isGlobalMuted ) icon.textContent = 'volume_off';
        else icon.textContent = 'volume_up';
        Object.values( this.instances ).forEach( player => {
            if ( player && typeof player.mute === 'function' ) {
                if ( AppState.state.isGlobalMuted ) player.mute();
                else player.unMute();
            }
        } );
    },
    toggleFullscreen: function ( id ) {
        AppState.state.isMenuNavigation = true;
        const card = document.getElementById( `video-${id}` );
        if ( !document.fullscreenElement ) {
            card.requestFullscreen().catch( err => console.log( `Error fullscreen: ${err.message}` ) );
        } else {
            document.exitFullscreen();
        }
        setTimeout( () => {
            AppState.state.isMenuNavigation = false;
        }, 1000 );
    }
};

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

        const favDrawer = document.getElementById( 'favorites-drawer' );
        const timelineDrawer = document.getElementById( 'timeline-drawer' );

        if ( !favDrawer.classList.contains( 'active' ) &&
            !timelineDrawer.classList.contains( 'active' ) &&
            !AppState.state.isPlayingFavorites ) {

            toggleDrawer( 'favorites-drawer' );
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
        urlObj.searchParams.set( 'current', AppState.state.activeId );
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
    urlObj.searchParams.set( 'current', id );

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
    toggleDrawer( 'favorites-drawer' );

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

                    if ( AppState.settings.displayControlBar ) {
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

                    if ( AppState.settings.displayControlBar ) {
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
            const favDrawer = document.getElementById( 'favorites-drawer' );
            const timeDrawer = document.getElementById( 'timeline-drawer' );
            if ( favDrawer.classList.contains( 'active' ) ) toggleDrawer( 'favorites-drawer' );
            else if ( timeDrawer.classList.contains( 'active' ) ) toggleDrawer( 'timeline-drawer' );
            else toggleDrawer( 'favorites-drawer' );
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
            if ( AppState.settings.fullscreen && activeId ) VideoManager.toggleFullscreen( activeId );
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
    const sections = Array.from( document.querySelectorAll( '.section-snap' ) ).filter( el => el.offsetParent !== null );
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
    const sections = Array.from( document.querySelectorAll( '.section-snap' ) ).filter( el => el.offsetParent !== null );
    const currentIndex = sections.findIndex( sec => sec.classList.contains( 'active' ) );
    const btnTop = document.getElementById( 'btn-nav-top' );
    const btnUp = document.getElementById( 'btn-nav-up' );
    const btnDown = document.getElementById( 'btn-nav-down' );
    const btnBottom = document.getElementById( 'btn-nav-bottom' );
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
        icon.innerHTML = 'favorite_border';
        if ( AppState.favorites.includes( id ) ) {
            bg.classList.add( 'bright' );
            icon.style.color = 'var(--festival-color)';
        } else {
            bg.classList.remove( 'bright' );
            icon.style.color = 'white';
        }
    }
}

function filterByTag( tag, event ) {
    if ( event ) event.stopPropagation();
    exitFavoritesMode();
    AppState.state.currentTagFilter = tag;
    document.body.classList.add( 'tag-filtering' );
    document.getElementById( 'tag-mode-bar' ).classList.add( 'active' );
    document.getElementById( 'active-tag-name' ).innerText = tag;
    document.querySelectorAll( '.video-card' ).forEach( card => {
        const id = Number( card.dataset.id );
        const group = AppState.data.find( g => g.id === id );
        if ( group && group.tags && group.tags.includes( tag ) ) card.classList.add( 'has-matching-tag' );
        else card.classList.remove( 'has-matching-tag' );
    } );
    document.getElementById( 'fav-filter-info' ).innerText = `(${tag})`;
    document.getElementById( 'time-filter-info' ).innerText = `(${tag})`;
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
    document.getElementById( 'fav-filter-info' ).innerText = '';
    document.getElementById( 'time-filter-info' ).innerText = '';
    renderTimeline();
    renderFavorites();
    updateURLState();
    updateActionButtons( AppState.state.activeId );
    updateNavButtons();
}

function updateURLState() {
    const url = new URL( window.location );

    url.searchParams.delete( 'current' );
    url.searchParams.delete( 'filter' );
    url.searchParams.delete( 'favorites' );
    url.searchParams.delete( 'share' );
    url.searchParams.delete( 'favs' );

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
        url.searchParams.set( 'current', AppState.state.activeId );
    }

    window.history.replaceState( null, '', url );
}

function startAutoCloseTimer() {
    clearTimeout( AppState.timers.close );
    AppState.timers.close = setTimeout( () => {
        const drawer = document.getElementById( 'favorites-drawer' );
        if ( drawer.classList.contains( 'active' ) ) toggleDrawer( 'favorites-drawer' );
    }, 1000 );
}

function setupDrawerListeners() {
    [ 'favorites-drawer', 'timeline-drawer' ].forEach( id => {
        const drawer = document.getElementById( id );
        const stop = () => clearTimeout( AppState.timers.close );
        drawer.addEventListener( 'touchstart', stop );
        drawer.addEventListener( 'mouseenter', stop );
        drawer.addEventListener( 'click', stop );
    } );
}

function toggleDrawer( id, forceCloseOthers = false ) {
    const target = document.getElementById( id );
    const overlay = document.getElementById( 'drawer-overlay' );
    if ( forceCloseOthers ) document.querySelectorAll( '.drawer-right' ).forEach( el => {
        if ( el.id !== id ) el.classList.remove( 'active' );
    } );
    target.classList.toggle( 'active' );
    const anyActive = document.querySelectorAll( '.drawer-right.active' ).length > 0;
    if ( anyActive ) overlay.classList.add( 'active' );
    else overlay.classList.remove( 'active' );
    if ( id === 'favorites-drawer' ) {
        const btnFloat = document.getElementById( 'btn-float' );
        const icon = btnFloat.querySelector( '.material-icons:not(.btn-bg)' );
        if ( target.classList.contains( 'active' ) ) icon.textContent = 'chevron_right';
        else {
            icon.textContent = 'bookmarks';
            updateFavoritesIcon();
        }
    }
}

function closeAllDrawers() {
    document.querySelectorAll( '.drawer-right' ).forEach( el => el.classList.remove( 'active' ) );
    document.getElementById( 'drawer-overlay' ).classList.remove( 'active' );
    const btnFloat = document.getElementById( 'btn-float' );
    const icon = btnFloat.querySelector( '.material-icons:not(.btn-bg)' );
    icon.textContent = 'bookmarks';
}

function closeDrawerIfOpen() {
    const drawer = document.getElementById( 'favorites-drawer' );
    if ( drawer.classList.contains( 'active' ) ) {
        toggleDrawer( 'favorites-drawer' );
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
        icon.style.color = 'var(--festival-color)';
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

window.onload = init;
if ( 'serviceWorker' in navigator ) {
    navigator.serviceWorker.register( 'service-worker.js?v=1.0' )
        .then( ( reg ) => console.log( 'Service Worker enregistré', reg ) )
        .catch( ( err ) => console.log( 'Erreur Service Worker', err ) );
}