// --- CENTRALISATION DE L'ÉTAT (STATE MANAGEMENT) ---
const AppState = {
    config: null,
    data: [],
    players: {},
    favorites: [],
    currentLang: 'fr',
    state: {
        activeId: null,
        activeSection: null,
        previousId: null,
        isAutoNext: false,
        isMenuNavigation: false,
        isPlayingFavorites: false,
        currentTagFilter: null,
        isGlobalMuted: false,
        isMainMenuOpen: false,
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

        isDisplayDay: true,
        isDisplayDate: true,
        isDisplayTime: true,
        isDisplayYear: false,
        isDisplayTag: true,
        isDisplayPlace: true,

        isToastScrollFavorite: false,
        isToastScrollFilter: false,
        isToastScrollPage: false,

        isButtonSoundEnable: true,
        isButtonTopBottomEnable: false,
        isButtonPrevNextEnable: true,
        isFullscreenEnable: true,

        isMenuAutoHide: false,
        isDisplayControlBar: true,
        isDisplayRecordName: false,
        isDisplayGroupDescription: true,
        isDescriptionAutoHide: true,
        isDisplayImageVideoPause: true,
        isDisplayImageVideoEnd: true,
        isAutoLoadVideo: false,
        isAutoPlayNext: true,
        isAutoPlayLoop: true,
        isAppInstall: false,
        isForceZoom: false,
        isTicketingDisplayLike: false,
        isTicketingDisplayCount: false,
        isTicketingDisplayArtistsName: false,
        isDisplayBoxTitle: false,
        isDisplayArtist: true,
        isDisplayActionBar: true
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
    tags: {},
    sessions: {}
};


/* INIT */

async function init() {
    try {
        // --- START NEW LOGIC ---
        const rawParams = new URLSearchParams(window.location.search);
        const validParams = new URLSearchParams();
        const allowed = {
            'id': /^[0-9]+$/,
            'tag': /^[a-z0-9-]+$/,
            'filter': /^[a-z0-9-]+$/,
            'favorites': /^[0-9,]+$/,
            'lang': /^(fr|en)$/,
            'share': /^[a-z0-9-]+$/,
            'version': /^[a-z0-9.-]+$/,
            'play': /^[a-z0-9]*$/
        };

        for (const [key, value] of rawParams.entries()) {
            if (allowed[key] && allowed[key].test(value)) {
                validParams.append(key, value);
            }
        }

        // Handle Version
        if (validParams.has('version')) {
            validParams.delete('version');
            const newUrl = window.location.pathname + (validParams.toString() ? '?' + validParams.toString() : '') + window.location.hash;
            window.history.replaceState(null, '', newUrl);

            // Clear cache and reload
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) await registration.unregister();
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            }
            window.location.reload(true);
            return; // Stop execution
        }

        // Update URL if params were dirty (stripped)
        if (rawParams.toString() !== validParams.toString()) {
             const newUrl = window.location.pathname + (validParams.toString() ? '?' + validParams.toString() : '') + window.location.hash;
             window.history.replaceState(null, '', newUrl);
        }

        const urlParams = validParams;
        // --- END NEW LOGIC ---

        AppState.currentLang          = urlParams.get( 'lang' ) || 'fr';
        document.documentElement.lang = AppState.currentLang;

        const configFile = 'config/config.json?v1.59';
        const langConfigFile = AppState.currentLang === 'en' ? 'config/config_en.json?v1.59' : 'config/config_fr.json?v1.59';

        // 1. & 2. Charger les configs en parallèle
        const [mainConfigResponse, langConfigResponse] = await Promise.all([
            fetch(configFile),
            fetch(langConfigFile)
        ]);

        if ( !mainConfigResponse.ok ) throw new Error( "Erreur config " + configFile );
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

        checkVersion();

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
        }).map( item => {
            item.id = Number( item.id );
            return item;
        } );

        // --- SESSION PROCESSING ---
        if (AppState.config.sessions) {
            AppState.config.sessions.forEach(session => {
                if (session.display && session.display.compact) {
                    translations.sessions[session.id] = session.display.compact;
                    // Also handle slugified version just in case
                    translations.sessions[slugify(session.id)] = session.display.compact;
                }
            });
        }

        AppState.data.forEach(item => {
            if (item.event_session) {
                if (!item.event_tags) item.event_tags = [];
                const alreadyHas = item.event_tags.some(t => t === item.event_session);
                if (!alreadyHas) {
                    item.event_tags.unshift(item.event_session);
                }
            }
        });
        // -------------------------

        let storedFavs     = JSON.parse( localStorage.getItem( 'selected' ) ) || [];
        const validIds     = AppState.data.map( g => g.id );
        AppState.favorites = storedFavs.filter( id => validIds.includes( id ) );

        const filterParam  = urlParams.get( 'filter' );
        const favsParam    = urlParams.get( 'favorites' );
        const idParam      = urlParams.get( 'id' );
        const hash         = window.location.hash ? window.location.hash.substring(1) : null;

        renderFeed();
        renderDrawerFavorites();
        renderDrawerTimeline();

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
            updateSummaryPlayingState( AppState.state.activeId );
            setTimeout( () => {
                const target = document.getElementById( `video-${AppState.state.activeId}` );
                if ( target ) target.scrollIntoView( {
                    behavior: 'auto'
                } );
            }, 100 );
            updateURLState();
        } else if ( hash ) {
            setTimeout( () => {
                const target = document.getElementById( hash );
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
        setupMenuObserver();
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
        if ( loader ) {
            let jsErrorHtml = "";
            if ( AppState.settings.isDebugJS ) {
                const escapeHtml = (unsafe) => {
                    return (unsafe || "")
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                };
                const errString = e ? escapeHtml(e.toString()) : "Unknown Error";
                const errStack  = e && e.stack ? escapeHtml(e.stack) : "";
                jsErrorHtml = `
                <div style="margin-bottom: 50px;">
                    <pre style="text-align: left; font-family: monospace; background: rgba(0,0,0,0.5); padding: 10px; overflow: auto; max-height: 50vh; white-space: pre-wrap; word-wrap: break-word;">
                        ${errString}\n\n${errStack}
                    </pre>
                </div>`;
            }

            loader.innerHTML = `
            <div class="console-error" style="text-align: center; color: white;margin: 0 40px;">
                <div>
                    <h1 style="margin-bottom: 20px; font-size: 1.5rem; text-transform: uppercase;">Erreur application TINALS</h1>
                    <p class='loader-error-msg' style="margin-bottom: 50px;">Le problème trouve souvent son origine dans le système de cache du navigateur ou a une erreur javascript<br>
                    <h1 style="margin-bottom: 20px; font-size: 1.5rem; text-transform: uppercase;">TINALS application error</h1>
                    <p class='loader-error-msg' style="margin-bottom: 50px;">The problem often originates in the browser's cache system or a javascript error</p>
                </div>
                ${jsErrorHtml}
                <div>
                    <button class="reload-btn" onclick="reloadApp()">Réinitialiser / Try reload</button>
                </div>
            </div>`;
        }
    }
}


function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test( navigator.userAgent );
}


function isLandscape() {
    return window.innerWidth > window.innerHeight;
}


