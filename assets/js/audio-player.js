class SimpleAudioPlayer {
    constructor(audioUrl, elementId, onStateChange) {
        this.audio         = new Audio(audioUrl);
        this.elementId     = elementId;
        this.onStateChange = onStateChange; // callback expecting {data: state}
        this.container     = document.getElementById(elementId);

        // We do not append the audio element to the DOM to avoid UI clutter
        // The background image will remain visible.

        this.audio.addEventListener('play',  ()  => { if(this.onStateChange) this.onStateChange({ data: 1 }); });
        this.audio.addEventListener('pause', ()  => { if(this.onStateChange) this.onStateChange({ data: 2 }); });
        this.audio.addEventListener('ended', ()  => { if(this.onStateChange) this.onStateChange({ data: 0 }); });
        this.audio.addEventListener('error', (e) => console.error("Audio error", e));
    }

    playVideo()      { this.audio.play().catch(e => console.error(e)); }
    pauseVideo()     { this.audio.pause(); }
    mute()           { this.audio.muted = true; }
    unMute()         { this.audio.muted = false; }
    getPlayerState() {
        if (this.audio.ended) return 0;
        if (this.audio.paused) return 2;
        return 1;
    }
    getCurrentTime() { return this.audio.currentTime; }
    getDuration()    { return this.audio.duration || 0; }
    seekTo(seconds, allowSeekAhead) { this.audio.currentTime = seconds; }
}
