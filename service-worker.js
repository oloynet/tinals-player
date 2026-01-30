const CACHE_NAME = 'v1.55';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',

    './config/config_en.config.json',
    './config/config_fr.json',

    './data/2026/affiche-tinals.webp',
    './data/2026/data.json',
    './data/2026/images/16-horsepower.mobile.webp',
    './data/2026/images/16-horsepower.thumbnail.webp',
    './data/2026/images/16-horsepower.webp',
    './data/2026/images/body-horror.mobile.webp',
    './data/2026/images/body-horror.thumbnail.webp',
    './data/2026/images/body-horror.webp',
    './data/2026/images/brigitte-calls-me-baby.mobile.webp',
    './data/2026/images/brigitte-calls-me-baby.thumbnail.webp',
    './data/2026/images/brigitte-calls-me-baby.webp',
    './data/2026/images/chalk.mobile.webp',
    './data/2026/images/chalk.thumbnail.webp',
    './data/2026/images/chalk.webp',
    './data/2026/images/fat-dog.mobile.webp',
    './data/2026/images/fat-dog.thumbnail.webp',
    './data/2026/images/fat-dog.webp',
    './data/2026/images/iguana-death-cult.mobile.webp',
    './data/2026/images/iguana-death-cult.thumbnail.webp',
    './data/2026/images/iguana-death-cult.webp',
    './data/2026/images/quickly-quickly.mobile.webp',
    './data/2026/images/quickly-quickly.thumbnail.webp',
    './data/2026/images/quickly-quickly.webp',
    './data/2026/images/the-sophs.mobile.webp',
    './data/2026/images/the-sophs.thumbnail.webp',
    './data/2026/images/the-sophs.webp',

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