function handleOrientationChange() {
    updateSessionDisplay();
    const s         = AppState.settings;
    const topDrawer = document.getElementById( 'top-bar' );
    const tm        = AppState.timers;

    if ( AppState.state.activeId !== null ) {
        VideoManager.applyMobileZoom( AppState.state.activeId );
    }

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

    s.isDebugJS                     = f.is_debug_js                       ?? false;
    s.isDisplayVersion              = f.is_display_version                ?? false;
    s.versionNumber                 = c.site.version || "";

    s.isDisplayDay                  = f.is_display_day                    ?? true;
    s.isDisplayDate                 = f.is_display_date                   ?? true;
    s.isDisplayTime                 = f.is_display_time                   ?? true;
    s.isDisplayTag                  = f.is_display_tag                    ?? true;
    s.isDisplayPlace                = f.is_display_place                  ?? true;

    s.isToastScrollFavorite         = f.is_toast_scroll_favorite          ?? false;
    s.isToastScrollFilter           = f.is_toast_scroll_filter            ?? false;
    s.isToastScrollPage             = f.is_toast_scroll_page              ?? false;

    s.isButtonSoundEnable           = f.is_button_sound_enable            ?? true;
    s.isButtonTopBottomEnable       = f.is_button_top_bottom_enable       ?? false;
    s.isButtonPrevNextEnable        = f.is_button_prev_next_enable        ?? true;
    s.isFullscreenEnable            = f.is_fullscreen_enable              ?? true;

    s.isDisplayBoxTitle             = f.is_display_box_title              ?? false;
    s.isDisplayArtist               = f.is_display_artist                 ?? true;
    s.isDisplayActionBar            = f.is_display_action_bar             ?? true;
    s.isDisplayControlBar           = f.is_display_control_bar            ?? true;
    s.isMenuAutoHide                = f.is_menu_auto_hide                 ?? false;
    s.isDisplayRecordName           = f.is_display_record_name            ?? false;
    s.isDisplayGroupDescription     = f.is_display_group_description      ?? true;
    s.isDescriptionAutoHide         = f.is_description_auto_hide          ?? true;
    s.isDisplayImageVideoEnd        = f.is_display_image_video_end        ?? true;
    s.isDisplayImageVideoPause      = f.is_display_image_video_pause      ?? true;
    s.isDisplayYear                 = f.is_display_year                   ?? false;
    s.isAutoLoadVideo               = f.is_auto_load_video                ?? false;
    s.isAutoPlayNext                = f.is_auto_play_next                 ?? true;
    s.isAutoPlayLoop                = f.is_auto_play_loop                 ?? true;
    s.isAppInstall                  = f.is_app_install                    ?? true;
    s.isForceZoom                   = f.is_force_zoom                     ?? false;
    s.isTicketingDisplayLike        = f.is_ticketing_display_like         ?? false;
    s.isTicketingDisplayCount       = f.is_ticketing_display_count        ?? false;
    s.isTicketingDisplayArtistsName = f.is_ticketing_display_artists_name ?? false;

    if ( s.isDescriptionAutoHide ) document.body.classList.add( 'hide-desc-mobile' );
    else document.body.classList.remove( 'hide-desc-mobile' );

    if ( !s.isDisplayActionBar ) {
        const actionBar = document.querySelector('.action-bar');
        if (actionBar) actionBar.style.display = 'none';
    } else {
        const actionBar = document.querySelector('.action-bar');
        if (actionBar) actionBar.style.display = '';
    }

    if ( !s.isButtonSoundEnable ) document.getElementById( 'btn-mute' ).style.display = 'none';
    if ( !s.isButtonTopBottomEnable ) {
        document.getElementById( 'btn-nav-top' ).style.display    = 'none';
        document.getElementById( 'btn-nav-bottom' ).style.display = 'none';
    }
    if ( !s.isButtonPrevNextEnable ) {
        document.getElementById( 'btn-nav-previous-card' ).style.display   = 'none';
        document.getElementById( 'btn-nav-next-card' ).style.display = 'none';
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
        // console.log( 's.versionNumber = ' + s.versionNumber );
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

        // Update menu lang icon
        const menuLangIconUse = document.getElementById('menu-lang-icon-use');
        if (menuLangIconUse && c.images) {
             const targetFlagId = AppState.currentLang === 'fr' ? c.images.flag_en_id : c.images.flag_fr_id;
             const href = `${c.images.sprite_path}#${targetFlagId}`;
             menuLangIconUse.setAttribute( 'href', href );
             menuLangIconUse.setAttributeNS( 'http://www.w3.org/1999/xlink', 'href', href );
        }
    }
}


function translateText( text, type ) {
    if ( !text ) return "";
    const lowerText = text.toLowerCase().trim();

    // Special handling for sessions (always map ID -> Localized text)
    if ( type === 'tags' && translations.sessions && translations.sessions[lowerText] ) {
        return translations.sessions[lowerText];
    }

    if ( AppState.currentLang === 'fr' ) return text;
    if ( translations[ type ] && translations[ type ][ lowerText ] ) return translations[ type ][ lowerText ];
    return text;
}


function updateStaticTexts() {
    const t = AppState.config.texts;
    // document.getElementById( 'btn-header-prog' ).innerText   = t.nav_programming;
    // document.getElementById( 'btn-header-ticket' ).innerText = t.nav_ticketing;
    // if(document.getElementById('txt-header-day1')) document.getElementById('txt-header-day1').innerText = t.nav_day_1;
    // if(document.getElementById('txt-header-day2')) document.getElementById('txt-header-day2').innerText = t.nav_day_2;

    document.getElementById( 'drawer-fav-title' ).innerText  = t.fav_title;
    document.getElementById( 'drawer-time-title' ).innerText = t.timeline_title;
    document.getElementById( 'btn-txt-play-fav' ).innerText  = t.fav_btn_play;
    document.getElementById( 'btn-txt-share-fav' ).innerText = t.fav_btn_share;
    document.getElementById( 'share-title-text' ).innerText  = t.share_title;
    if(t.summary_title) document.getElementById('summary-title').innerText = t.summary_title;
    document.getElementById( 'txt-share-fb' ).innerText      = t.share_facebook;
    document.getElementById( 'txt-share-tiktok' ).innerText  = t.share_tiktok;
    document.getElementById( 'txt-share-email' ).innerText   = t.share_email;
    document.getElementById( 'share-link-label' ).innerText  = t.share_link;
    document.getElementById( 'txt-share-qr' ).innerText      = t.share_qrcode;
    document.getElementById( 'btn-close-share' ).innerText   = t.share_btn_close;
    renderFavFilterBar();

    // Confirm Modal Buttons
    const btnYes   = document.getElementById('btn-confirm-yes');
    const btnNo    = document.getElementById('btn-confirm-no');
    if (btnYes)   btnYes.innerText   = t.btn_ok    || 'OK';
    if (btnNo)    btnNo.innerText    = t.btn_later || 'Later';

    // Features Modal
    document.getElementById( 'features-title' ).innerText = t.features_modal_title;
    document.getElementById( 'btn-close-features' ).innerText = t.features_modal_close;

    // Main Menu Texts
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if(el) el.innerText = text;
    };
    setText('menu-txt-home',      t.menu_home);
    setText('menu-txt-program',   t.menu_program);
    // setText('menu-txt-day1',      t.menu_day_1);
    // setText('menu-txt-day2',      t.menu_day_2);
    setText('menu-txt-favorites', t.menu_favorites);
    setText('menu-txt-timeline',  t.menu_timeline);
    setText('menu-txt-ticketing', t.menu_ticketing);
    setText('menu-txt-language',  t.menu_language);
    setText('menu-txt-website',   t.menu_website);
    setText('menu-txt-news',      t.menu_news);
    setText('menu-txt-practical', t.menu_practical);
    setText('menu-txt-map',       t.menu_map);
    setText('menu-txt-pro-area',  t.menu_pro_area);
    setText('menu-txt-settings',  t.menu_settings);
    setText('menu-txt-features',  t.menu_features);
    setText('menu-txt-install',   t.menu_install);
    setText('menu-txt-check-version', t.menu_check_version);
    setText('menu-txt-reload',    t.menu_reload);
    setText('menu-txt-about',     t.menu_about);
    setText('menu-version', AppState.settings.versionNumber);

    // About Modal
    if(t.about_title)         document.getElementById('about-title').innerText             = t.about_title;
    if(t.about_organized_by)  document.getElementById('txt-about-organized-by').innerText  = t.about_organized_by;
    if(t.about_festival_desc) document.getElementById('txt-about-festival-desc').innerText = t.about_festival_desc;
    if(t.about_media_inter)   document.getElementById('txt-about-media-inter').innerText   = t.about_media_inter;
    if(t.about_media_local)   document.getElementById('txt-about-media-local').innerText   = t.about_media_local;
    if(t.about_comm_manager)  document.getElementById('txt-about-comm-manager').innerText  = t.about_comm_manager;
    if(t.about_press_officer) document.querySelectorAll('.txt-about-press-officer').forEach(el => el.innerText  = t.about_press_officer);
    if(t.about_developer)     document.getElementById('txt-about-developer').innerText     = t.about_developer;
    if(t.about_development)   document.getElementById('txt-about-development').innerText   = t.about_development;
    if(t.about_follow_us)     document.getElementById('txt-about-follow-us').innerText     = t.about_follow_us;
    if(t.about_close)         document.getElementById('btn-close-about').innerText         = t.about_close;

    if (AppState.state.currentTagFilter) {
        renderTagFilterBar();
    }
    updateSessionDisplay();
}


