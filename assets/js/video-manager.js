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

        // Determine content type: YouTube vs Audio vs None
        if (group.video_url) {
            const ytData     = parseYoutubeData(group.video_url);
            let videoId      = ytData.id
            let startSeconds = ytData.start

            if (startSeconds === undefined) {
                startSeconds = 0;
            }

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

                        if ( AppState.settings.isDisplayControlBar && id === AppState.state.activeId ) {
                            ControlBar.syncUI( id );
                        }
                        this.applyMobileZoom( id );
                    },
                    'onStateChange': ( e ) => this.onStateChange( e, id, card ),
                    'onError': ( e ) => {
                        console.log( "Erreur Youtube", e.data );
                        card.classList.remove( 'loading' );
                    }
                }
            } );
        } else if (group.audio) {
            // Audio Fallback
            card.classList.add( 'audio-mode' );
            if ( isAutoPlay ) this.pauseAll( id );
            this.instances[id] = new SimpleAudioPlayer(group.audio, `player-${id}`, (e) => this.onStateChange(e, id, card));
            if (AppState.state.isGlobalMuted) this.instances[id].mute();
            if (isAutoPlay) this.instances[id].playVideo();
        } else {
            // No video, no audio -> Just Image
            // We can perhaps simulate a "player" that immediately ends or does nothing?
            // Or just do nothing and let the user look at the image.
            console.log("No video or audio for event", group.event_name);
        }
    },
    onStateChange: function ( e, id, card ) {
        const s = AppState.settings;
        const tm = AppState.timers;
        const icon = card.querySelector( '.video-state-icon' );

        if ( e.data === 1 ) {
            if ( AppState.timers.iconSwap ) clearTimeout( AppState.timers.iconSwap );

            card.classList.remove( 'loading' );
            card.classList.remove( 'ended' );
            card.classList.add( 'playing' );
            card.classList.remove( 'paused-manual' );

            if ( card.classList.contains( 'audio-mode' ) ) {
                card.classList.add( 'audio-playing' );
                if ( icon ) icon.textContent = 'brand_awareness';
            }

            if ( s.isDisplayControlBar ) ControlBar.startTracking( id );

            clearTimeout( tm.menu );
            const topDrawer = document.getElementById( 'top-drawer' );
            topDrawer.classList.remove( 'auto-hidden' );
            topDrawer.style.transform = '';
            if ( s.isMenuAutoHide || isLandscape() ) {
                tm.menu = setTimeout( () => {
                    topDrawer.classList.add( 'auto-hidden' );
                }, 3000 );
            }
            if ( s.isAutoLoadVideo ) this.preloadNext( id );
        } else if ( e.data === 2 || e.data === 0 ) {
            card.classList.remove( 'loading' );
            card.classList.remove( 'audio-playing' );

            clearTimeout( tm.menu );
            document.getElementById( 'top-drawer' ).classList.remove( 'auto-hidden' );

            ControlBar.updatePlayPauseIcon( false );

            if ( e.data === 2 ) {
                if ( s.isDisplayImageVideoPause ) card.classList.remove( 'playing' );
                else card.classList.add( 'playing' );

                if ( icon ) {
                    icon.textContent = 'pause';
                    if ( AppState.timers.iconSwap ) clearTimeout( AppState.timers.iconSwap );
                    AppState.timers.iconSwap = setTimeout( () => {
                        icon.textContent = 'play_arrow';
                    }, 500 );
                }
            } else {
                ControlBar.stopTracking();
                card.classList.remove( 'playing' );

                if ( icon ) {
                    if ( AppState.timers.iconSwap ) clearTimeout( AppState.timers.iconSwap );
                    icon.textContent = 'play_arrow';
                }
            }

            card.classList.add( 'paused-manual' );

            if ( e.data === 0 ) {
                if ( s.isDisplayImageVideoEnd ) card.classList.add( 'ended' );
                this.goToNext( id );
            }
        }
    },
    play: function ( id ) {
        this.pauseAll( id );

        const card = document.getElementById( `video-${id}` );
        const icon = card ? card.querySelector( '.video-state-icon' ) : null;
        const group = AppState.data.find( g => g.id === id );
        const isAudio = group && !group.video_url && group.audio;

        if ( !isAudio && icon && card ) {
            icon.textContent = 'cached';
            card.classList.add( 'loading' );
        }

        if ( !this.instances[ id ] ) this.create( id );
        else {
            if ( typeof this.instances[ id ].playVideo === 'function' ) {
                if ( AppState.state.isGlobalMuted ) this.instances[ id ].mute();
                else this.instances[ id ].unMute();
                this.instances[ id ].playVideo();
                this.applyMobileZoom( id );
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

                    const card = document.getElementById( `video-${id}` );
                    const icon = card ? card.querySelector( '.video-state-icon' ) : null;
                    if ( card && !card.classList.contains( 'audio-mode' ) && icon ) {
                        icon.textContent = 'cached';
                        card.classList.add( 'loading' );
                    }

                    this.instances[ id ].playVideo();
                }
            }
        }
    },
    preloadNext: function ( currentId ) {
        if ( !AppState.settings.isAutoPlayNext ) return;
        const currentIndex = AppState.data.findIndex( g => g.id === currentId );
        if ( currentIndex === -1 || currentIndex >= AppState.data.length - 1 ) return;
    },
    goToNext: function ( currentId ) {
        const s = AppState.settings;
        if ( !s.isAutoPlayNext ) return;
        const favs = AppState.favorites;
        if ( AppState.state.isPlayingFavorites && favs.length > 0 ) {
            const currentFavIndex = favs.indexOf( currentId );
            let nextId;
            if ( currentFavIndex === -1 ) nextId = favs[ 0 ];
            else {
                if ( currentFavIndex >= favs.length - 1 && !s.isAutoPlayLoop ) return;
                const nextFavIndex = ( currentFavIndex + 1 ) % favs.length;
                nextId = favs[ nextFavIndex ];
            }
            AppState.state.isAutoNext = true;
            this.scrollTo( nextId );
            return;
        }
        const currentIndex = AppState.data.findIndex( g => g.id === currentId );
        if ( currentIndex >= AppState.data.length - 1 && !s.isAutoPlayLoop ) return;

        const nextIndex    = ( currentIndex + 1 ) % AppState.data.length;
        const nextId       = AppState.data[ nextIndex ].id;

        AppState.state.isAutoNext = true;
        const nextCard     = document.getElementById( `video-${nextId}` );
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
            if ( AppState.settings.isDisplayControlBar ) {
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
    },
    applyMobileZoom: function ( id ) {
        const isForce = AppState.settings.isForceZoom;
        const shouldZoom = isForce || ( isMobileDevice() && !isLandscape() );

        if ( !shouldZoom ) {
            // Reset styles if not mobile portrait or forced
            const iframe = document.getElementById( `player-${id}` );
            if ( iframe ) {
                iframe.style.width = '';
                iframe.style.left = '';
                iframe.style.transform = '';
            }
            return;
        }

        const group = AppState.data.find( g => g.id === id );
        if ( !group ) return;

        // Default or "100%" means no zoom
        const zoomValue = group.video_zoom || "100%";
        if ( zoomValue === "100%" ) return;

        const iframe = document.getElementById( `player-${id}` );
        if ( iframe ) {
            iframe.style.width = zoomValue;
            iframe.style.left = '50%';
            iframe.style.transform = 'translateX(-50%)';
        }
    }
};
