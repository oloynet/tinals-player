window.DebugTool = {
    isInit: false,
    isDarkMode: true,
    activeTab: 'infos',

    init: function() {
        if (this.isInit) return;

        // Restore active tab
        const savedTab = localStorage.getItem('debug_active_tab');
        if (savedTab) this.activeTab = savedTab;

        this.createOverlay();
        this.setupListeners();
        this.isInit = true;
        console.log( "--- DEBUG TOOL INITIALIZED ---" );
        console.log( "    is_debug_tool: true" );

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            const key = e.key.toLowerCase();
            if (key === 'd') {
                this.toggle();
            }
        });
    },

    createOverlay: function() {
        const overlay = document.createElement('div');
        overlay.id        = 'debug-overlay';
        overlay.className = 'debug-overlay'; // Default dark mode via CSS variables

        overlay.innerHTML = `
            <div class="debug-header">
                <div class="debug-tabs">
                    <button class="debug-tab-btn" data-tab="infos">Infos</button>
                    <button class="debug-tab-btn" data-tab="display">Display</button>
                    <button class="debug-tab-btn" data-tab="storage">Storage</button>
                    <button class="debug-tab-btn" data-tab="cache">Cache</button>
                    <button class="debug-tab-btn" data-tab="favicons">Favicons</button>
                    <button class="debug-tab-btn" data-tab="images">Images</button>
                    <button class="debug-tab-btn" data-tab="files">Files</button>
                    <button class="debug-tab-btn" data-tab="sprites">Sprites</button>
                    <button class="debug-tab-btn" data-tab="features">Features</button>
                    <button class="debug-tab-btn" data-tab="colors">Colors</button>
                </div>
                <div class="debug-controls">
                    <button class="debug-btn-icon" title="Full reload and clear cache" onclick="DebugTool.actionClearCache()">
                        <span class="material-icons">cached</span>
                    </button>
                    <button id="debug-theme-toggle" class="debug-btn-icon" title="Toggle Theme">
                        <span class="material-icons">dark_mode</span>
                    </button>
                    <button id="debug-close-btn" class="debug-btn-icon" title="Close">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            </div>
            <div class="debug-content">
                <div id="debug-section-infos"    class="debug-section"></div>
                <div id="debug-section-display"  class="debug-section"></div>
                <div id="debug-section-storage"  class="debug-section"></div>
                <div id="debug-section-cache"    class="debug-section"></div>
                <div id="debug-section-favicons" class="debug-section"></div>
                <div id="debug-section-images"   class="debug-section"></div>
                <div id="debug-section-files"    class="debug-section"></div>
                <div id="debug-section-sprites"  class="debug-section"></div>
                <div id="debug-section-features" class="debug-section"></div>
                <div id="debug-section-colors"   class="debug-section"></div>
            </div>
            <div id="debug-modal-container"></div>
        `;
        document.body.appendChild(overlay);
        this.switchTab(this.activeTab);
    },

    setupListeners: function() {
        const overlay = document.getElementById('debug-overlay');

        // Tab Switching
        overlay.querySelectorAll('.debug-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Theme Toggle
        document.getElementById('debug-theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Close Button
        document.getElementById('debug-close-btn').addEventListener('click', () => {
            this.close();
        });
    },

    open: function() {
        const overlay = document.getElementById('debug-overlay');
        if (overlay) {
            overlay.classList.add('active');
            this.renderAll(); // Refresh data on open
        }
    },

    close: function() {
        const overlay = document.getElementById('debug-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    toggle: function() {
        const overlay = document.getElementById('debug-overlay');
        if (overlay.classList.contains('active')) {
            this.close();
        } else {
            this.open();
        }
    },

    switchTab: function(tabId) {
        this.activeTab = tabId;
        localStorage.setItem('debug_active_tab', tabId);

        // Update Buttons
        document.querySelectorAll('.debug-tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabId) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Update Sections
        document.querySelectorAll('.debug-section').forEach(sec => {
            sec.classList.remove('active');
        });
        const targetSection = document.getElementById(`debug-section-${tabId}`);
        if(targetSection) targetSection.classList.add('active');
    },

    toggleTheme: function() {
        this.isDarkMode = !this.isDarkMode;
        const overlay = document.getElementById('debug-overlay');
        const icon    = document.querySelector('#debug-theme-toggle .material-icons');
        const svgs    = document.querySelectorAll('.debug-sprite-preview svg');

        if (this.isDarkMode) {
            icon.innerText = 'dark_mode';
            overlay.classList.remove('light-mode');

            svgs.forEach(element => {
                element.classList.add('svg-dark-mode');
            });

        } else {
            icon.innerText = 'light_mode';
            overlay.classList.add('light-mode');

            svgs.forEach(element => {
                element.classList.remove('svg-dark-mode');
            });
        }
    },

    renderAll: function() {
        this.renderInfos();
        this.renderDisplay();
        this.renderStorage();
        this.renderCache();
        this.renderFavicons();
        this.renderImages();
        this.renderFiles();
        this.renderSprites();
        this.renderFeatures();
        this.renderColors();
    },

    /* --- RENDERERS --- */

    renderInfos: function() {
        const container = document.getElementById('debug-section-infos');
        if (!container) return;

        // Meta tags check
        const googlebot = document.querySelector('meta[name="googlebot"]')?.content || 'Not found';
        const robots    = document.querySelector('meta[name="robots"]')?.content || 'Not found';

        // Memory
        let memoryInfo = 'Not available';
        if (window.performance && window.performance.memory) {
            const used  = Math.round(window.performance.memory.usedJSHeapSize  / 1024 / 1024);
            const total = Math.round(window.performance.memory.totalJSHeapSize / 1024 / 1024);
            memoryInfo = `${used} MB / ${total} MB`;
        }

        const appVersion = AppState.config.site.version || 'Unknown';
        const installedVersion = localStorage.getItem('app_version') || 'Unknown (Not stored)';

        container.innerHTML = `
            <ul class="debug-info-list">
                <li class="debug-info-item"><span class="debug-info-label">App Version</span><span class="debug-info-value">${appVersion}</span></li>
                <li class="debug-info-item"><span class="debug-info-label">Installed Version</span><span class="debug-info-value">${installedVersion}</span></li>
                <li class="debug-info-item"><span class="debug-info-label">Memory Usage</span><span class="debug-info-value">${memoryInfo}</span></li>
                <li class="debug-info-item"><span class="debug-info-label">Googlebot</span><span class="debug-info-value">${googlebot}</span></li>
                <li class="debug-info-item"><span class="debug-info-label">Robots</span><span class="debug-info-value">${robots}</span></li>
            </ul>
            <div class="debug-actions column-layout">
                <button class="debug-btn"        onclick="DebugTool.actionReload()">Full Reload</button>
                <button class="debug-btn"        onclick="DebugTool.actionCheckVersion()">Check Version</button>
                <button class="debug-btn"        onclick="DebugTool.actionForceInstall()">Force Install (PWA)</button>
                <button class="debug-btn"        onclick="DebugTool.actionForceUninstall()">Force Uninstall</button>
                <button class="debug-btn danger" onclick="DebugTool.actionClearStorage()">Clear Local Storage</button>
                <button class="debug-btn danger" onclick="DebugTool.actionClearCache()">Clear Cache Storage</button>
            </div>
        `;
    },

    renderDisplay: function() {
        const container = document.getElementById('debug-section-display');
        if (!container) return;

        const metrics     = this.getMobileMetrics();
        const metricsHtml = JSON.stringify(metrics, null, 4);

        container.innerHTML = `
            <div class="debug-info-item"><span class="debug-info-label">Browser</span><span class="debug-info-value">${navigator.userAgent}</span></div>
            <pre class="debug-code-block">${metricsHtml}</pre>
        `;
    },

    renderStorage: function() {
        const container = document.getElementById('debug-section-storage');
        if (!container) return;

        const storageData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            let value = localStorage.getItem(key);
            try {
                value = JSON.parse(value);
            } catch (e) {
                // keep as string
            }
            storageData[key] = value;
        }

        container.innerHTML = `<pre class="debug-code-block">${JSON.stringify(storageData, null, 4)}</pre>`;
    },

    renderCache: function() {
        const container = document.getElementById('debug-section-cache');
        if (!container) return;

        container.innerHTML = '<p>Loading cache data...</p>';

        Promise.all([
            this.fetchStaticAssets(),
            'caches' in window ? caches.keys() : Promise.resolve([])
        ]).then(([staticAssets, cacheNames]) => {
            let html = '';

            // 1. Static Assets from SW
            if (staticAssets.length > 0) {
                html += '<h3 style="margin: 20px 0 10px 0; color: var(--primary-color);">SW Static Assets</h3>';
                html += '<ul class="debug-info-list">';
                staticAssets.forEach(asset => {
                    html += `<li class="debug-info-item"><span class="debug-info-label">${asset}</span></li>`;
                });
                html += '</ul>';
            }

            // 2. Caches content
            if (cacheNames.length > 0) {
                const cachePromises = cacheNames.map(name => {
                    return caches.open(name).then(cache => {
                        return cache.keys().then(requests => {
                            return { name, requests };
                        });
                    });
                });

                return Promise.all(cachePromises).then(cacheDataList => {
                    cacheDataList.forEach(data => {
                        html += `<h3 style="margin: 20px 0 10px 0; color: var(--primary-color);">Cache: ${data.name} (${data.requests.length})</h3>`;
                        if (data.requests.length > 0) {
                            html += '<ul class="debug-info-list">';
                            data.requests.forEach(req => {
                                let displayUrl = req.url;
                                try {
                                    const url = new URL(req.url);
                                    displayUrl = url.pathname + url.search;
                                } catch (e) {}
                                html += `<li class="debug-info-item"><span class="debug-info-label" style="word-break: break-all;">${displayUrl}</span></li>`;
                            });
                            html += '</ul>';
                        } else {
                            html += '<p>Empty cache</p>';
                        }
                    });

                    // Add actions
                    html += `
                        <div class="debug-actions" style="margin-top: 30px;">
                            <button class="debug-btn danger" onclick="DebugTool.actionClearCache()">Delete All Caches</button>
                        </div>
                    `;
                    container.innerHTML = html;
                });
            } else {
                html += '<p>No caches found.</p>';
                html += `
                    <div class="debug-actions">
                        <button class="debug-btn danger" onclick="DebugTool.actionClearCache()">Delete All Caches</button>
                    </div>
                `;
                container.innerHTML = html;
            }
        }).catch(err => {
            container.innerHTML = `<p class="error">Error loading cache data: ${err.message}</p>`;
        });
    },

    renderFavicons: function() {
        const container = document.getElementById('debug-section-favicons');
        if (!container) return;

        const images = AppState.config.images || {};
        const keys = ['icon_192', 'icon_512', 'icon_192_maskable', 'icon_512_maskable', 'apple_touch_icon', 'favicon', 'icon_svg'];

        let html = '<div class="debug-favicon-grid">';
        keys.forEach(key => {
            if (images[key]) {
                html += `
                    <div class="debug-favicon-card">
                        <img src="${images[key]}" class="debug-favicon-img" loading="lazy">
                        <span class="debug-favicon-label">${key}</span>
                    </div>
                `;
            }
        });
        html += '</div>';
        container.innerHTML = html;
    },

    renderImages: function() {
        const container = document.getElementById('debug-section-images');
        if (!container) return;

        this.fetchStaticAssets().then(assets => {
            const imageExtensions = ['.svg', '.png', '.ico', '.webp'];
            const images = assets.filter(url => imageExtensions.some(ext => url.toLowerCase().endsWith(ext)));

            let html = '<div class="debug-image-grid">';

            // Render basic structure first
            images.forEach(url => {
                const name = url.split('/').pop();
                html += `
                    <div class="debug-image-card">
                        <img src="${url}" class="debug-image-img" loading="lazy" onload="DebugTool.updateImageSize(this)">
                        <span class="debug-image-label">${name}</span>
                        <div class="debug-image-size">Loading...</div>
                    </div>
                `;
            });

            html += '</div>';
            container.innerHTML = html;
        });
    },

    updateImageSize: function(img) {
         if (img && img.naturalWidth) {
             const sizeLabel = img.parentNode.querySelector('.debug-image-size');
             if(sizeLabel) sizeLabel.innerText = `${img.naturalWidth}x${img.naturalHeight}`;
         }
    },

    renderFiles: function() {
         const container = document.getElementById('debug-section-files');
         if (!container) return;

         this.fetchStaticAssets().then(assets => {
            const imageExtensions = ['.svg', '.png', '.ico', '.webp'];
            const files = assets.filter(url => !imageExtensions.some(ext => url.toLowerCase().endsWith(ext)));

            let html = '<div class="debug-files-grid">';
            files.forEach(url => {
                 html += `<div class="debug-file-item">${url}</div>`;
            });
            html += '</div>';
            container.innerHTML = html;
         });
    },

    fetchStaticAssets: function() {
        return fetch('service-worker.js?t=' + Date.now())
            .then(r => r.text())
            .then(text => {
                const match = text.match(/const STATIC_ASSETS = \[\s*([\s\S]*?)\s*\];/);
                if (match && match[1]) {
                    // Parse the array content roughly
                    return match[1]
                        .split(',')
                        .map(line => line.trim().replace(/['"]/g, ''))
                        .filter(line => line.length > 0);
                }
                return [];
            })
            .catch(err => {
                console.error("Error parsing service-worker.js", err);
                return [];
            });
    },

    renderSprites: function() {
        const container = document.getElementById('debug-section-sprites');
        if (!container) return;

        const spritePath = AppState.config.images.sprite_path;
        const cleanPath = spritePath.split('?')[0];
        const classColorExt  = this.isDarkMode ? 'svg-dark-mode' : '';
        const timestampedPath = `${cleanPath}?t=${Date.now()}`;

        fetch(timestampedPath)
            .then(response => response.text())
            .then(text => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'image/svg+xml');
                const symbols = doc.querySelectorAll('symbol');

                let html = '<div class="debug-sprite-grid">';
                symbols.forEach(symbol => {
                    const id       = symbol.id;
                    const viewBox  = symbol.getAttribute('viewBox') || '0 0 24 24';

                    const title = symbol.querySelector('title') ? symbol.querySelector('title').textContent : '-';
                    const desc  = symbol.querySelector('desc') ? symbol.querySelector('desc').textContent : '-';
                    const ariaLabel = symbol.getAttribute('aria-label') || '-';

                    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${symbol.innerHTML}</svg>`;
                    const blob = new Blob([svgContent], {type: 'image/svg+xml'});
                    const url = URL.createObjectURL(blob);

                    const svgClass = `svg-${id}`;

                    html += `
                        <div class="debug-sprite-card">
                            <div class="debug-sprite-preview dashed-border">
                                <svg viewBox="${viewBox}" class="${svgClass} ${classColorExt}">
                                    <use href="${spritePath}#${id}"></use>
                                </svg>
                            </div>
                            <span class="debug-sprite-id">${id}</span>
                            <div class="debug-sprite-info">
                                <div>Size: ${viewBox}</div>
                                <div>Title: ${title}</div>
                                <div>Desc: ${desc}</div>
                                <div>Aria: ${ariaLabel}</div>
                            </div>
                            <div class="debug-sprite-actions">
                                <button class="debug-btn-small" onclick="window.open('${url}', '_blank')">View</button>
                                <a href="${url}" download="${id}.svg" class="debug-btn-small" style="text-decoration:none; display:inline-block;">Download</a>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                container.innerHTML = html;
            })
            .catch(err => {
                container.innerHTML = `<p class="error">Error loading sprites: ${err.message}</p>`;
            });
    },

    renderFeatures: function() {
        const container = document.getElementById('debug-section-features');
        if (!container) return;

        const features = AppState.config.features || {};
        let html = '<div class="debug-feature-list">';

        for (const [key, value] of Object.entries(features)) {
            let displayValue = value;
            if (typeof value === 'boolean') {
                displayValue = value ? '<span style="color:var(--debug-success)">TRUE</span>' : '<span style="color:var(--debug-error)">FALSE</span>';
            } else if (Array.isArray(value)) {
                displayValue = `[${value.join(', ')}]`;
            }

            html += `
                <div class="debug-feature-item">
                    <span class="debug-feature-key">${key}</span>
                    <span class="debug-feature-value">${displayValue}</span>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    },

    renderColors: function() {
        const container = document.getElementById('debug-section-colors');
        if (!container) return;

        const variables = [
            '--primary-color', '--secondary-color', '--third-color', '--fourth-color', '--fifth-color',
            '--black-color', '--white-color',
            '--grey5-color', '--grey10-color', '--grey20-color', '--grey30-color',
            '--grey40-color', '--grey50-color', '--grey60-color', '--grey80-color', '--grey90-color',
            '--facebook-blue-color', '--instagram-dark-grey-color', '--pinterest-red-color',
            '--soundcloud-orange-color', '--spotify-green-color', '--tiktok-blue-color',
            '--youtube-red-color', '--deezer-orange-color'
        ];

        let html = '<div class="debug-color-grid">';
        const computedStyle = getComputedStyle(document.documentElement);

        variables.forEach(v => {
            const val = computedStyle.getPropertyValue(v).trim();
            html += `
                <div class="debug-color-card">
                    <div class="debug-color-swatch" style="background-color: var(${v})"></div>
                    <div class="debug-color-info">
                        <div class="debug-color-name">${v}</div>
                        <div class="debug-color-hex">${val}</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    },

    /* --- ACTIONS --- */

    showModal: function(title, message, onConfirm) {
        const container = document.getElementById('debug-modal-container');
        if(!container) return;

        const isAlert = !onConfirm;
        const confirmText = isAlert ? "OK" : "Confirm";
        const cancelBtnStyle = isAlert ? 'display:none;' : '';

        container.innerHTML = `
            <div class="debug-modal-overlay">
                <div class="debug-modal">
                    <div class="debug-modal-title">${title}</div>
                    <div class="debug-modal-message">${message}</div>
                    <div class="debug-modal-buttons">
                        <button class="debug-btn" id="debug-modal-cancel" style="${cancelBtnStyle}">Cancel</button>
                        <button class="debug-btn success" id="debug-modal-confirm">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('debug-modal-cancel').onclick = () => {
            container.innerHTML = '';
        };
        document.getElementById('debug-modal-confirm').onclick = () => {
            container.innerHTML = '';
            if (onConfirm) onConfirm();
        };
    },

    actionReload: function() {
        this.showModal("Reload", "Full Application Reload?", () => {
            window.location.reload(true);
        });
    },

    actionCheckVersion: function() {
        fetch(`./VERSION?t=${Date.now()}`)
            .then(r  => r.text())
            .then(v  => this.showModal("Version Check", `Server Version: ${v.trim()}<br>Client Version: ${AppState.config.site.version}`))
            .catch(e => this.showModal("Error", "Error checking version: " + e.message));
    },

    actionForceInstall: function() {
        this.showModal("Force Install", "Force PWA Install logic? This sets 'app_installed' to true and reloads.", () => {
            localStorage.setItem('app_installed', 'true');
            window.location.reload();
        });
    },

    actionForceUninstall: function() {
         this.showModal("Force Uninstall", "Force Uninstall logic? This removes 'app_installed' and reloads.", () => {
            localStorage.removeItem('app_installed');
            window.location.reload();
        });
    },

    actionClearStorage: function() {
        this.showModal("Clear Storage", "Clear ALL Local Storage? This will reset all preferences.", () => {
            localStorage.clear();
            window.location.reload();
        });
    },

    actionClearCache: function() {
        this.showModal("Clear Cache", "Delete ALL Caches? This will force redownload of assets.", () => {
            if ( 'caches' in window ) {
                caches.keys().then(keys => {
                    Promise.all(keys.map(key => caches.delete(key))).then(() => {
                        window.location.reload();
                    });
                });
            }
        });
    },

    /* --- HELPERS --- */

    getMobileMetrics: function() {
        const styles = getComputedStyle(document.documentElement);
        return {
            navigator: {
                appName:   navigator.appName,
                userAgent: navigator.userAgent
            },
            screen: {
                width:      window.screen.width,
                height:     window.screen.height,
                pixelRatio: window.devicePixelRatio
            },
            viewport: {
                width:  window.innerWidth,
                height: window.innerHeight
            },
            safeArea: {
                top:    styles.getPropertyValue("--sat").trim(),
                bottom: styles.getPropertyValue("--sab").trim(),
                left:   styles.getPropertyValue("--sal").trim(),
                right:  styles.getPropertyValue("--sar").trim()
            },
            status: {
                isPWA:       window.matchMedia('(display-mode: standalone)').matches,
                isDarkMode:  window.matchMedia('(prefers-color-scheme: dark)').matches,
                orientation: window.screen.orientation ? window.screen.orientation.type : 'unknown'
            }
        };
    }
};