function updateSessionDisplay() {
    if (!AppState.config.sessions) return;

    const width = window.innerWidth;

    AppState.config.sessions.forEach(session => {
        // ID Mapping: day-1 -> day1
        const domIdSuffix = session.id.replace(/-/g, '');
        const menuId = `menu-txt-${domIdSuffix}`;
        const headerId = `txt-header-${domIdSuffix}`;

        const display = session.display || {};

        // Menu Logic
        let menuText = display.normal; // Default
        if (width < 400) {
            menuText = display.compact;
        } else {
            menuText = display.normal;
        }

        const menuEl = document.getElementById(menuId);
        if (menuEl) menuEl.innerText = menuText;

        // Header Logic
        let headerText = display.normal; // Default
        if (width < 400) {
            headerText = display.compact;
        } else if (width < 640) {
            headerText = display.normal;
        } else {
            headerText = display.extended;
        }

        const headerEl = document.getElementById(headerId);
        if (headerEl) headerEl.innerText = headerText;
    });
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


/* GET HTML */

function getSvgHtml( spriteId, cssClass ) {
    return `<svg class="${cssClass}"><use href="${AppState.config.images.sprite_path}#${spriteId}"></use></svg>`;
}


function getHomeHtml() {
    const c = AppState.config;
    //const s = AppState.settings;
    const logoHtml    = getSvgHtml( c.images.presentation_id, "home-logo" );
    const posterImage = "data/2026/affiche-tinals.webp";

    return `
        <section id="home" class="home-card section-snap" style="background-image: url('${posterImage}');">

            <div class="home-content-top">
            </div>

            <div class="home-content-bottom">
                <div class="home-buttons-container">
                    <!-- <button onclick="scrollToFirstVideo()" class="home-btn">${c.texts.home_btn_program}</button> -->
                    <button onclick="openProgramSession('day-1')" class="home-btn">${c.texts.home_day_1}</button>
                    <button onclick="openProgramSession('day-2')"   class="home-btn">${c.texts.home_day_2}</button>
                    <button onclick="scrollToTicketing()"       class="home-btn home-ticket-btn">${c.texts.home_btn_ticket}</button>
                </div>
                <p class="home-organizer">${c.texts.home_footer}</p>
            </div>
        </section>`;
}


function getSummaryHtml() {
    const t = AppState.config.texts;
    const s = AppState.settings;

    const itemsHtml = AppState.data.map(g => {
        const dayName  = ( s.isDisplayDay && g.event_day ) ? translateText( g.event_day, 'days' ).toUpperCase() : '';
        const dateRaw  = ( s.isDisplayDate && g.event_start_date ) ? formatDate( g.event_start_date ) : '';
        let timeString = '';
        if ( s.isDisplayTime ) {
            timeString = g.event_start_time || '';
        }
        const placeName = ( s.isDisplayPlace && g.event_place ) ? g.event_place : '';

        // Construct date/place html parts
        let metaHtml = '';
        if (dayName)   metaHtml += `<span class="summary-date">${dayName}</span>`;
        if (dateRaw)   metaHtml += `<span class="summary-date">${dateRaw}</span>`;
        if (timeString) metaHtml += `<span class="summary-time">${timeString}</span>`;
        if (placeName) metaHtml += `<span class="summary-place">${placeName}</span>`;

        const isFav = AppState.favorites.includes(g.id);
        const thumb = g.image_thumbnail || g.image;

        const favClass = isFav ? 'is-favorite' : '';

        const favIconHtml = isFav
            ? '<span class="material-icons" style="color: var(--primary-color);">favorite</span>'
            : '<span class="material-icons" style="color: var(--light-color);">favorite_border</span>';

        return `
        <div class="summary-item ${favClass}" data-id="${g.id}" onclick="VideoManager.scrollTo(${g.id})">
            <button class="summary-like-btn" onclick="toggleFav(${g.id}, false); event.stopPropagation();">
                ${favIconHtml}
            </button>
            <div class="summary-image-container">
                <img src="${thumb}" class="summary-image" loading="lazy" alt="${g.event_name}">
            </div>
            <div class="summary-content">
                <div class="summary-title-row">
                    <div class="summary-title">${g.event_name}</div>
                    <div class="playing-indicator">
                        <div class="playing-bar"></div>
                        <div class="playing-bar"></div>
                        <div class="playing-bar"></div>
                    </div>
                </div>
                <div class="summary-date-place">${metaHtml}</div>
            </div>
        </div>`;
    }).join('');

    return `
    <section id="summary-card" class="section-snap">
        <h2 id="summary-title">${t.summary_title || 'En un coup d\'oeil'}</h2>
        <div class="summary-grid">
            ${itemsHtml}
        </div>
    </section>`;
}


function getVideoCardHtml( g ) {
    const s = AppState.settings;
    const tagsHtml = ( s.isDisplayTag && g.event_tags ) ? `<div class="tags-container">${g.event_tags.map(t => {
        const slug = slugify(t);
        return `<span class="tag-pill" data-slug="${slug}" onclick="filterByTag('${slug}', event)">${translateText(t, 'tags')}</span>`;
    }).join('')}</div>` : '';

    const artistSongTitle = ( s.isDisplayRecordName && g.video_title ) ? `<h3 class="artist-song-title" onclick="toggleArtistDescription(this.parentNode.querySelector('.artist-description'), event)">"${g.video_title}"</h3>` : '';
    const boxSongTitle    = ( s.isDisplayRecordName && g.video_title ) ? `<h3>"${g.video_title}"</h3>` : '';
    const dayName         = ( s.isDisplayDay && g.event_day ) ? translateText( g.event_day, 'days' ).toUpperCase() : '';
    const dateRaw         = ( s.isDisplayDate && g.event_start_date ) ? formatDate( g.event_start_date ) : '';

    let timeString = '';
    if ( s.isDisplayTime ) {
        timeString = g.event_start_time || '';
        if ( timeString && g.event_end_time ) timeString += ` - ${g.event_end_time}`;
    }

    const placeName       = ( s.isDisplayPlace && g.event_place ) ? g.event_place : '';
    const artistDatePlace = [ placeName, dayName, dateRaw, timeString ].filter( Boolean ).join( ' • ' );

    let boxSplashHtml = '';
    if ( s.isDisplayPlace && g.event_place ) boxSplashHtml += `<span class="box-meta-place">${g.event_place}</span>`;

    let dateTimeParts = [];
    if ( dayName ) dateTimeParts.push( dayName );
    if ( dateRaw ) dateTimeParts.push( dateRaw );

    let dateTimeStr = dateTimeParts.join( ' ' );
    if ( dateTimeStr && timeString ) dateTimeStr += ' • ' + timeString;
    else if ( !dateTimeStr && timeString ) dateTimeStr = timeString;

    if ( dateTimeStr ) boxSplashHtml += `<span class="box-meta-date">${dateTimeStr}</span>`;
    const boxMetaHtml     = boxSplashHtml ? `<div class="box-meta">${boxSplashHtml}</div>` : '';

    const descriptionText = ( AppState.currentLang === 'en' && g.descriptionEN ) ? g.descriptionEN : g.description;
    const socialsHtml     = getSocialsHtml(g);
    const descHtml        = ( s.isDisplayGroupDescription && descriptionText ) ? `<div class="artist-description" onclick="toggleArtistDescription(this, event)"><div class="desc-header-row"><div class="desc-state-icon material-icons">expand_less</div><div class="desc-text">${descriptionText}</div></div>${socialsHtml}</div>` : '';
    const artistAvatarImg = g.image_thumbnail || g.image;

    const artistAvatarHtml = `
        <div class="artist-avatar-container" onclick="toggleArtistDescription(this.parentNode.querySelector('.artist-description'), event)">
            <img src="${artistAvatarImg}" class="artist-avatar" alt="${g.event_name}">
        </div>`;

    const isMobile = isMobileDevice();
    const bgImage  = ( isMobile && g.image_mobile ) ? g.image_mobile : g.image;

    // Status logic
    const status = g.event_status || 'scheduled';
    const displayedStatuses = AppState.config.features.displayed_statuses || [];

    let eventStatusBadge = '';
    if (displayedStatuses.includes(status)) {
        const statusKey     = 'status_' + status;
        const statusLabel   = (AppState.config.texts && AppState.config.texts[statusKey]) ? AppState.config.texts[statusKey] : status.replace('_', ' ').toUpperCase();
        const statusClass   = 'status-' + status.replace('_', '-');
        eventStatusBadge = `<div class="status-badge ${statusClass}">${statusLabel}</div>`;
    }

    const boxTitleHtml = s.isDisplayBoxTitle ? `
            <div class="box-title">
                <h2>${g.event_name}</h2>
                ${boxSongTitle}
                ${boxMetaHtml}
                ${eventStatusBadge}
            </div>` : '';

    const artistOverlayHtml = s.isDisplayArtist ? `
        <div class="artist-overlay">
            <div class="artist-info">
                ${artistAvatarHtml}
                <h2 onclick="toggleArtistDescription(this.parentNode.querySelector('.artist-description'), event)">${g.event_name}</h2>
                <div class="artist-date-place">${artistDatePlace}</div>
                ${artistSongTitle}
                ${tagsHtml}
                ${descHtml}
            </div>
        </div>` : '';

    return `
    <article class="video-card section-snap ${AppState.favorites.includes(g.id) ? 'is-favorite' : ''}" id="video-${g.id}" data-id="${g.id}">
        <div class="video-container">
            ${boxTitleHtml}
            <div class="video-background" style="background-image: url('${bgImage}');"></div>
            <div id="player-${g.id}" class="yt-placeholder"></div>
            <div class="video-click-layer"></div>
            <div class="video-state-icon material-icons">play_arrow</div>
        </div>
        ${artistOverlayHtml}
    </article>`;
}


/* RENDER MAIN FEED */


function renderFeed() {
    const feed      = document.getElementById( 'main-feed' );
    const htmlParts = [ getHomeHtml(), getSummaryHtml(), ...AppState.data.map( group => getVideoCardHtml( group ) ), getTicketingHtml() ];
    feed.innerHTML = htmlParts.join( '' );
}


/* TOGGLE */

function toggleLanguage() {
    const newLang = AppState.currentLang === 'fr' ? 'en' : 'fr';
    const url = new URL( window.location );
    url.searchParams.set( 'lang', newLang );
    window.location.href = url.href;
}


/* MAIN MENU */

function toggleMainMenu() {
    const drawer = document.getElementById('main-menu-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (!drawer) return;

    if (AppState.state.isMainMenuOpen) {
        closeMainMenu();
    } else {
        closeFavTimelineDrawers(); // Close other drawers first
        drawer.classList.add('active');
        overlay.classList.add('active');
        AppState.state.isMainMenuOpen = true;
    }
}


function closeMainMenu() {
    const drawer = document.getElementById('main-menu-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('active');

    // Only remove overlay if other drawers are not active (should be handled by closeFavTimelineDrawers too but let's be safe)
    // Actually overlay is shared.
    // If we close main menu, we should check if others are open?
    // But typically we treat overlay as "one modal/drawer open".
    if(overlay) overlay.classList.remove('active');

    AppState.state.isMainMenuOpen = false;
}


function handleMenuAction(action) {
    const s = AppState.settings;
    const links = AppState.config.external_links;

    switch (action) {
        case 'home':
            closeMainMenu();
            scrollToTop();
            break;
        case 'program':
            closeMainMenu();
            scrollToFirstVideo();
            break;
        case 'day1':
            closeMainMenu();
            openProgramSession('day-1');
            break;
        case 'day2':
            closeMainMenu();
            openProgramSession('day-2');
            break;
        case 'favorites':
            closeMainMenu();
            setTimeout(() => toggleFavTimelineDrawer('favorites'), 300);
            break;
        case 'timeline':
            closeMainMenu();
            setTimeout(() => toggleFavTimelineDrawer('timeline'), 300);
            break;
        case 'ticketing':
            closeMainMenu();
            scrollToTicketing();
            break;
        case 'language':
            closeMainMenu();
            toggleLanguage();
            break;
        case 'news':
            if(links.news) window.open(links.news, '_blank');
            closeMainMenu();
            break;
        case 'practical':
            if(links.practical) window.open(links.practical, '_blank');
            closeMainMenu();
            break;
        case 'map':
            if(links.google_maps_dir) window.open(links.google_maps_dir, '_blank');
            closeMainMenu();
            break;
        case 'pro_area':
            if(links.professional_area) window.open(links.professional_area, '_blank');
            closeMainMenu();
            break;
        case 'website':
            if(links.home) window.open(links.home, '_blank');
            closeMainMenu();
            break;
        case 'features':
            openFeaturesModal();
            break;
        case 'install':
            // Logic for installation / uninstall
            triggerInstallOrUninstall();
            break;
        case 'check_version':
            closeMainMenu();
            checkVersion(true);
            break;
        case 'reload':
            triggerReload();
            break;
        case 'about':
            openAboutModal();
            break;
        default:
            break;
    }
}


/* FEATURES BOX */

function openFeaturesModal() {
    const modal = document.getElementById('features-modal');
    const features = AppState.config.features || {};
    let html = '';

    for (const [key, value] of Object.entries(features)) {
        let displayValue = value;
        if (typeof value === 'boolean') {
            const icon = value ? 'check_box' : 'check_box_outline_blank';
            displayValue = `<span class="material-icons">${icon}</span>`;
        } else if (Array.isArray(value)) {
            displayValue = value.join(', ');
        }

        html += `
            <div class="feature-item">
                <span class="feature-key">${key}</span>
                <span class="feature-value">${displayValue}</span>
            </div>`;
    }

    const listContainer = document.getElementById('features-list');
    if(listContainer) listContainer.innerHTML = html;

    if(modal) modal.classList.add('active');
}


function closeFeaturesModal() {
    const modal = document.getElementById('features-modal');
    if(modal) modal.classList.remove('active');
}


/* MODAL BOX */

function openAboutModal() {
    const modal = document.getElementById('about-modal');
    if(modal) modal.classList.add('active');
}


function closeAboutModal() {
    const modal = document.getElementById('about-modal');
    if(modal) modal.classList.remove('active');
}


/* SETTINGS */

function toggleAccordion( el ) {
    if(el && el.parentNode) {
        el.parentNode.classList.toggle('expanded');
    }
}


function triggerInstallOrUninstall() {
    const isInstalled = localStorage.getItem('app_installed') === 'true';
    if (isInstalled) {
        // App is installed, ask for "uninstall" (reset)
        openConfirmModal(
            AppState.config.texts.menu_uninstall_confirm_title,
            AppState.config.texts.menu_uninstall_confirm_text,
            () => {
                reloadApp(); // "Uninstall" via clearing data
            }
        );
    } else {
        // App is not installed, show install prompt
        closeMainMenu();
        PWAManager.showModal();
    }
}


function triggerReload() {
    openConfirmModal(
        AppState.config.texts.menu_reload_confirm_title,
        AppState.config.texts.menu_reload_confirm_text,
        () => {
            reloadApp();
        }
    );
}


async function reloadApp() {
    // Unregister SW
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
        }
    }
    // Clear Caches
    if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
    }
    // Clear LocalStorage (optional but good for hard reset)
    // localStorage.clear(); // Maybe too aggressive if we want to keep favorites?
    // User said "clear local cache". Usually implies SW cache.
    // I'll stick to SW and Caches.

    window.location.reload(true);
}


