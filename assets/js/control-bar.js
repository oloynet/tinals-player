// --- GESTION CONTROL BAR ---
const ControlBar = {
    interval: null,
    isDragging: false,

    startTracking: function ( id ) {
        this.stopTracking();

        if ( AppState.settings.isDisplayControlBar ) {
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
                const current  = player.getCurrentTime();
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
            const current  = player.getCurrentTime();
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
        const val    = document.getElementById( 'cb-slider' ).value;
        const id     = AppState.state.activeId;

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
