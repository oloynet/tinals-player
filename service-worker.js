const CACHE_NAME = 'v=1.10';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',

    './config/config_en.json',
    './config/config_fr.json',

    './data/data.json',
    './data/2025/images/bdrmm-by-stew-baxter.webp',
    './data/2025/images/deki-alem-pressbilder-bilder-horisontell.webp',
    './data/2025/images/ghostwoman-by-andrin-fretz.webp',
    './data/2025/images/john-maus-by-shawn-brackbill.webp',
    './data/2025/images/knives.webp',
    './data/2025/images/projector-mobile.webp',
    './data/2025/images/projector-thumbnail.webp',
    './data/2025/images/projector.webp',
    './data/2025/images/tea-easter.webp',
    './data/2025/images/the-murder-capital.webp',

    './assets/css/style.css',
    './assets/images/photos/tinals-2025-par-dorian-meyrieux.webp',
    './assets/images/shortcuts/flag-EN.svg',
    './assets/images/shortcuts/flag-FR.svg',
    './assets/images/sprite.svg',
    './assets/images/tinals-2018-trame-342x342-noir.svg',
    './assets/js/app.js',
    './assets/js/control-bar.js',
    './assets/js/simple-audio-player.js',
    './assets/js/video-manager.js',

    // './assets/favicon/favicon.ico',
    // './assets/favicon/favicon-16x16.png',
    // './assets/favicon/favicon-32x32.png',
    // './assets/favicon/apple-touch-icon.png'
    // './assets/favicon/android-chrome-192x192.png',
    // './assets/favicon/android-chrome-512x512.png',
    // './assets/favicon/favicon.svg',

];

self.addEventListener( 'install', ( evt ) => {
    self.skipWaiting();
    evt.waitUntil(
        caches.open( CACHE_NAME ).then( ( cache ) => {
            return cache.addAll( STATIC_ASSETS );
        } )
    );
} );

self.addEventListener( 'activate', ( evt ) => {
    evt.waitUntil(
        caches.keys().then( ( keys ) => {
            return Promise.all(
                keys.filter( ( key ) => key !== CACHE_NAME ).map( ( key ) => caches.delete( key ) )
            );
        } ).then( () => self.clients.claim() )
    );
} );

self.addEventListener( 'fetch', ( evt ) => {
            if ( evt.request.url.includes( 'youtube.com' ) || evt.request.url.includes( 'googleapis.com' ) || evt.request.url.includes( 'ytimg.com' ) ) {
                return;
            }
            evt.respondWith(
                    caches.match( evt.request ).then( ( cacheRes ) => {
                            return cacheRes || fetch( evt.request ).then( ( fetchRes ) => {
                                        return caches.open( CACHE_NAME ).then( ( cache ) => {
                    if ( fetchRes.status === 200 ) cache.put( evt.request, fetchRes.clone() );
                    return fetchRes;
                } );
            } );
        } )
    );
} );