async function checkVersion(manualCheck = false) {
    try {
        const response = await fetch(`./VERSION?t=${Date.now()}`);
        if (!response.ok) return;
        const serverVersion = (await response.text()).trim();
        const currentVersion = AppState.config.site.version;

        if (serverVersion && currentVersion && serverVersion !== currentVersion) {
            if (AppState.settings.isDebugJS) {
                console.log(`Version mismatch: server=${serverVersion}, local=${currentVersion}`);
            }

            const displayServerVersion = serverVersion.replace(/^v/, '');
            const displayCurrentVersion = currentVersion.replace(/^v/, '');
            let updateText = AppState.config.texts.update_available_text;
            updateText = updateText.replace('{new_version}', displayServerVersion)
                                   .replace('{old_version}', displayCurrentVersion);

            openConfirmModal(
                AppState.config.texts.update_available_title,
                updateText,
                () => {
                    reloadApp();
                }
            );
        } else if (manualCheck) {
            showToast(AppState.config.texts.msg_up_to_date);
        }
    } catch (e) {
        console.error("Error checking version:", e);
    }
}


/* CONFIRM MODAL */

let confirmCallback = null;

function openConfirmModal(title, text, onYes) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-text').innerHTML  = text;
    confirmCallback = onYes;
    modal.classList.add('active');
}


