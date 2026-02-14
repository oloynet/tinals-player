const CACHE_NAME = 'v2.05';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',

    './assets/css/style.css',

    './assets/images/background/tinals-2018-trame-342x342-noir.svg',
    './assets/images/peoples/olivier-loynet.jpg',
    './assets/images/shortcuts/flag-EN.svg',
    './assets/images/shortcuts/flag-FR.svg',
    './assets/images/sprites/sprite.svg',

    './assets/js/app.js',
    './assets/js/control-bar.js',
    './assets/js/audio-player.js',
    './assets/js/video-manager.js',

    './assets/favicon/android-chrome-192x192.png',
    './assets/favicon/android-chrome-512x512.png',
    './assets/favicon/favicon-maskable-192x192.png',
    './assets/favicon/favicon-maskable-512x512.png',
    './assets/favicon/apple-touch-icon.png',
    './assets/favicon/favicon.ico',
    './assets/favicon/favicon.svg',

    './config/config_en.json',
    './config/config_fr.json',

    './data/2026/data.json',

    './data/2026/images/16-horsepower.artist.webp',
    './data/2026/images/16-horsepower.mobile.webp',
    './data/2026/images/16-horsepower.thumbnail.webp',
    './data/2026/images/16-horsepower.webp',
    './data/2026/images/alice-phoebe-lou.artist.webp',
    './data/2026/images/alice-phoebe-lou.mobile.webp',
    './data/2026/images/alice-phoebe-lou.thumbnail.webp',
    './data/2026/images/alice-phoebe-lou.webp',
    './data/2026/images/augusta.artist.webp',
    './data/2026/images/augusta.mobile.webp',
    './data/2026/images/augusta.thumbnail.webp',
    './data/2026/images/augusta.webp',
    './data/2026/images/bandit-bandit.artist.webp',
    './data/2026/images/bandit-bandit.mobile.webp',
    './data/2026/images/bandit-bandit.thumbnail.webp',
    './data/2026/images/bandit-bandit.webp',
    './data/2026/images/bar-italia.artist.webp',
    './data/2026/images/bar-italia.mobile.webp',
    './data/2026/images/bar-italia.thumbnail.webp',
    './data/2026/images/bar-italia.webp',
    './data/2026/images/ben-kweller.artist.webp',
    './data/2026/images/ben-kweller.mobile.webp',
    './data/2026/images/ben-kweller.thumbnail.webp',
    './data/2026/images/ben-kweller.webp',
    './data/2026/images/black-country-new-road.artist.webp',
    './data/2026/images/black-country-new-road.mobile.webp',
    './data/2026/images/black-country-new-road.thumbnail.webp',
    './data/2026/images/black-country-new-road.webp',
    './data/2026/images/body-horror.artist.webp',
    './data/2026/images/body-horror.mobile.webp',
    './data/2026/images/body-horror.thumbnail.webp',
    './data/2026/images/body-horror.webp',
    './data/2026/images/brigitte-calls-me-baby.artist.webp',
    './data/2026/images/brigitte-calls-me-baby.mobile.webp',
    './data/2026/images/brigitte-calls-me-baby.thumbnail.webp',
    './data/2026/images/brigitte-calls-me-baby.webp',
    './data/2026/images/cardinals.artist.webp',
    './data/2026/images/cardinals.mobile.webp',
    './data/2026/images/cardinals.thumbnail.webp',
    './data/2026/images/cardinals.webp',
    './data/2026/images/chalk.artist.webp',
    './data/2026/images/chalk.mobile.webp',
    './data/2026/images/chalk.thumbnail.webp',
    './data/2026/images/chalk.webp',
    './data/2026/images/fat-dog.artist.webp',
    './data/2026/images/fat-dog.mobile.webp',
    './data/2026/images/fat-dog.thumbnail.webp',
    './data/2026/images/fat-dog.webp',
    './data/2026/images/iguana-death-cult.artist.webp',
    './data/2026/images/iguana-death-cult.mobile.webp',
    './data/2026/images/iguana-death-cult.thumbnail.webp',
    './data/2026/images/iguana-death-cult.webp',
    './data/2026/images/jehnny-beth.artist.webp',
    './data/2026/images/jehnny-beth.mobile.webp',
    './data/2026/images/jehnny-beth.thumbnail.webp',
    './data/2026/images/jehnny-beth.webp',
    './data/2026/images/knives.artist.webp',
    './data/2026/images/knives.mobile.webp',
    './data/2026/images/knives.thumbnail.webp',
    './data/2026/images/knives.webp',
    './data/2026/images/la-securite.artist.webp',
    './data/2026/images/la-securite.mobile.webp',
    './data/2026/images/la-securite.thumbnail.webp',
    './data/2026/images/la-securite.webp',
    './data/2026/images/levitation-room.artist.webp',
    './data/2026/images/levitation-room.mobile.webp',
    './data/2026/images/levitation-room.thumbnail.webp',
    './data/2026/images/levitation-room.webp',
    './data/2026/images/m.a.o-cormontreuil.artist.webp',
    './data/2026/images/m.a.o-cormontreuil.mobile.webp',
    './data/2026/images/m.a.o-cormontreuil.thumbnail.webp',
    './data/2026/images/m.a.o-cormontreuil.webp',
    './data/2026/images/men-i-trust.artist.webp',
    './data/2026/images/men-i-trust.mobile.webp',
    './data/2026/images/men-i-trust.thumbnail.webp',
    './data/2026/images/men-i-trust.webp',
    './data/2026/images/meryl-streek.artist.webp',
    './data/2026/images/meryl-streek.mobile.webp',
    './data/2026/images/meryl-streek.thumbnail.webp',
    './data/2026/images/meryl-streek.webp',
    './data/2026/images/modelactriz.artist.webp',
    './data/2026/images/modelactriz.mobile.webp',
    './data/2026/images/modelactriz.thumbnail.webp',
    './data/2026/images/modelactriz.webp',
    './data/2026/images/new-dad.artist.webp',
    './data/2026/images/new-dad.mobile.webp',
    './data/2026/images/new-dad.thumbnail.webp',
    './data/2026/images/new-dad.webp',
    './data/2026/images/quickly-quickly.artist.webp',
    './data/2026/images/quickly-quickly.mobile.webp',
    './data/2026/images/quickly-quickly.thumbnail.webp',
    './data/2026/images/quickly-quickly.webp',
    './data/2026/images/shortstraw..artist.webp',
    './data/2026/images/shortstraw..mobile.webp',
    './data/2026/images/shortstraw..thumbnail.webp',
    './data/2026/images/shortstraw..webp',
    './data/2026/images/the-sophs.artist.webp',
    './data/2026/images/the-sophs.mobile.webp',
    './data/2026/images/the-sophs.thumbnail.webp',
    './data/2026/images/the-sophs.webp',
    './data/2026/images/yerai-cortes.artist.webp',
    './data/2026/images/yerai-cortes.mobile.webp',
    './data/2026/images/yerai-cortes.thumbnail.webp',
    './data/2026/images/yerai-cortes.webp',

    './data/2026/splash/affiche-tinals.webp'
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