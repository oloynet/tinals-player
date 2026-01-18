const CACHE_NAME = 'v=1.06';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './config_en.json',
    './config_fr.json',

    './data/data.json',
    // './data/images/2025/bdrmm-by-stew-baxter.jpg',
    // './data/images/2025/deki-alem-pressbilder-bilder-horisontell.jpg',
    // './data/images/2025/ghostwoman-by-andrin-fretz.jpg',
    // './data/images/2025/john-maus-by-shawn-brackbill.jpg',
    // './data/images/2025/knives.png',
    // './data/images/2025/projector.jpg',
    // './data/images/2025/tea-easter.png',
    // './data/images/2025/the-murder-capital.jpg',


    './assets/css/style.css',
    './assets/js/app.js',
    './assets/js/simple-audio-player.js',
    './assets/js/control-bar.js',
    './assets/js/video-manager.js',
    './assets/images/sprite.svg',
    './assets/images/tinals-2018-trame-342x342-noir.svg',
    './assets/images/photos/tinals-2025-par-dorian-meyrieux.webp',

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