function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('active');
    confirmCallback = null;
}

// Bind confirm yes button
document.addEventListener('DOMContentLoaded', () => {
    const btnYes = document.getElementById('btn-confirm-yes');
    if(btnYes) {
        btnYes.addEventListener('click', () => {
            if(confirmCallback) confirmCallback();
            closeConfirmModal();
        });
    }
});


/* TOGGLE */

function toggleMute() {
    VideoManager.toggleMute();
}


function toggleFavTimelineDrawer(tabName) {
    const drawer   = document.getElementById('fav-timeline-drawer');
    const overlay  = document.getElementById('drawer-overlay');
    const isActive = drawer.classList.contains('active');

    // If already open
    if (isActive) {
        // If same tab, close it (toggle)
        if (AppState.state.activeTab === tabName) {
            closeFavTimelineDrawers();
        } else {
            // Switch tab
            switchDrawerTab(tabName);
        }
    } else {
        // Open drawer and select tab
        switchDrawerTab(tabName);
        drawer.classList.add('active');
        overlay.classList.add('active');
    }

    // Update button icon state
    const btnFloat = document.getElementById('btn-drawer-favorites');
    const icon     = btnFloat.querySelector('.material-icons:not(.btn-bg)');

    if (drawer.classList.contains('active') && AppState.state.activeTab === 'favorites') {
        icon.textContent = 'chevron_right';
    } else {
        icon.textContent = 'bookmark';
        updateFavoritesIcon();
    }
}


function toggleText( el, event ) {
    event.stopPropagation();
    if ( closeDrawerIfOpen() ) return;
    el.classList.toggle( 'expanded' );
}


function toggleArtistDescription( element, event ) {
    if ( event ) event.stopPropagation();
    element.classList.add( 'manual-toggle' );
    element.classList.toggle( 'expanded' );

    const icon = element.querySelector('.desc-state-icon');
    if (icon) {
        if (element.classList.contains('expanded')) {
            icon.innerText = 'expand_more';
        } else {
            icon.innerText = 'expand_less';
        }
    }

    const card = element.closest('.video-card');
    if (card) {
        if (element.classList.contains('expanded')) {
            card.classList.add('desc-open');
        } else {
            card.classList.remove('desc-open');
        }
    }

    setTimeout( () => {
        element.classList.remove( 'manual-toggle' );
    }, 50 );
}


/* SOCIALS */

function getSocialsHtml(g) {
    const networks = [
        { key: 'performer_facebook',  label: 'Facebook' },
        { key: 'performer_instagram', label: 'Instagram' },
        { key: 'performer_tiktok',    label: 'TikTok' },
        { key: 'performer_pinterest', label: 'Pinterest' },
        { key: 'performer_youtube',   label: 'YouTube' },
        { key: 'performer_spotify',   label: 'Spotify' },
        { key: 'performer_deezer',    label: 'Deezer' },
        { key: 'performer_website',   label: 'Website' },
        { key: 'event_link',          label: 'Event' },
        { key: 'event_ticket',        label: 'Tickets' }
    ];

    const links = networks.filter(n => g[n.key]).map(n => {
        return `<a href="${g[n.key]}" target="_blank" class="social-pill" title="${n.label}">${n.label}</a>`;
    });

    if (links.length === 0) return '';
    return `<div class="social-links-container">${links.join('')}</div>`;
}


/* TICKETING */


function getTicketingHtml() {
    const t = AppState.config.texts;
    const s = AppState.settings;
    const ticketing = AppState.config.ticketing || {};
    let blocksHtml = '';

    for (const key in ticketing) {
        if (ticketing.hasOwnProperty(key)) {
            const ticket      = ticketing[key];
            const isAvailable = ticket.is_available    !== false;
            const colorClass  = ticket.button_color    || '';
            const title       = ticket.ticket_title    || '';
            const subtitle    = ticket.ticket_subtitle || '';
            const btnText     = ticket.button_text     || '';
            const url         = ticket.button_url      || '#';

            let btnHtml = '';
            if (isAvailable) {
                btnHtml = `<a href="${url}" target="_blank" class="ticket-btn ${colorClass}" title="${btnText}">${btnText}</a>`;
            } else {
                btnHtml = `<span class="ticket-btn ${colorClass} disabled" title="${btnText}">${btnText}</span>`;
            }

            // --- TICKET STATS LOGIC ---
            let statsHtml = '';
            const startDate = ticket.start_date;
            const endDate = ticket.end_date;

            if (startDate && endDate) {
                const ticketEvents = AppState.data.filter(g =>
                    g.event_start_date >= startDate && g.event_start_date <= endDate
                );

                const artistsCount = ticketEvents.length;
                const likesCount = ticketEvents.filter(g => AppState.favorites.includes(g.id)).length;
                const artistNames = ticketEvents.map(g => g.event_name).join(', ');

                // Likes Row (All tickets)
                let likesHtml = '';
                if (s.isTicketingDisplayLike) {
                    likesHtml = `
                    <div class="ticket-likes-row" id="ticket-likes-${key}">
                        <span class="material-icons">favorite</span>
                        <span class="likes-text"><span class="likes-count">${likesCount}</span> ${t.ticket_likes_label}</span>
                    </div>`;
                }

                // Artists Count (Full Pass only)
                let countHtml = '';
                if (s.isTicketingDisplayCount && key === 'full_pass_ticket') {
                    const label = t.ticket_artists_count_label.replace('{count}', artistsCount);
                    countHtml = `<div class="ticket-artists-count">${label}</div>`;
                }

                // Artist Names (Day Passes only)
                let listHtml = '';
                if (s.isTicketingDisplayArtistsName && key.startsWith('day_pass_ticket')) {
                    listHtml = `<div class="ticket-artists-list">${artistNames}</div>`;
                }

                if (likesHtml || countHtml || listHtml) {
                    statsHtml = `
                        <div class="ticket-stats">
                            ${likesHtml}
                            ${countHtml}
                            ${listHtml}
                        </div>`;
                }
            }

            blocksHtml += `
                <div class="ticket-block ${colorClass}">
                    <h2>${title}</h2>
                    <h3>${subtitle}</h3>
                    ${btnHtml}
                    ${statsHtml}
                </div>`;
        }
    }

    return `
        <section id="ticketing" class="ticketing-card section-snap" >
            <div class="ticket-title"><h2>${t.ticket_section_title}</h2></div>
            <div class="ticket-container">
                ${blocksHtml}
            </div>
        </section>`;
}


function updateTicketingStats() {
    const ticketing = AppState.config.ticketing || {};
    for (const key in ticketing) {
        const ticket = ticketing[key];
        const container = document.getElementById(`ticket-likes-${key}`);
        if (container) {
             const startDate = ticket.start_date;
             const endDate = ticket.end_date;
             if (startDate && endDate) {
                 const count = AppState.data.filter(g =>
                    g.event_start_date >= startDate &&
                    g.event_start_date <= endDate &&
                    AppState.favorites.includes(g.id)
                 ).length;
                 const countSpan = container.querySelector('.likes-count');
                 if(countSpan) countSpan.innerText = count;
             }
        }
    }
}


function scrollToSummary(shouldPause = true) {
    AppState.state.isMenuNavigation = true;
    if (shouldPause) VideoManager.pauseAll();
    const summarySection = document.getElementById( 'summary-card' );
    if ( summarySection ) summarySection.scrollIntoView( {
        behavior: 'smooth'
    } );
    setTimeout( () => {
        AppState.state.isMenuNavigation = false;
    }, 1200 );
}


function openProgramSession(sessionId) {
    filterByTag(sessionId, null, false);
    setTimeout(() => {
        scrollToSummary();
    }, 100);
}


function scrollToTicketing() {
    AppState.state.isMenuNavigation = true;
    cancelFilters();
    VideoManager.pauseAll();
    const ticketSection = document.getElementById( 'ticketing' );
    if ( ticketSection ) ticketSection.scrollIntoView( {
        behavior: 'smooth'
    } );
    setTimeout( () => {
        AppState.state.isMenuNavigation = false;
    }, 1200 );
}


/* URL  */

function updateURLState() {
    const url = new URL( window.location );

    url.searchParams.delete( 'id' );
    url.searchParams.delete( 'filter' );
    url.searchParams.delete( 'favorites' );
    url.searchParams.delete( 'share' );

    // Clear hash by default, re-add if needed
    url.hash = '';

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
    } else if ( AppState.state.activeSection ) {
        url.hash = AppState.state.activeSection;
    }

    window.history.replaceState( null, '', url );
}


/* SHARE  */

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
                text: AppState.config.texts.share_song_text,
                url: url
            } );
        } catch ( err ) {}
    } else {
        openShareModal();
    }
}


function shareTo( platform ) {
    const url = encodeURIComponent( AppState.state.shareUrl );
    const text = encodeURIComponent( AppState.config.texts.share_title );
    if ( platform === 'facebook' ) window.open( `https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank' );
    else if ( platform === 'email' ) window.location.href = `mailto:?subject=${text}&body=${url}`;
    else if ( platform === 'tiktok' || platform === 'copy' ) {
        navigator.clipboard.writeText( AppState.state.shareUrl ).then( () => {
            alert( AppState.config.texts.msg_link_copied );
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


async function shareFavoritesList() {
    if ( AppState.favorites.length === 0 ) return;
    toggleFavTimelineDrawer( 'favorites' );

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
    document.getElementById( 'share-box-modal' ).classList.add( 'active' );
}


function closeShareModal() {
    document.getElementById( 'share-box-modal' ).classList.remove( 'active' );
    document.getElementById( 'qr-result' ).style.display = 'none';
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


/* OBSERVER */

function setupObserver() {
    const observer = new IntersectionObserver( ( entries ) => {
        entries.forEach( entry => {
            if ( entry.isIntersecting ) {
                if ( entry.target.hasAttribute( 'data-id' ) ) {
                    const id = Number( entry.target.dataset.id );
                    AppState.state.activeSection = null;
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
                    // updateSummaryPlayingState moved to VideoManager
                    updateURLState();

                    if ( AppState.settings.isDisplayControlBar ) {
                        document.getElementById( 'control-bar' ).classList.add( 'visible' );
                        ControlBar.syncUI( id );
                    }

                } else {
                    AppState.state.activeId = null;
                    if ( entry.target.id ) {
                        AppState.state.activeSection = entry.target.id;
                        if ( entry.target.id === 'home' ) {
                            checkVersion();
                        }
                    }
                    if ( !AppState.state.isMenuNavigation && AppState.state.previousId !== null && VideoManager.instances[ AppState.state.previousId ] && typeof VideoManager.instances[ AppState.state.previousId ].pauseVideo === 'function' ) {
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
                updateNavActionButtons();
            } else {
                entry.target.classList.remove( 'active' );
                entry.target.classList.remove( 'desc-open' );
                if ( entry.target.querySelector( '.artist-description' ) ) {
                    entry.target.querySelector( '.artist-description' ).classList.remove( 'expanded' );
                }
            }
        } );
    }, {
        threshold: 0.6
    } );
    document.querySelectorAll( '.section-snap' ).forEach( el => observer.observe( el ) );
}


/* GESTURES AND KEYBOARD */

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
            const drawer     = document.getElementById( 'fav-timeline-drawer' );
            const isFavOpen  = drawer ? drawer.classList.contains( 'active' ) : false;
            const isMenuOpen = AppState.state.isMainMenuOpen;

            if ( !isMenuOpen && !isFavOpen ) {
                // Case 1: No drawers open
                if ( xDiff < 0 ) {
                    // Swipe Left-to-Right -> Open Menu
                    toggleMainMenu();
                } else {
                    // Swipe Right-to-Left -> Open Favorites
                    toggleFavTimelineDrawer( 'favorites' );
                }
            } else if ( isMenuOpen ) {
                // Case 2: Menu is open
                if ( xDiff > 0 ) {
                    // Swipe Right-to-Left -> Close Menu
                    closeMainMenu();
                }
                // Swipe Left-to-Right -> Do nothing
            } else if ( isFavOpen ) {
                // Case 3: Favorites/Timeline is open
                if ( xDiff < 0 ) {
                    // Swipe Left-to-Right -> Close Favorites/Timeline
                    closeFavTimelineDrawers();
                }
                // Swipe Right-to-Left -> Do nothing
            }
        }
    }
}


function setupKeyboardControls() {
    document.addEventListener( 'keydown', ( e ) => {
        const key = e.key.toLowerCase();
        const activeId = AppState.state.activeId;
        if ( e.key === 'Escape' ) {
            const shareModal = document.getElementById( 'share-box-modal' );
            if ( shareModal.classList.contains( 'active' ) ) {
                closeShareModal();
                return;
            }
            if ( document.getElementById('install-modal').classList.contains('active') ) {
                PWAManager.dismiss();
                return;
            }
            if ( document.getElementById('features-modal').classList.contains('active') ) {
                closeFeaturesModal();
                return;
            }
            if ( document.getElementById('about-modal').classList.contains('active') ) {
                closeAboutModal();
                return;
            }
            if ( document.getElementById('confirm-modal').classList.contains('active') ) {
                closeConfirmModal();
                return;
            }
            const drawers = document.querySelectorAll( '.drawer-fav-timeline.active' );
            if ( drawers.length > 0 || AppState.state.isMainMenuOpen ) {
                closeFavTimelineDrawers();
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
            if ( key === 'j' || e.key === 'ArrowLeft' )  p.seekTo( current - 10, true );
            if ( key === 'l' || e.key === 'ArrowRight' ) p.seekTo( current + 10, true );
        }
    } );
}


/* TOAST */

function showToast( message ) {
    const toast = document.getElementById( 'toast-message' );
    if ( toast.classList.contains( 'visible' ) && toast.innerHTML === message ) return;
    toast.innerHTML = message;
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
        const h  = feed.clientHeight;
        const sh = feed.scrollHeight;
        let topMsg = "";
        let bottomMsg = "";

        if ( AppState.state.isPlayingFavorites ) {

            if ( AppState.settings.isToastScrollFavorite === false ) return;

            topMsg    = AppState.config.texts.bar_fav_top_page;
            bottomMsg = AppState.config.texts.bar_fav_bottom_page;

        } else if ( AppState.state.currentTagFilter ) {

            if ( AppState.settings.isToastScrollFilter === false ) return;

            const tagName = getTagNameFromSlug(AppState.state.currentTagFilter);
            topMsg    = AppState.config.texts.bar_filter_top_page.replace('{tag}', tagName);
            bottomMsg = AppState.config.texts.bar_filter_bottom_page.replace('{tag}', tagName);

        } else {

            if ( AppState.settings.isToastScrollPage === false) return;

            topMsg    = AppState.config.texts.bar_top_page;
            bottomMsg = AppState.config.texts.bar_bottom_page;
        }

        if ( st <= 5 && st < lastScrollTop ) showToast( topMsg );
        else if ( st + h >= sh - 5 && st > lastScrollTop ) showToast( bottomMsg );
        lastScrollTop = st <= 0 ? 0 : st;
    } );
}


/* SCROLL */

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


function scrollToTop() {
    AppState.state.isMenuNavigation = true;
    cancelFilters();
    VideoManager.pauseAll();
    document.getElementById( 'main-feed' ).scrollTo( {
        top: 0,
        behavior: 'smooth'
    } );
    setTimeout( () => {
        AppState.state.isMenuNavigation = false;
    }, 1200 );
}


function scrollToFirstVideo() {
    cancelFilters();
    const firstVideo = document.querySelector( '.video-card[data-id]' );
    if ( firstVideo ) {
        const id = Number( firstVideo.dataset.id );
        if ( !isNaN( id ) ) {
            VideoManager.scrollTo( id, false );
        }
    }
}


/* ACTION BUTTONS */

function updateNavActionButtons() {
    const sections     = Array.from( document.querySelectorAll( '.section-snap' ) ).filter( el => el.offsetParent !== null );
    const currentIndex = sections.findIndex( sec => sec.classList.contains( 'active' ) );
    const btnTop       = document.getElementById( 'btn-nav-top' );
    const btnUp        = document.getElementById( 'btn-nav-previous-card' );
    const btnDown      = document.getElementById( 'btn-nav-next-card' );
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
    updateSummaryButtonState();
}


function updateSummaryButtonState() {
    const btn = document.getElementById( 'btn-nav-summary' );
    if ( !btn ) return;
    const icon = btn.querySelector( '.material-icons:not(.btn-bg)' );
    const bg = btn.querySelector( '.btn-bg' );
    const isSummary = AppState.state.activeSection === 'summary-card';

    if ( isSummary ) {
        if ( icon ) icon.style.color = 'var(--primary-color)';
        if ( bg ) bg.classList.add( 'bright' );
    } else {
        if ( icon ) icon.style.color = 'var(--light-color)';
        if ( bg ) bg.classList.remove( 'bright' );
    }
}


function updateSummaryPlayingState( activeId, isPaused = false ) {
    document.querySelectorAll( '.summary-item' ).forEach( item => {
        item.classList.remove( 'is-playing' );
        item.classList.remove( 'is-paused' );
    } );

    if ( activeId !== null && !isNaN( activeId ) ) {
        const activeItem = document.querySelector( `.summary-item[data-id="${activeId}"]` );
        if ( activeItem ) {
            activeItem.classList.add( 'is-playing' );
            if (isPaused) activeItem.classList.add( 'is-paused' );
        }
    }
}


function updateActionButtons( id ) {
    const heartBtn = document.getElementById( 'btn-dynamic-heart' );
    if ( !heartBtn ) return;

    const icon = heartBtn.querySelector( '.material-icons:not(.btn-bg)' );
    const bg = heartBtn.querySelector( '.btn-bg' );
    if ( id === null || isNaN( id ) ) {
        heartBtn.classList.add( 'disabled' );
        if ( bg ) bg.classList.remove( 'bright' );
    } else {
        heartBtn.classList.remove( 'disabled' );
        if ( AppState.favorites.includes( id ) ) {
            if ( icon ) {
                icon.innerHTML = 'favorite';
                icon.style.color = 'var(--primary-color)';
            }
            if ( bg ) bg.classList.add( 'bright' );
        } else {
            if ( icon ) {
                icon.innerHTML = 'favorite_border';
                icon.style.color = 'white';
            }
            if ( bg ) bg.classList.remove( 'bright' );
        }
    }
}


/* FILTER (TAG AND FAVORITE) */

function cancelFilters() {
    if ( AppState.state.isPlayingFavorites ) exitFavoritesMode(false);
    if ( AppState.state.currentTagFilter )   exitTagFilterMode(false);
}


/* FILTER : FAVORITES */

function updateFavoritesIcon() {
    const btn = document.getElementById( 'btn-drawer-favorites' );
    if ( !btn ) return;

    const icon = btn.querySelector( '.material-icons:not(.btn-bg)' );
    const bg = btn.querySelector( '.btn-bg' );
    if ( AppState.favorites.length > 0 ) {
        if ( bg ) bg.classList.add( 'bright' );
        if ( icon ) icon.style.color = 'var(--primary-color)';
    } else {
        if ( bg ) bg.classList.remove( 'bright' );
        if ( icon ) icon.style.color = 'white';
    }
}


function toggleFavCurrent() {
    toggleFav( AppState.state.activeId );
}


function toggleFav( id, openDrawer = true ) {
    const card = document.getElementById(`video-${id}`);
    const summaryItem = document.querySelector(`.summary-item[data-id="${id}"]`);
    const summaryBtn = summaryItem ? summaryItem.querySelector('.summary-like-btn') : null;

    if ( AppState.favorites.includes( id ) ) {
        AppState.favorites = AppState.favorites.filter( f => f !== id );
        showToast( AppState.config.texts.bar_fav_removed );
        if(card) card.classList.remove('is-favorite');
        if(summaryItem) summaryItem.classList.remove('is-favorite');
        if(summaryBtn) summaryBtn.innerHTML = '<span class="material-icons" style="color: var(--light-color);">favorite_border</span>';
    } else {
        AppState.favorites.push( id );
        showToast( AppState.config.texts.bar_fav_added );
        if(card) card.classList.add('is-favorite');
        if(summaryItem) summaryItem.classList.add('is-favorite');
        if(summaryBtn) summaryBtn.innerHTML = '<span class="material-icons" style="color: var(--primary-color);">favorite</span>';

        const drawer = document.getElementById( 'fav-timeline-drawer' );

        if ( openDrawer && !drawer.classList.contains( 'active' ) &&
            !AppState.state.isPlayingFavorites ) {

            toggleFavTimelineDrawer( 'favorites' );
            startDrawerAutoCloseTimer();
        }
    }
    localStorage.setItem( 'selected', JSON.stringify( AppState.favorites ) );
    updateActionButtons( AppState.state.activeId );
    renderDrawerFavorites();
    renderDrawerTimeline();
    updateFavoritesIcon();
    updateTicketingStats();
    if ( AppState.state.isPlayingFavorites ) renderFavFilterBar();
}


function playFavorites() {
    if ( AppState.favorites.length === 0 ) return;
    exitTagFilterMode();
    renderFavFilterBar();
    AppState.state.isPlayingFavorites = true;
    AppState.state.isMenuNavigation = true;
    VideoManager.scrollTo( AppState.favorites[ 0 ] );
    document.body.classList.add( 'favorites-mode' );
    document.getElementById( 'fav-mode-bar' ).classList.add( 'active' );
}


function exitFavoritesMode(shouldScroll = true) {
    const currentId = AppState.state.activeId;
    AppState.state.isMenuNavigation = true;
    AppState.state.isPlayingFavorites = false;
    document.body.classList.remove( 'favorites-mode' );
    document.getElementById( 'fav-mode-bar' ).classList.remove( 'active' );
    if ( currentId && shouldScroll ) {
        const el = document.getElementById( `video-${currentId}` );
        if ( el ) el.scrollIntoView( {
            behavior: 'auto',
            block: 'start'
        } );
    }
    setTimeout( () => {
        AppState.state.isMenuNavigation = false;
    }, 1000 );
    updateActionButtons( AppState.state.activeId );
    updateNavActionButtons();
}


/* FILTER : TAGS  */

function filterByTag( tagSlug, event, shouldScroll = true ) {
    if ( event ) event.stopPropagation();

    if ( AppState.state.currentTagFilter === tagSlug ) {
        exitTagFilterMode();
        return;
    }

    const currentId = AppState.state.activeId;

    exitFavoritesMode();
    AppState.state.currentTagFilter = tagSlug;
    document.body.classList.add( 'tag-filtering' );
    document.getElementById( 'tag-mode-bar' ).classList.add( 'active' );

    renderTagFilterBar();

    const tagName = getTagNameFromSlug(tagSlug);

    document.querySelectorAll('.tag-pill').forEach(el => {
        el.classList.remove('tag-active');
    });
    document.querySelectorAll(`.tag-pill[data-slug="${tagSlug}"]`).forEach(el => {
        el.classList.add('tag-active');
    });

    document.querySelectorAll( '.video-card' ).forEach( card => {
        const id    = Number( card.dataset.id );
        const group = AppState.data.find( g => g.id === id );
        if ( group && group.event_tags && group.event_tags.some(t => slugify(t) === tagSlug) ) card.classList.add( 'has-matching-tag' );
        else card.classList.remove( 'has-matching-tag' );
    } );

    document.querySelectorAll( '.summary-item' ).forEach( item => {
        const id    = Number( item.dataset.id );
        const group = AppState.data.find( g => g.id === id );
        if ( group && group.event_tags && group.event_tags.some(t => slugify(t) === tagSlug) ) item.classList.add( 'has-matching-tag' );
        else item.classList.remove( 'has-matching-tag' );
    });

    document.getElementById( 'fav-filter-info' ).innerText  = `(${tagName})`;
    document.getElementById( 'time-filter-info' ).innerText = `(${tagName})`;
    renderDrawerTimeline();
    renderDrawerFavorites();
    updateURLState();

    if (shouldScroll) {
        const currentCard      = currentId ? document.querySelector(`.video-card[data-id="${currentId}"]`) : null;
        const isCurrentVisible = currentCard && currentCard.classList.contains('has-matching-tag');

        if ( isCurrentVisible ) {
            currentCard.scrollIntoView({
                behavior: 'smooth'
            });
        } else {
            const firstMatch = document.querySelector( '.video-card.has-matching-tag' );
            if ( firstMatch ) firstMatch.scrollIntoView( {
                behavior: 'smooth'
            } );
        }
    }
}


function getTagNameFromSlug(tagSlug) {
    if (!tagSlug) return '';
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
    return translateText(tagName, 'tags');
}


function renderTagFilterBar() {
    const t = AppState.config.texts;
    const currentSlug = AppState.state.currentTagFilter;
    if (!currentSlug) return;

    const tagName = getTagNameFromSlug(currentSlug);
    const count = AppState.data.filter(g => g.event_tags && g.event_tags.some(t => slugify(t) === currentSlug)).length;
    const text = t.filter_cancel_tags.replace('{tag}', tagName).replace('{count}', count);

    const html = `<div>${text}</div> <button class="close-fav-mode"><span class="material-icons">cancel</span></button>`;
    document.getElementById( 'tag-mode-bar' ).innerHTML = html;
}


function renderFavFilterBar() {
    const t = AppState.config.texts;
    const count = AppState.favorites.length;
    const text = t.filter_cancel_fav.replace('{count}', count);

    const html = `<div>${text}</div> <button class="close-fav-mode"><span class="material-icons">cancel</span></button>`;
    document.getElementById( 'fav-mode-bar' ).innerHTML = html;
}


function exitTagFilterMode(shouldScroll = true) {
    if ( !AppState.state.currentTagFilter ) return;
    const currentId = AppState.state.activeId;
    AppState.state.isMenuNavigation = true;
    AppState.state.currentTagFilter = null;

    /* BUG ON MOZILLA : Make a quick move by displaying the Home card, then display the Event card again */
    document.body.classList.remove( 'tag-filtering' );

    document.querySelectorAll('.tag-pill').forEach(el => el.classList.remove('tag-active'));
    document.getElementById( 'tag-mode-bar' ).classList.remove( 'active' );
    document.getElementById( 'fav-filter-info' ).innerText  = '';
    document.getElementById( 'time-filter-info' ).innerText = '';
    renderDrawerTimeline();
    renderDrawerFavorites();
    updateURLState();
    if ( currentId && shouldScroll ) {
        const el = document.getElementById( `video-${currentId}` );
        if ( el ) el.scrollIntoView( {
            behavior: 'auto',
            block: 'start'
        } );
    }
    setTimeout( () => {
        AppState.state.isMenuNavigation = false;
    }, 1000 );
    updateActionButtons( AppState.state.activeId );
    updateNavActionButtons();
}


/* DRAWER ( FAVORITE - TIMELINE ) */

function startDrawerAutoCloseTimer() {
    clearTimeout( AppState.timers.close );
    AppState.timers.close = setTimeout( () => {
        const drawer = document.getElementById( 'fav-timeline-drawer' );
        if ( drawer.classList.contains( 'active' ) ) closeFavTimelineDrawers();
    }, 1000 );
}


function setupDrawerListeners() {
    const drawer = document.getElementById( 'fav-timeline-drawer' );
    if(!drawer) return;
    const stop = () => clearTimeout( AppState.timers.close );
    drawer.addEventListener( 'touchstart', stop );
    drawer.addEventListener( 'mouseenter', stop );
    drawer.addEventListener( 'click',      stop );
}


function switchDrawerTab(tabName) {
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
    const drawer = document.getElementById('fav-timeline-drawer');
    if (drawer.classList.contains('active')) {
         const btnFloat = document.getElementById('btn-drawer-favorites');
         const icon = btnFloat.querySelector('.material-icons:not(.btn-bg)');
         if (tabName === 'favorites') {
             icon.textContent = 'chevron_right';
         } else {
             icon.textContent = 'bookmark';
             updateFavoritesIcon();
         }
    }
}


function closeFavTimelineDrawers() {
    document.querySelectorAll( '.drawer-fav-timeline' ).forEach( el => el.classList.remove( 'active' ) );
    document.getElementById( 'drawer-overlay' ).classList.remove( 'active' );

    // Also close main menu if open
    if(AppState.state.isMainMenuOpen) {
        closeMainMenu();
    }

    const btnFloat   = document.getElementById( 'btn-drawer-favorites' );
    const icon       = btnFloat.querySelector( '.material-icons:not(.btn-bg)' );
    if (icon) {
        icon.textContent = 'bookmark';
        updateFavoritesIcon();
    }
}


function closeDrawerIfOpen() {
    const drawer = document.getElementById( 'fav-timeline-drawer' );
    if ( drawer.classList.contains( 'active' ) || AppState.state.isMainMenuOpen ) {
        closeFavTimelineDrawers();
        return true;
    }
    return false;
}


/* DRAWER FAVORITE*/

function renderDrawerFavorites() {
    const list = document.getElementById( 'favorites-list' );
    let favs = AppState.data.filter( g => AppState.favorites.includes( g.id ) );
    if ( AppState.state.currentTagFilter ) {
        // Filter using slug comparison
        favs = favs.filter( g => g.event_tags && g.event_tags.some(t => slugify(t) === AppState.state.currentTagFilter) );
    }

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


/* DRAWER TIMELINE */

function renderDrawerTimeline() {
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

        // Status for timeline
        const status = g.event_status || 'scheduled';
        const displayedStatuses = AppState.config.features.displayed_statuses || [];
        let eventStatusBadge = '';

        if (displayedStatuses.includes(status)) {
            const statusKey = 'status_' + status;
            const statusLabel = (AppState.config.texts && AppState.config.texts[statusKey]) ? AppState.config.texts[statusKey] : status.replace('_', ' ').toUpperCase();
            const statusClass = 'status-' + status.replace('_', '-');
            eventStatusBadge = `<span class="status-badge ${statusClass}">${statusLabel}</span>`;
        }

        const tagsHtml  = ( s.isDisplayTag && g.event_tags ) ? g.event_tags.map( t => {
            const slug = slugify(t);
            const activeClass = (slug === AppState.state.currentTagFilter) ? ' tag-active' : '';
            return `<span class="time-tag${activeClass}" onclick="filterByTag('${slug}', event)">${translateText(t, 'tags')}</span>`;
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
                <div class="time-row-3">${eventStatusBadge}${tagsHtml}</div>
            </div>
        </li>`;
    } ).join( '' );

    list.innerHTML = `<ul>${itemsHtml}</ul>`;
}


/* HAPTIC ON BUTTONS */

function setupHapticFeedback() {
    const buttons = document.querySelectorAll( '.btn-fav-float, .btn-drawer-action, .btn-program, .btn-ticket, .home-btn, .ticket-btn' );
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


/* PWA - OBSERVER */

const PWAManager = {
    deferredPrompt: null,
    init: function() {
        // Migration: Remove old localStorage key to unblock users who clicked "Later"
        if (localStorage.getItem('app_install_seen')) {
            localStorage.removeItem('app_install_seen');
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.checkAndShow();
        });

        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            localStorage.setItem('app_installed', 'true');
            console.log('PWA was installed');
        });

        // Setup buttons
        const btnInstall = document.getElementById('btn-pwa-install');
        const btnLater = document.getElementById('btn-pwa-later');
        if(btnInstall) btnInstall.addEventListener('click', () => this.install());
        if(btnLater) btnLater.addEventListener('click', () => this.dismiss());
    },
    checkAndShow: function() {
        const dismissed = sessionStorage.getItem('app_install_dismissed');
        const installed = localStorage.getItem('app_installed');

        if (!dismissed && !installed) {
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
        sessionStorage.setItem('app_install_dismissed', 'true');
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


function setupMenuObserver() {
    const menu = document.getElementById('top-bar');
    if (!menu) return;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (menu.classList.contains('auto-hidden')) {
                    document.body.classList.add('menu-hidden');
                } else {
                    document.body.classList.remove('menu-hidden');
                }
            }
        });
    });

    observer.observe(menu, { attributes: true });
}


window.onload = init;
if ( 'serviceWorker' in navigator ) {
    navigator.serviceWorker.register( 'service-worker.js?v1.59' )
        .then( ( reg )  => console.log( 'Service Worker enregistré', reg ) )
        .catch( ( err ) => console.log( 'Erreur Service Worker',     err ) );
}