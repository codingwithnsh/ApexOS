/**
 * ApexOS - A Retro-Modern WebOS
 * 
 * Hey! This is the heart of the system. I've tried to keep things 
 * clean and modular, but you know how it goes when you're 
 * coding at 2 AM. 
 * 
 * "Because even code should feel like it has a soul." - Some Great Guy
 */

// --- Virtual File System (VFS) ---
let VFS = {
    "/": {
        "home": {
            "user": {
                "readme.txt": "Welcome to ApexOS. This is your first file.",
                "todo.txt": "- Write more code\n- Drink coffee\n- Conquer the web"
            }
        },
        "etc": {
            "version": "ApexOS 0.1.0"
        }
    }
};

const DB_NAME = 'ApexOS_VFS';
const STORE_NAME = 'files';

const ICON_GRID = {
    width: 100,
    height: 110,
    margin: 20,
    topOffset: 60
};
window.ICON_GRID = ICON_GRID;

const Storage = {
    db: null,
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },
    async save() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(VFS, 'root');
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    },
    async load() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get('root');
            request.onsuccess = (e) => {
                if (e.target.result) {
                    VFS = e.target.result;
                } else {
                    // Migrate from localStorage if exists
                    const saved = localStorage.getItem('apex_vfs');
                    if (saved) {
                        VFS = JSON.parse(saved);
                        this.save();
                    }
                }
                resolve(VFS);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },
    async wipe() {
        if (this.db) this.db.close();
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
};

// --- Registry System ---
const Registry = {
    HKLM: {},
    HKCU: {},
    init() {
        try {
            this.HKLM = JSON.parse(localStorage.getItem('registry_hklm') || '{}');
            this.HKCU = JSON.parse(localStorage.getItem('registry_hkcu') || '{}');
            
            // Default HKLM settings
            if (!this.HKLM['Software\\System\\Version']) {
                this.HKLM['Software\\System\\Version'] = 'ApexOS 1.5.0';
                this.HKLM['Software\\System\\Theme'] = 'theme-sleek';
                this.save();
            }
        } catch (e) {
            console.error("Registry init failed", e);
        }
    },
    save() {
        localStorage.setItem('registry_hklm', JSON.stringify(this.HKLM));
        localStorage.setItem('registry_hkcu', JSON.stringify(this.HKCU));
    },
    get(path, defaultValue = null) {
        if (path.startsWith('HKLM\\')) return this.HKLM[path.substring(5)] ?? defaultValue;
        if (path.startsWith('HKCU\\')) return this.HKCU[path.substring(5)] ?? defaultValue;
        return defaultValue;
    },
    set(path, value) {
        if (path.startsWith('HKLM\\')) this.HKLM[path.substring(5)] = value;
        else if (path.startsWith('HKCU\\')) this.HKCU[path.substring(5)] = value;
        this.save();
    }
};

// --- Process Manager ---
const ProcessManager = {
    processes: [],
    nextPid: 101,
    init() {
        this.processes = [];
    },
    createProcess(name, appKey) {
        const proc = {
            pid: this.nextPid++,
            name: name,
            appKey: appKey,
            cpu: 0,
            memory: Math.floor(Math.random() * 50) + 15,
            status: 'Running'
        };
        this.processes.push(proc);
        return proc;
    },
    killProcess(pid) {
        this.processes = this.processes.filter(p => p.pid !== pid);
    },
    getProcesses() {
        // Simulate CPU
        this.processes.forEach(p => {
            p.cpu = Math.floor(Math.random() * 12) + 1;
        });
        return this.processes;
    }
};

// --- Services Manager ---
const ServicesManager = {
    services: [
        { name: "Network Service", status: "Running", id: 'network' },
        { name: "Audio Service", status: "Running", id: 'audio' },
        { name: "Clock Service", status: "Running", id: 'clock' },
        { name: "Theme Service", status: "Running", id: 'theme' }
    ],
    init() {
        console.log("Kernel: Services initialized");
    },
    start(id) {
        const s = this.services.find(s => s.id === id);
        if (s) s.status = "Running";
    },
    stop(id) {
        const s = this.services.find(s => s.id === id);
        if (s) s.status = "Stopped";
    }
};

const Kernel = {
    Filesystem: {
        currentDir: "/home/user",
        resolvePath(path) {
            if (!path) return this.currentDir;
            let absolute = path.startsWith('/') ? path : (this.currentDir === '/' ? '/' + path : this.currentDir + '/' + path);
            const parts = absolute.split('/').filter(p => p);
            const resolvedParts = [];
            for (const part of parts) {
                if (part === '.') continue;
                if (part === '..') { resolvedParts.pop(); }
                else { resolvedParts.push(part); }
            }
            return '/' + resolvedParts.join('/');
        },
        getDirObj(path = this.currentDir) {
            let current = VFS["/"];
            const resolved = this.resolvePath(path);
            const parts = resolved.split('/').filter(p => p);
            for (const part of parts) {
                if (current[part] && typeof current[part] === 'object') {
                    current = current[part];
                } else {
                    return null;
                }
            }
            return current;
        },
        getFile(path) {
            const resolved = this.resolvePath(path);
            const parts = resolved.split('/').filter(p => p);
            const fileName = parts.pop();
            const dirPath = '/' + parts.join('/');
            const dir = this.getDirObj(dirPath);
            return (dir && typeof dir[fileName] !== 'object') ? dir[fileName] : null;
        },
        async saveFile(path, content) {
            const resolved = this.resolvePath(path);
            const parts = resolved.split('/').filter(p => p);
            const fileName = parts.pop();
            const dirPath = '/' + parts.join('/');
            const dir = this.getDirObj(dirPath);
            if (dir) {
                dir[fileName] = content;
                await Storage.save();
                System.refreshDesktopIcons();
                console.log(`Saved ${path}`);
                System.notify(`File saved: ${path}`);
                return true;
            }
            return false;
        },
        async deleteFile(path) {
            const resolved = this.resolvePath(path);
            const parts = resolved.split('/').filter(p => p);
            const fileName = parts.pop();
            const dirPath = '/' + parts.join('/');
            const dir = this.getDirObj(dirPath);
            if (dir && dir[fileName] !== undefined) {
                delete dir[fileName];
                await Storage.save();
                return true;
            }
            return false;
        },
        async makeDir(path) {
            const resolved = this.resolvePath(path);
            const parts = resolved.split('/').filter(p => p);
            const dirName = parts.pop();
            const parentPath = '/' + parts.join('/');
            const parentDir = this.getDirObj(parentPath);
            if (parentDir && !parentDir[dirName]) {
                parentDir[dirName] = {};
                await Storage.save();
                return true;
            }
            return false;
        },
        async rename(path, newName) {
            const dir = this.getDirObj();
            if (dir && dir[path] !== undefined) {
                dir[newName] = dir[path];
                delete dir[path];
                await Storage.save();
                return true;
            }
            return false;
        },
        listDir(path) {
            const dir = this.getDirObj(path);
            if (!dir) return "Directory not found";
            return Object.keys(dir).map(name => {
                const isDir = typeof dir[name] === 'object';
                return isDir ? `<span style="color:#5c5cff">[DIR] ${name}</span>` : name;
            }).join("  ");
        }
    },
    Registry: Registry,
    ProcessManager: ProcessManager,
    Services: ServicesManager,
    WindowManager: null,

    get currentDir() { return this.Filesystem.currentDir; },
    set currentDir(val) { this.Filesystem.currentDir = val; },
    getDirObj(path) { return this.Filesystem.getDirObj(path); },
    getFile(path) { return this.Filesystem.getFile(path); },
    async saveFile(path, content) { return this.Filesystem.saveFile(path, content); },
    async deleteFile(path) { return this.Filesystem.deleteFile(path); },
    async makeDir(name) { return this.Filesystem.makeDir(name); },
    listDir(path) { return this.Filesystem.listDir(path); },
    async downloadFile(path) {
        const content = this.getFile(path);
        if (content !== null) {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = path;
            a.click();
            URL.revokeObjectURL(url);
            System.notify(`Downloading ${path}...`, "info");
        }
    },
    async uploadFile(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            await this.saveFile(file.name, e.target.result);
            System.notify(`Uploaded ${file.name}`, "success");
        };
        reader.readAsText(file);
    },

    async boot() {
        this.Registry.init();
        this.ProcessManager.init();
        this.Services.init();
        this.WindowManager = wm;

        await Storage.load(); // Grab user's files before we start the show

        // Let's play the boot sound
        const bootSound = new Audio('assets/boot-sound.wav');
        bootSound.play().catch(e => console.log("Audio play failed:", e));
        
        // --- Apply System Settings ---
        const savedTheme = this.Registry.get('HKLM\\Software\\System\\Theme', 'theme-sleek');
        document.body.className = savedTheme;

        const savedAccent = this.Registry.get('HKCU\\Control Panel\\Colors\\Accent', '');
        if (savedAccent) document.documentElement.style.setProperty('--accent-color', savedAccent);

        const savedFont = this.Registry.get('HKCU\\Control Panel\\Desktop\\Font', 'default');
        if (savedFont !== 'default') document.documentElement.style.setProperty('--font-main', savedFont);

        const savedWallpaper = this.Registry.get('HKCU\\Control Panel\\Desktop\\Wallpaper', '');
        if (savedWallpaper && document.body.classList.contains('theme-sleek')) {
            document.body.style.backgroundImage = `url('${savedWallpaper}')`;
        }

        // Apply Hardware Settings
        const savedBrightness = this.Registry.get('HKCU\\Control Panel\\Desktop\\Brightness', 100);
        System.setBrightness(savedBrightness, true);

        const savedVolume = this.Registry.get('HKCU\\Control Panel\\Desktop\\Volume', 80);
        System.setVolume(savedVolume, true);

        if (this.Registry.get('HKCU\\Control Panel\\ControlCenter\\Night Light', false)) {
            let overlay = document.getElementById('night-light-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'night-light-overlay';
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'block';
        }

        // Accessibility
        if (this.Registry.get('HKCU\\Control Panel\\Accessibility\\HighContrast', false)) document.body.classList.add('accessibility-high-contrast');
        if (this.Registry.get('HKCU\\Control Panel\\Accessibility\\LargeText', false)) document.body.classList.add('accessibility-large-text');
        if (this.Registry.get('HKCU\\Control Panel\\Accessibility\\NoAnimations', false)) document.body.classList.add('accessibility-no-animations');

        // User Profile
        const username = this.Registry.get('HKCU\\Software\\ApexOS\\User\\Name', 'Apex User');
        const userSpan = document.querySelector('.user-info span');
        const userAvatar = document.querySelector('.user-avatar');
        if (userSpan) userSpan.textContent = username;
        if (userAvatar) userAvatar.textContent = username[0];

        const logContainer = document.getElementById('boot-log');
        const bootScreen = document.getElementById('boot-screen');
        const desktop = document.getElementById('desktop');

        // I hate waiting for boot screens when I'm debugging,
        // so let's skip it if they've already seen it this session.
        const skipBoot = sessionStorage.getItem('apex_booted');
        const waitMult = skipBoot ? 0.1 : 1;

        for (const log of this.bootLogs) {
            await this.sleep((Math.random() * 500 + 200) * waitMult);
            const p = document.createElement('p');
            p.textContent = `> ${log}`;
            logContainer.appendChild(p);
        }

        if (!skipBoot) await this.sleep(1000);
        bootScreen.classList.add('hidden');
        desktop.classList.remove('hidden');
        sessionStorage.setItem('apex_booted', 'true');
        
        // Ensure icons are refreshed AFTER desktop is shown
        if (System.refreshDesktopIcons) System.refreshDesktopIcons();
        
        this.startClock();
        System.setupShortcuts();
        System.notify("System booted successfully", "success");
        // Startup Sound Mock
        console.log("🔊 Playing Startup Sound...");
    },

    bootLogs: [
        "Initializing ApexKernel v0.1.0...",
        "Checking VFS integrity...",
        "Mounting /home/user...",
        "Loading ApexWindowManager...",
        "Starting desktop environment...",
        "System Ready."
    ],

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    startClock() {
        const clock = document.getElementById('clock');
        clock.onclick = () => this.showCalendar();
        clock.title = new Date().toDateString();
        setInterval(() => {
            const now = new Date();
            clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            clock.title = now.toDateString();
            this.updateSystemStats();
            this.updateNetworkStatus();
        }, 1000);
        this.initBattery();
        this.updateNetworkStatus();
    },

    updateNetworkStatus() {
        const stats = document.getElementById('sys-stats');
        const netIcon = navigator.onLine ? '🌐' : '🚫';
        const currentStats = stats.textContent.split('|').pop().trim();
        stats.innerHTML = `${netIcon} | ${currentStats}`;
    },

    initBattery() {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                const update = () => {
                    const level = Math.floor(battery.level * 100);
                    document.getElementById('bat-status').textContent = `🔋${level}%`;
                };
                battery.addEventListener('levelchange', update);
                update();
            });
        }
    },

    updateSystemStats() {
        const stats = document.getElementById('sys-stats');
        const mem = (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : Math.floor(Math.random() * 500 + 200)) + 'MB';
        const netIcon = navigator.onLine ? '🌐' : '🚫';
        stats.textContent = `${netIcon} | RAM: ${mem}`;
    },

    showCalendar() {
        const now = new Date();
        const content = `
            <div style="text-align:center; padding:10px">
                <h3 style="color:var(--accent-color)">${now.toDateString()}</h3>
                <div style="font-size:2em; margin:10px 0">${now.toLocaleTimeString()}</div>
                <p>ApexOS System Time</p>
                <hr style="border:0; border-top:1px solid #333; margin:15px 0">
                <p style="font-size:0.8em; opacity:0.7; font-style:italic">"Time is what we want most, but what we use worst."</p>
            </div>
        `;
        wm.createWindow("Clock", content, 300, 250, 'clock');
    }
};

// --- Window Management ---
// I'm keeping this simple but expandable. Using a class for this 
// was a good call—makes managing multiple instances way less of a headache.

// --- System Utilities ---
// Handling notifications, shortcuts, and core system tasks.
const System = {
    notifications: [],
    
    notify(message, type = 'info') {
        const id = Date.now();
        const notification = { id, message, type, time: new Date().toLocaleTimeString() };
        this.notifications.push(notification);
        
        // Update Registry History
        let history = Kernel.Registry.get('HKCU\\Software\\Notifications\\History', []);
        history.push(notification);
        if (history.length > 20) history.shift();
        Kernel.Registry.set('HKCU\\Software\\Notifications\\History', history);

        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `notification toast-${type}`;
        toast.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px">
                <span style="font-weight:bold">${type.toUpperCase()}</span>
                <span style="font-size:0.7em; opacity:0.6">${notification.time}</span>
            </div>
            <div>${message}</div>
        `;
        
        container.appendChild(toast);
        
        // Sound effect based on type
        if (type === 'error' || type === 'warning') {
            console.log("🔊 Playing alert sound...");
        }
        
        setTimeout(() => {
            toast.style.animation = 'notifySlideIn 0.3s ease-in reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    showNotificationHistory() {
        const history = Kernel.Registry.get('HKCU\\Software\\Notifications\\History', []);
        let content = `<div style="padding:15px; color:white">
            <h3>Notification History</h3>
            ${history.length === 0 ? '<p>No notifications yet.</p>' : ''}
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px">
        `;
        
        history.reverse().forEach(n => {
            content += `
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; border-left:4px solid var(--accent-color)">
                    <div style="display:flex; justify-content:space-between; font-size:0.8em; margin-bottom:5px">
                        <span style="color:var(--accent-color); font-weight:bold">${n.type.toUpperCase()}</span>
                        <span style="opacity:0.6">${n.time}</span>
                    </div>
                    <div>${n.message}</div>
                </div>
            `;
        });
        
        content += `</div></div>`;
        wm.createWindow("Notification Center", content, 350, 450, 'settings');
    },

    toggleControlCenter() {
        const cc = document.getElementById('control-center');
        cc.classList.toggle('hidden');
        if (!cc.classList.contains('hidden')) {
            // Update active states
            cc.querySelectorAll('.cc-tile').forEach(tile => {
                const feature = tile.querySelector('span:last-child').textContent;
                if (Kernel.Registry.get(`HKCU\\Control Panel\\ControlCenter\\${feature}`, false)) {
                    tile.classList.add('active');
                } else {
                    tile.classList.remove('active');
                }
            });
        }
    },

    setBrightness(val, silent = false) {
        let overlay = document.getElementById('brightness-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'brightness-overlay';
            document.body.appendChild(overlay);
        }
        overlay.style.opacity = (100 - val) / 100;
        Kernel.Registry.set('HKCU\\Control Panel\\Desktop\\Brightness', val);
        const slider = document.getElementById('brightness-slider');
        if (slider) slider.value = val;
    },

    setVolume(val, silent = false) {
        this.volume = val;
        Kernel.Registry.set('HKCU\\Control Panel\\Desktop\\Volume', val);
        const slider = document.getElementById('volume-slider');
        if (slider) slider.value = val;
        if (!silent) this.notify(`Volume set to ${val}%`, 'info');
    },

    toggleNightLight() {
        let overlay = document.getElementById('night-light-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'night-light-overlay';
            document.body.appendChild(overlay);
        }
        const isActive = overlay.style.display === 'block';
        overlay.style.display = isActive ? 'none' : 'block';
        Kernel.Registry.set('HKCU\\Control Panel\\ControlCenter\\Night Light', !isActive);
        this.notify(`Night Light ${!isActive ? 'Enabled' : 'Disabled'}`, 'info');
    },

    toggleSpotlight() {
        let spotlight = document.getElementById('spotlight-search');
        if (spotlight) {
            spotlight.remove();
            return;
        }

        spotlight = document.createElement('div');
        spotlight.id = 'spotlight-search';
        spotlight.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            width: 600px;
            background: rgba(20, 20, 20, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            z-index: 10000;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            padding: 20px;
            color: white;
        `;

        spotlight.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:15px">
                <span style="font-size:1.5em">🔍</span>
                <input type="text" id="spotlight-input" placeholder="Search apps, files, or web..." style="flex:1; background:transparent; border:none; color:white; font-size:1.2em; outline:none">
            </div>
            <div id="spotlight-results" style="margin-top:15px; max-height:400px; overflow-y:auto"></div>
        `;

        document.body.appendChild(spotlight);
        const input = document.getElementById('spotlight-input');
        const results = document.getElementById('spotlight-results');

        input.focus();

        input.oninput = (e) => {
            const query = e.target.value.toLowerCase();
            if (!query) {
                results.innerHTML = '';
                return;
            }

            let html = '';
            
            // Search Apps
            const matchedApps = Object.keys(Apps).filter(key => Apps[key].title.toLowerCase().includes(query));
            if (matchedApps.length > 0) {
                html += `<div style="font-size:0.8em; opacity:0.5; margin-bottom:10px; text-transform:uppercase">Applications</div>`;
                matchedApps.forEach(key => {
                    html += `
                        <div class="spotlight-item" onclick="Apps.${key}.launch(); document.getElementById('spotlight-search').remove();" style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; cursor:pointer">
                            <img src="${Apps[key].icon}" style="width:24px; height:24px">
                            <span>${Apps[key].title}</span>
                        </div>
                    `;
                });
            }

            // Search Files (IndexedDB aware)
            const matchedFiles = [];
            const searchDir = (dir, path) => {
                for (const key in dir) {
                    if (typeof dir[key] === 'object') {
                        searchDir(dir[key], path + (path === '/' ? '' : '/') + key);
                    } else if (key.toLowerCase().includes(query)) {
                        matchedFiles.push({ name: key, path: path + (path === '/' ? '' : '/') + key });
                    }
                }
            };
            searchDir(VFS, "");

            if (matchedFiles.length > 0) {
                html += `<div style="font-size:0.8em; opacity:0.5; margin:15px 0 10px 0; text-transform:uppercase">Files</div>`;
                matchedFiles.forEach(file => {
                    html += `
                        <div class="spotlight-item" onclick="Apps.editor.launch('${file.name}'); document.getElementById('spotlight-search').remove();" style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; cursor:pointer">
                            <span>📄</span>
                            <span>${file.name}</span>
                            <span style="font-size:0.7em; opacity:0.4">${file.path}</span>
                        </div>
                    `;
                });
            }

            results.innerHTML = html;
        };

        input.onkeydown = (e) => {
            if (e.key === 'Escape') spotlight.remove();
        };
    },

    openClipboardManager() {
        const winId = `clipboard-${Date.now()}`;
        wm.createWindow("Clipboard Manager", `
            <div style="padding:15px">
                <div style="font-size:0.8em; opacity:0.6; margin-bottom:15px">Recent items from your clipboard (mocked)</div>
                <div id="${winId}-list" style="display:flex; flex-direction:column; gap:10px">
                    <div class="clip-item" style="padding:10px; background:rgba(255,255,255,0.05); border-radius:5px; cursor:pointer">https://apexos.dev/docs</div>
                    <div class="clip-item" style="padding:10px; background:rgba(255,255,255,0.05); border-radius:5px; cursor:pointer">const greeting = "Hello ApexOS";</div>
                    <div class="clip-item" style="padding:10px; background:rgba(255,255,255,0.05); border-radius:5px; cursor:pointer">#f39c12</div>
                </div>
            </div>
        `, 300, 400, 'clipboard');
    },

    toggleWifi() {
        const current = Kernel.Registry.get('HKCU\\Control Panel\\ControlCenter\\WiFi', false);
        Kernel.Registry.set('HKCU\\Control Panel\\ControlCenter\\WiFi', !current);
        this.notify(`WiFi ${!current ? 'Connected' : 'Disconnected'}`, 'info');
        this.updateNetworkStatus();
    },

    toggleBluetooth() {
        const current = Kernel.Registry.get('HKCU\\Control Panel\\ControlCenter\\Bluetooth', false);
        Kernel.Registry.set('HKCU\\Control Panel\\ControlCenter\\Bluetooth', !current);
        this.notify(`Bluetooth ${!current ? 'Enabled' : 'Disabled'}`, 'info');
    },

    toggleAirplane() {
        const current = Kernel.Registry.get('HKCU\\Control Panel\\ControlCenter\\Airplane', false);
        Kernel.Registry.set('HKCU\\Control Panel\\ControlCenter\\Airplane', !current);
        this.notify(`Airplane Mode ${!current ? 'Enabled' : 'Disabled'}`, 'info');
    },

    lockScreen() {
        const ls = document.getElementById('lock-screen');
        ls.classList.remove('hidden');
        this.updateLockTime();
        this.lockInterval = setInterval(() => this.updateLockTime(), 60000);
        
        const passInput = document.getElementById('lock-pass');
        passInput.value = '';
        passInput.focus();
        passInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                if (passInput.value.toLowerCase() === 'apex') {
                    this.unlockScreen();
                } else {
                    document.getElementById('lock-msg').textContent = 'Incorrect Password!';
                    document.getElementById('lock-msg').style.color = '#ff4444';
                    setTimeout(() => {
                        document.getElementById('lock-msg').textContent = 'Press Enter to Unlock';
                        document.getElementById('lock-msg').style.color = '';
                    }, 2000);
                }
            }
        };
    },

    unlockScreen() {
        document.getElementById('lock-screen').classList.add('hidden');
        clearInterval(this.lockInterval);
    },

    updateLockTime() {
        const now = new Date();
        document.getElementById('lock-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.getElementById('lock-date').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    },

    launchRunDialog() {
        if (document.getElementById('run-dialog')) return;

        const dialog = document.createElement('div');
        dialog.id = 'run-dialog';
        dialog.style = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(20,20,20,0.9); backdrop-filter:blur(20px); padding:20px; border-radius:15px; border:1px solid var(--accent-color); z-index:12000; width:400px; box-shadow:0 0 50px rgba(0,0,0,0.8)";
        dialog.innerHTML = `
            <div style="margin-bottom:15px; font-weight:bold; color:var(--accent-color)">Run Command</div>
            <div style="display:flex; align-items:center">
                <span style="color:var(--accent-color); margin-right:10px">></span>
                <input type="text" id="run-input" placeholder="Type app name (terminal, calc, etc.)" style="background:transparent; border:none; border-bottom:1px solid #444; color:white; flex:1; outline:none; font-family:inherit" autofocus>
            </div>
        `;
        document.body.appendChild(dialog);

        const input = document.getElementById('run-input');
        input.focus();

        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const val = input.value.trim().toLowerCase();
                if (Apps[val]) {
                    Apps[val].launch();
                } else {
                    this.notify(`App not found: ${val}`, 'error');
                }
                dialog.remove();
            } else if (e.key === 'Escape') {
                dialog.remove();
            }
        };
    },

    setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Spotlight Search (Cmd/Win + Space)
            if (e.metaKey && e.code === 'Space') {
                e.preventDefault();
                System.toggleSpotlight();
            }

            // Clipboard Manager (Cmd/Win + V) - Mock
            if (e.metaKey && e.key.toLowerCase() === 'v' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                System.openClipboardManager();
            }
            this.konami = this.konami || [];
            this.konami.push(e.key);
            this.konami = this.konami.slice(-10);
            if (this.konami.join(',') === 'ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a') {
                this.notify("EASTER EGG: God Mode Enabled!", "success");
                document.body.style.filter = 'hue-rotate(180deg)';
            }

            // Win + L: Lock
            if (e.metaKey && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                this.lockScreen();
            }
            // Win + R: Run
            if (e.metaKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                this.launchRunDialog();
            }
            // Win + D: Show Desktop
            if (e.metaKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                wm.showDesktop();
            }
            // Alt + T: Terminal
            if (e.altKey && e.key.toLowerCase() === 't') {
                e.preventDefault();
                Apps.terminal.launch();
            }
            // Alt + Tab: Switch windows (mock)
            if (e.altKey && e.key === 'Tab') {
                e.preventDefault();
                this.notify("Alt+Tab switching is coming soon!", "info");
            }
            // Escape: Close Menus
            if (e.key === 'Escape') {
                document.getElementById('start-menu').classList.add('hidden');
                document.getElementById('control-center').classList.add('hidden');
                document.getElementById('power-menu').classList.add('hidden');
                const runDialog = document.getElementById('run-dialog');
                if (runDialog) runDialog.remove();
            }
        });
    },

    togglePowerMenu() {
        document.getElementById('power-menu').classList.toggle('hidden');
    },

    sortIcons() {
        const appsWithIcons = ["terminal", "browser", "explorer", "editor", "notes", "calc", "clock", "settings", "snake", "paint", "weather", "media"];
        appsWithIcons.forEach(appKey => {
            localStorage.removeItem(`icon-pos-${appKey}`);
        });
        if (this.refreshDesktopIcons) {
            console.log("Forcing icon sort and refresh...");
            this.refreshDesktopIcons();
        }
    }
};

class WindowManager {
    constructor() {
        this.container = document.getElementById('window-container');
        this.windows = [];
        this.zIndexCounter = 200;
        this.currentDesktop = 1;
    }

    createWindow(title, content, width = 400, height = 300, appKey = null) {
        const proc = Kernel.ProcessManager.createProcess(title, appKey);
        const id = `win-proc-${proc.pid}`;
        const win = document.createElement('div');
        win.className = 'window';
        win.id = id;
        win.setAttribute('data-app-key', appKey);
        win.setAttribute('data-pid', proc.pid);
        
        const winWidth = width;
        const winHeight = height;
        const left = (window.innerWidth - winWidth) / 2;
        const top = (window.innerHeight - winHeight) / 2;
        const offset = this.windows.filter(w => w.desktop === this.currentDesktop).length * 20;
        
        win.style.width = `${winWidth}px`;
        win.style.height = `${winHeight}px`;
        win.style.top = `${top + offset}px`;
        win.style.left = `${left + offset}px`;
        win.style.zIndex = this.zIndexCounter++;

        win.innerHTML = `
            <div class="window-header">
                <span class="window-title">${title}</span>
                <div class="window-controls">
                    <span class="control-btn min-btn" title="Minimize">_</span>
                    <span class="control-btn max-btn" title="Maximize">[]</span>
                    <span class="control-btn close-btn" title="Close">X</span>
                </div>
            </div>
            <div class="window-content">${content}</div>
        `;

        win.querySelector('.close-btn').onclick = (e) => {
            e.stopPropagation();
            win.remove();
            Kernel.ProcessManager.killProcess(proc.pid);
            this.windows = this.windows.filter(w => w.id !== id);
            this.updateTaskbar();
        };

        win.querySelector('.min-btn').onclick = (e) => {
            e.stopPropagation();
            win.classList.add('minimized');
            this.updateTaskbar();
        };

        win.querySelector('.max-btn').onclick = (e) => {
            e.stopPropagation();
            this.maximizeWindow(win);
        };

        win.onmousedown = (e) => {
            if (!win.classList.contains('minimized')) {
                win.style.zIndex = this.zIndexCounter++;
            }
        };

        this.makeDraggable(win);
        this.container.appendChild(win);
        const winObj = { id, title, element: win, appKey, pid: proc.pid, desktop: this.currentDesktop };
        this.windows.push(winObj);
        this.updateTaskbar();
        return win;
    }

    maximizeWindow(win) {
        const isMax = win.classList.toggle('maximized');
        const btn = win.querySelector('.max-btn');
        btn.textContent = isMax ? '❐' : '[]';
        btn.title = isMax ? 'Restore' : 'Maximize';
        if (isMax) {
            win.dataset.oldStyle = win.style.cssText;
            win.style.top = '0';
            win.style.left = '0';
            win.style.width = '100%';
            win.style.height = 'calc(100% - 40px)';
        } else if (win.dataset.oldStyle) {
            win.style.cssText = win.dataset.oldStyle;
        }
    }

    switchDesktop(n) {
        this.currentDesktop = n;
        this.windows.forEach(w => {
            if (w.desktop === n) {
                w.element.style.display = 'flex';
            } else {
                w.element.style.display = 'none';
            }
        });
        System.notify(`Switched to Desktop ${n}`, 'info');
    }

    updateTaskbar() {
        const activeApps = document.getElementById('active-apps');
        activeApps.innerHTML = '';
        this.windows.forEach(w => {
            const btn = document.createElement('div');
            btn.className = 'taskbar-item';
            if (w.element.classList.contains('minimized')) {
                btn.style.opacity = '0.5';
            }
            
            // Try to add icon if we have it
            if (w.appKey && Apps[w.appKey]) {
                const icon = document.createElement('img');
                icon.src = Apps[w.appKey].icon;
                icon.style.width = '16px';
                icon.style.height = '16px';
                icon.style.marginRight = '5px';
                btn.appendChild(icon);
            }

            const label = document.createElement('span');
            label.textContent = w.title;
            btn.appendChild(label);

            btn.onclick = () => {
                if (w.element.classList.contains('minimized')) {
                    w.element.classList.remove('minimized');
                }
                w.element.style.zIndex = this.zIndexCounter++;
            };
            activeApps.appendChild(btn);
        });
    }

    showDesktop() {
        const allMinimized = this.windows.every(w => w.element.classList.contains('minimized'));
        
        this.windows.forEach(w => {
            if (allMinimized) {
                w.element.classList.remove('minimized');
            } else {
                w.element.classList.add('minimized');
            }
        });
        this.updateTaskbar();
    }

    makeDraggable(element, isIcon = false) {
        const handle = isIcon ? element : element.querySelector('.window-header');
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left click
            
            // For icons, we might want to bring them to front or just handle the drag
            if (isIcon) {
                if (element.style.position !== 'absolute') {
                    const rect = element.getBoundingClientRect();
                    const parentRect = element.parentElement.getBoundingClientRect();
                    element.style.left = (rect.left - parentRect.left) + 'px';
                    element.style.top = (rect.top - parentRect.top) + 'px';
                    element.style.position = 'absolute';
                }
                element.style.zIndex = 1000;
            } else {
                element.style.zIndex = this.zIndexCounter++;
                e.preventDefault(); // Only prevent default for windows to avoid text selection
            }

            pos3 = e.clientX;
            pos4 = e.clientY;
            const mouseUpHandler = (e) => {
                document.removeEventListener('mouseup', mouseUpHandler);
                document.removeEventListener('mousemove', elementDrag);

                if (isIcon) {
                    element.style.zIndex = 150; // Match the new container z-index
                    
                    // Snap to grid
                    const left = parseInt(element.style.left);
                    const top = parseInt(element.style.top);
                    const grid = typeof ICON_GRID !== 'undefined' ? ICON_GRID : (window.ICON_GRID || { margin: 20, width: 100, topOffset: 60, height: 110 });
                    const snappedLeft = Math.round((left - grid.margin) / grid.width) * grid.width + grid.margin;
                    const snappedTop = Math.round((top - grid.topOffset) / grid.height) * grid.height + grid.topOffset;
                    
                    element.style.left = `${snappedLeft}px`;
                    element.style.top = `${snappedTop}px`;

                    // Save position
                    const appKey = element.getAttribute('data-app');
                    localStorage.setItem(`icon-pos-${appKey}`, JSON.stringify({
                        top: element.style.top,
                        left: element.style.left
                    }));
                } else {
                    element.style.border = "";
                    // Snap to Top -> Maximize
                    if (e.clientY < 10) {
                        element.classList.add('maximized');
                        element.querySelector('.max-btn').textContent = '❐';
                    } 
                    // Snap to Left -> Half Screen Left
                    else if (e.clientX < 10) {
                        element.style.top = '0';
                        element.style.left = '0';
                        element.style.width = '50%';
                        element.style.height = '100%';
                    }
                    // Snap to Right -> Half Screen Right
                    else if (e.clientX > window.innerWidth - 10) {
                        element.style.top = '0';
                        element.style.left = '50%';
                        element.style.width = '50%';
                        element.style.height = '100%';
                    }
                }
            };

            const elementDrag = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;

                if (!isIcon && element.classList.contains('maximized')) {
                    // If moving while maximized, restore and follow mouse
                    element.classList.remove('maximized');
                    element.style.width = '400px';
                    element.style.height = '300px';
                }

                element.style.top = (element.offsetTop - pos2) + "px";
                element.style.left = (element.offsetLeft - pos1) + "px";

                // Visual feedback for snapping
                if (!isIcon) {
                    if (e.clientY < 10) {
                        element.style.borderTop = "4px solid var(--accent-color)";
                    } else if (e.clientX < 10 || e.clientX > window.innerWidth - 10) {
                        element.style.borderLeft = e.clientX < 10 ? "4px solid var(--accent-color)" : "";
                        element.style.borderRight = e.clientX > window.innerWidth - 10 ? "4px solid var(--accent-color)" : "";
                    } else {
                        element.style.border = "";
                    }
                }
            };

            document.addEventListener('mouseup', mouseUpHandler);
            document.addEventListener('mousemove', elementDrag);
        });
    }
}

// Initializing things
let wm;

const Apps = {
    terminal: {
        title: "Apex Terminal",
        icon: "assets/terminal.png",
        launch: () => {
            const id = `term-${Date.now()}`;
            wm.createWindow("Terminal", `
                <div class="terminal-output" id="${id}-out" style="height:calc(100% - 30px); overflow-y:auto; font-family:'Courier New', monospace; padding:10px; font-size:0.9em">ApexOS Shell v1.5\nType 'help' for commands.</div>
                <div class="terminal-input-line" style="display:flex; align-items:center; padding:5px 10px; background:rgba(0,0,0,0.3)">
                    <span style="color:var(--accent-color); margin-right:5px">></span>
                    <input type="text" class="terminal-input" id="${id}-in" style="background:transparent; border:none; color:white; flex:1; outline:none; font-family:inherit" autofocus>
                </div>
            `, 600, 400, 'terminal');

            const input = document.getElementById(`${id}-in`);
            const output = document.getElementById(`${id}-out`);
            let history = JSON.parse(localStorage.getItem('terminal_history') || '[]');
            let historyIndex = history.length;

            input.onkeydown = (e) => {
                if (e.key === "Enter") {
                    const cmdInput = input.value.trim();
                    const cmd = cmdInput.toLowerCase();
                    if (cmdInput) {
                        history.push(cmdInput);
                        if (history.length > 50) history.shift();
                        localStorage.setItem('terminal_history', JSON.stringify(history));
                    }
                    historyIndex = history.length;

                    output.innerHTML += `<div><span style="color:var(--accent-color)">></span> ${cmdInput}</div>`;
                    
                    const parseArgs = (input) => {
                        const args = [];
                        let current = "";
                        let inQuotes = false;
                        for (let i = 0; i < input.length; i++) {
                            const char = input[i];
                            if (char === '"') { inQuotes = !inQuotes; }
                            else if (char === ' ' && !inQuotes) {
                                if (current) { args.push(current); current = ""; }
                            } else { current += char; }
                        }
                        if (current) args.push(current);
                        return args;
                    };

                    const args = parseArgs(cmdInput);
                    const command = args[0] ? args[0].toLowerCase() : "";

                    if (command === "ls") {
                        const path = args[1] || Kernel.currentDir;
                        output.innerHTML += `<div>${Kernel.listDir(path)}</div>`;
                    } else if (command === "cd") {
                        const path = args[1] || "/home/user";
                        const target = Kernel.Filesystem.resolvePath(path);
                        if (Kernel.getDirObj(target)) {
                            Kernel.currentDir = target;
                        } else {
                            output.innerHTML += `<div>Directory not found: ${path}</div>`;
                        }
                    } else if (command === "pwd") {
                        output.innerHTML += `<div>${Kernel.currentDir}</div>`;
                    } else if (command === "mkdir") {
                        const path = args[1];
                        if (path && Kernel.makeDir(path)) {
                            output.innerHTML += `<div>Directory created: ${path}</div>`;
                        } else {
                            output.innerHTML += `<div>Usage: mkdir <path> (or directory already exists)</div>`;
                        }
                    } else if (command === "touch") {
                        const path = args[1];
                        if (path) {
                            Kernel.saveFile(path, "");
                            output.innerHTML += `<div>File created: ${path}</div>`;
                        } else {
                            output.innerHTML += `<div>Usage: touch <filename></div>`;
                        }
                    } else if (command === "rm") {
                        const path = args[1];
                        if (path && Kernel.deleteFile(path)) {
                            output.innerHTML += `<div>Deleted: ${path}</div>`;
                        } else {
                            output.innerHTML += `<div>File not found or usage: rm <filename></div>`;
                        }
                    } else if (command === "cat") {
                        const path = args[1];
                        if (!path) {
                            output.innerHTML += `<div>Usage: cat <filename></div>`;
                        } else {
                            const content = Kernel.getFile(path);
                            output.innerHTML += content !== null ? `<div style="white-space:pre-wrap; background:#111; padding:5px; border-left:2px solid var(--accent-color)">${content}</div>` : `<div>File not found: ${path}</div>`;
                        }
                    } else if (command === "echo") {
                        output.innerHTML += `<div>${args.slice(1).join(" ")}</div>`;
                    } else if (command === "ping") {
                        const host = args[1] || "apexos.dev";
                        output.innerHTML += `<div>PING ${host} (127.0.0.1): 56 data bytes</div>`;
                        let count = 0;
                        const pingInt = setInterval(() => {
                            output.innerHTML += `<div>64 bytes from 127.0.0.1: icmp_seq=${count} ttl=64 time=${(Math.random()*10).toFixed(3)} ms</div>`;
                            output.scrollTop = output.scrollHeight;
                            if (++count >= 4) {
                                clearInterval(pingInt);
                                output.innerHTML += `<div>--- ${host} ping statistics ---</div>`;
                                output.innerHTML += `<div>4 packets transmitted, 4 packets received, 0.0% packet loss</div>`;
                            }
                        }, 500);
                    } else if (command === "uname") {
                        output.innerHTML += `<div>ApexOS ApexKernel 0.2.0-generic x86_64 WebOS</div>`;
                    } else if (command === "uptime") {
                        const secs = Math.floor(performance.now() / 1000);
                        const mins = Math.floor(secs / 60);
                        output.innerHTML += `<div>up ${mins} minutes, ${secs % 60} seconds</div>`;
                    } else if (command === "fortune") {
                        const quotes = [
                            "The best way to predict the future is to invent it.",
                            "Everything is a file.",
                            "Talk is cheap. Show me the code.",
                            "Simplicity is the soul of efficiency.",
                            "In a world without fences and walls, who needs Gates and Windows?"
                        ];
                        output.innerHTML += `<div style="color:var(--accent-color)">${quotes[Math.floor(Math.random()*quotes.length)]}</div>`;
                    } else if (command === "notify") {
                        System.notify(args.slice(1).join(" ") || "Terminal notification", "info");
                    } else if (command === "help") {
                        output.innerHTML += `<div>Available: ls, pwd, mkdir, touch, rm, cat, echo, ping, uname, uptime, fortune, notify, clear, help, whoami, date, neofetch, theme, matrix, weather, snake, calc, editor, explorer, reboot, exit</div>`;
                    } else if (command === "whoami") {
                        output.innerHTML += `<div>apex_user</div>`;
                    } else if (command === "clear") {
                        output.innerHTML = "";
                    } else if (command === "date") {
                        output.innerHTML += `<div>${new Date().toLocaleString()}</div>`;
                    } else if (command === "reboot") {
                        location.reload();
                    } else if (command === "exit") {
                        input.closest('.window').querySelector('.close-btn').click();
                    } else if (command === "neofetch") {
                        output.innerHTML += `
                            <div style="display:flex; gap:15px; margin-top:5px; color:var(--accent-color)">
                                <pre style="font-size:10px; line-height:1">
  /\  
 /  \ 
/----\
|    |
|____|
                                </pre>
                                <div>
                                    <b style="color:white">apex_user@ApexOS</b><br>
                                    -----------------<br>
                                    OS: ApexOS v1.5.0<br>
                                    Kernel: 0.2.0-web<br>
                                    Uptime: ${Math.floor(performance.now()/60000)}m<br>
                                    Packages: 42 (npm)<br>
                                    Shell: apexsh 1.0<br>
                                    UI: Sleek Glass<br>
                                    RAM: ${Math.round(performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 256)}MB
                                </div>
                            </div>
                        `;
                    } else if (command === "snake") {
                        Apps.snake.launch();
                    } else if (command === "calc") {
                        Apps.calc.launch();
                    } else if (command === "editor") {
                        Apps.editor.launch();
                    } else if (command === "explorer") {
                        Apps.explorer.launch();
                    } else if (command === "theme") {
                        output.innerHTML += `<div>Usage: theme <name> (matrix, cyberpunk, light, classic, sleek)</div>`;
                    } else if (cmd.startsWith("theme ")) {
                        const theme = cmd.split(" ")[1];
                        const themes = {"matrix": "default", "cyberpunk": "theme-cyberpunk", "light": "theme-light", "classic": "theme-classic", "sleek": "theme-sleek"};
                        if (themes[theme]) {
                            const target = themes[theme];
                            document.body.className = target === 'default' ? '' : target;
                            localStorage.setItem('apex_theme', target);
                            output.innerHTML += `<div>Theme changed to ${theme}.</div>`;
                        }
                    } else if (cmd !== "") {
                        output.innerHTML += `<div>Unknown command: ${command}. Type 'help' for list.</div>`;
                    }

                    input.value = "";
                    output.scrollTop = output.scrollHeight;
                } else if (e.key === "ArrowUp") {
                    if (historyIndex > 0) {
                        historyIndex--;
                        input.value = history[historyIndex];
                    }
                } else if (e.key === "ArrowDown") {
                    if (historyIndex < history.length - 1) {
                        historyIndex++;
                        input.value = history[historyIndex];
                    } else {
                        historyIndex = history.length;
                        input.value = "";
                    }
                }
            };
        },
        launchMatrix: () => {
            const overlay = document.createElement('div');
            overlay.className = 'matrix-overlay';
            const canvas = document.createElement('canvas');
            overlay.appendChild(canvas);
            document.body.appendChild(overlay);

            const ctx = canvas.getContext('2d');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()*&^%";
            const fontSize = 16;
            const columns = canvas.width / fontSize;
            const drops = Array(Math.floor(columns)).fill(1);

            const draw = () => {
                ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#0F0";
                ctx.font = fontSize + "px arial";

                for (let i = 0; i < drops.length; i++) {
                    const text = characters.charAt(Math.floor(Math.random() * characters.length));
                    ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
                    drops[i]++;
                }
            };

            const interval = setInterval(draw, 33);
            overlay.onclick = () => {
                clearInterval(interval);
                overlay.remove();
            };
        }
    },
    explorer: {
        title: "Explorer",
        icon: "assets/folder.png",
        launch: () => {
            const winId = `explorer-${Math.random().toString(36).substring(2, 9)}`;
            
            const renderFiles = () => {
                const dir = Kernel.getDirObj();
                if (!dir) return "";
                return Object.keys(dir).map(f => {
                    const isDir = typeof dir[f] === 'object';
                    return `
                        <div class="file-item" data-file="${f}" data-type="${isDir ? 'dir' : 'file'}" style="cursor:pointer; text-align:center; padding:5px; border:1px solid transparent">
                            <div style="font-size:1.5em">${isDir ? '📁' : '📄'}</div>
                            <div style="font-size:0.7em; overflow:hidden; text-overflow:ellipsis">${f}</div>
                        </div>
                    `;
                }).join('');
            };
            
            wm.createWindow("File Explorer", `
                <div style="height:100%; display:flex; flex-direction:column">
                    <div class="explorer-path" style="border-bottom:1px solid #333; margin-bottom:10px; padding:5px; font-size:0.8em">Location: ${Kernel.currentDir}</div>
                    <div style="display:flex; gap:10px; padding:0 5px 10px 5px">
                        <button id="${winId}-refresh" style="background:transparent; color:var(--accent-color); border:1px solid var(--accent-color); cursor:pointer; font-size:0.7em; padding:2px 5px">Refresh</button>
                        <button id="${winId}-upload" style="background:transparent; color:var(--accent-color); border:1px solid var(--accent-color); cursor:pointer; font-size:0.7em; padding:2px 5px">Upload</button>
                        <input type="file" id="${winId}-file-input" style="display:none">
                    </div>
                    <div class="explorer-files" id="${winId}-files" style="flex:1; display:grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap:10px; overflow-y:auto; padding:5px">
                        ${renderFiles()}
                    </div>
                </div>
            `, 450, 350, 'explorer');

            const attachHandlers = () => {
                const container = document.getElementById(`${winId}-files`);
                if (!container) return;
                
                container.querySelectorAll('.file-item').forEach(item => {
                    item.onclick = () => {
                        const fileName = item.getAttribute('data-file');
                        const type = item.getAttribute('data-type');
                        if (type === 'file') {
                            Apps.editor.launch(fileName);
                        }
                    };
                    item.oncontextmenu = (e) => {
                        e.preventDefault();
                        const fileName = item.getAttribute('data-file');
                        if (confirm(`Download ${fileName}?`)) {
                            Kernel.downloadFile(fileName);
                        }
                    };
                    item.onmouseover = () => item.style.borderColor = 'var(--accent-color)';
                    item.onmouseout = () => item.style.borderColor = 'transparent';
                });
            };

            const refresh = () => {
                const filesElem = document.getElementById(`${winId}-files`);
                if (filesElem) {
                    filesElem.innerHTML = renderFiles();
                    attachHandlers();
                }
            };

            setTimeout(() => {
                attachHandlers();
                document.getElementById(`${winId}-refresh`).onclick = refresh;
                document.getElementById(`${winId}-upload`).onclick = () => {
                    document.getElementById(`${winId}-file-input`).click();
                };
                document.getElementById(`${winId}-file-input`).onchange = async (e) => {
                    if (e.target.files.length > 0) {
                        await Kernel.uploadFile(e.target.files[0]);
                        refresh();
                    }
                };
            }, 100);
        }
    },
    calc: {
        title: "Calculator",
        icon: "assets/calculator.png",
        launch: () => {
            const winId = `calc-${Date.now()}`;
            wm.createWindow("Calculator", `
                <div style="height:100%; display:flex; flex-direction:column">
                    <div class="app-tabs">
                        <div class="app-tab active" id="${winId}-tab-calc">Calculator</div>
                        <div class="app-tab" id="${winId}-tab-unit">Unit Converter</div>
                    </div>
                    <div id="${winId}-content" style="flex:1; padding:15px">
                        <!-- Content -->
                    </div>
                </div>
            `, 320, 450, 'calc');

            const content = document.getElementById(`${winId}-content`);

            const renderCalc = () => {
                content.innerHTML = `
                    <input type="text" id="${winId}-display" style="width:100%; height:50px; background:#111; border:1px solid #333; color:white; text-align:right; padding:10px; font-size:1.5em; margin-bottom:10px" readonly value="0">
                    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:5px">
                        <button class="calc-btn" data-val="C" style="background:#f44336; color:white; padding:10px; border:1px solid #444; cursor:pointer">C</button>
                        <button class="calc-btn" data-val="(" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">(</button>
                        <button class="calc-btn" data-val=")" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">)</button>
                        <button class="calc-btn" data-val="/" style="background:var(--accent-color); color:white; padding:10px; border:1px solid #444; cursor:pointer">/</button>
                        <button class="calc-btn" data-val="7" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">7</button>
                        <button class="calc-btn" data-val="8" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">8</button>
                        <button class="calc-btn" data-val="9" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">9</button>
                        <button class="calc-btn" data-val="*" style="background:var(--accent-color); color:white; padding:10px; border:1px solid #444; cursor:pointer">*</button>
                        <button class="calc-btn" data-val="4" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">4</button>
                        <button class="calc-btn" data-val="5" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">5</button>
                        <button class="calc-btn" data-val="6" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">6</button>
                        <button class="calc-btn" data-val="-" style="background:var(--accent-color); color:white; padding:10px; border:1px solid #444; cursor:pointer">-</button>
                        <button class="calc-btn" data-val="1" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">1</button>
                        <button class="calc-btn" data-val="2" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">2</button>
                        <button class="calc-btn" data-val="3" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">3</button>
                        <button class="calc-btn" data-val="+" style="background:var(--accent-color); color:white; padding:10px; border:1px solid #444; cursor:pointer">+</button>
                        <button class="calc-btn" data-val="0" style="grid-column: span 2; padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">0</button>
                        <button class="calc-btn" data-val="." style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">.</button>
                        <button class="calc-btn" data-val="=" style="background:var(--accent-color); color:white; padding:10px; border:1px solid #444; cursor:pointer">=</button>
                    </div>
                `;
                const display = document.getElementById(`${winId}-display`);
                content.querySelectorAll('.calc-btn').forEach(btn => {
                    btn.onclick = () => {
                        const val = btn.getAttribute('data-val');
                        if (val === 'C') display.value = '0';
                        else if (val === '=') {
                            try { display.value = eval(display.value); }
                            catch { display.value = 'Error'; }
                        } else {
                            if (display.value === '0' || display.value === 'Error') display.value = val;
                            else display.value += val;
                        }
                    };
                });
            };

            const renderUnit = () => {
                content.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:10px">
                        <label>Length:</label>
                        <div style="display:flex; gap:5px">
                            <input type="number" id="${winId}-m" placeholder="Meters" style="flex:1; padding:8px; background:#111; color:white; border:1px solid #333">
                            <input type="number" id="${winId}-ft" placeholder="Feet" style="flex:1; padding:8px; background:#111; color:white; border:1px solid #333">
                        </div>
                        <label>Weight:</label>
                        <div style="display:flex; gap:5px">
                            <input type="number" id="${winId}-kg" placeholder="KG" style="flex:1; padding:8px; background:#111; color:white; border:1px solid #333">
                            <input type="number" id="${winId}-lb" placeholder="LB" style="flex:1; padding:8px; background:#111; color:white; border:1px solid #333">
                        </div>
                        <label>Temp:</label>
                        <div style="display:flex; gap:5px">
                            <input type="number" id="${winId}-c" placeholder="°C" style="flex:1; padding:8px; background:#111; color:white; border:1px solid #333">
                            <input type="number" id="${winId}-f" placeholder="°F" style="flex:1; padding:8px; background:#111; color:white; border:1px solid #333">
                        </div>
                    </div>
                `;
                const m = document.getElementById(`${winId}-m`), ft = document.getElementById(`${winId}-ft`);
                const kg = document.getElementById(`${winId}-kg`), lb = document.getElementById(`${winId}-lb`);
                const c = document.getElementById(`${winId}-c`), f = document.getElementById(`${winId}-f`);
                m.oninput = () => ft.value = (m.value * 3.28084).toFixed(2);
                ft.oninput = () => m.value = (ft.value / 3.28084).toFixed(2);
                kg.oninput = () => lb.value = (kg.value * 2.20462).toFixed(2);
                lb.oninput = () => kg.value = (lb.value / 2.20462).toFixed(2);
                c.oninput = () => f.value = ((c.value * 9/5) + 32).toFixed(2);
                f.oninput = () => c.value = ((f.value - 32) * 5/9).toFixed(2);
            };

            document.getElementById(`${winId}-tab-calc`).onclick = (e) => {
                document.querySelectorAll(`#${winId} .app-tab`).forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                renderCalc();
            };
            document.getElementById(`${winId}-tab-unit`).onclick = (e) => {
                document.querySelectorAll(`#${winId} .app-tab`).forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                renderUnit();
            };

            renderCalc();
        }
    },
    calendar: {
        title: "Calendar",
        icon: "assets/folder.png",
        launch: () => {
            const winId = `cal-${Date.now()}`;
            const now = new Date();
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
            
            let calHtml = `<div style="display:grid; grid-template-columns: repeat(7, 1fr); text-align:center; font-weight:bold; color:var(--accent-color)">`;
            ['S','M','T','W','T','F','S'].forEach(d => calHtml += `<div>${d}</div>`);
            calHtml += `</div><div style="display:grid; grid-template-columns: repeat(7, 1fr); text-align:center; gap:5px; margin-top:5px">`;
            
            for(let i=0; i<firstDay; i++) calHtml += `<div></div>`;
            for(let d=1; d<=daysInMonth; d++) {
                const isToday = d === now.getDate();
                calHtml += `<div style="${isToday ? 'background:var(--accent-color); color:#000; font-weight:bold' : ''}; padding:5px; border:1px solid #333">${d}</div>`;
            }
            calHtml += `</div>`;

            wm.createWindow("Calendar", `
                <div style="padding:15px">
                    <h2 style="text-align:center; margin-bottom:15px">${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}</h2>
                    ${calHtml}
                </div>
            `, 350, 400, 'calendar');
        }
    },
    settings: {
        title: "Settings",
        icon: "assets/settings.png",
        launch: (defaultTab = 'general') => {
            const winId = `settings-${Date.now()}`;
            wm.createWindow("Settings", `
                <div class="settings-container">
                    <div class="settings-sidebar">
                        <div class="settings-nav-item" id="${winId}-nav-general" data-tab="general">General</div>
                        <div class="settings-nav-item" id="${winId}-nav-personal" data-tab="personal">Personalization</div>
                        <div class="settings-nav-item" id="${winId}-nav-accessibility" data-tab="accessibility">Accessibility</div>
                        <div class="settings-nav-item" id="${winId}-nav-accounts" data-tab="accounts">Accounts</div>
                        <div class="settings-nav-item" id="${winId}-nav-privacy" data-tab="privacy">Privacy</div>
                        <div class="settings-nav-item" id="${winId}-nav-system" data-tab="system">System Info</div>
                        <div class="settings-nav-item" id="${winId}-nav-help" data-tab="help">Help Center</div>
                    </div>
                    <div id="${winId}-content" class="settings-content">
                        <!-- Content injected here -->
                    </div>
                </div>
            `, 650, 520, 'settings');

            const content = document.getElementById(`${winId}-content`);
            const navItems = ['general', 'personal', 'accessibility', 'accounts', 'privacy', 'system', 'help'];

            const setActiveTab = (tab) => {
                document.querySelectorAll(`#${winId} .settings-nav-item`).forEach(n => {
                    n.classList.remove('active');
                    if (n.getAttribute('data-tab') === tab) n.classList.add('active');
                });
                if (tab === 'general') renderGeneral();
                if (tab === 'personal') renderPersonal();
                if (tab === 'accessibility') renderAccessibility();
                if (tab === 'accounts') renderAccounts();
                if (tab === 'privacy') renderPrivacy();
                if (tab === 'system') renderSystem();
                if (tab === 'help') renderHelp();
            };

            const renderGeneral = () => {
                const username = Kernel.Registry.get('HKCU\\Software\\ApexOS\\User\\Name', 'Apex User');
                content.innerHTML = `
                    <h2 style="margin-bottom:20px">General Settings</h2>
                    <div style="margin-bottom:20px">
                        <label style="display:block; margin-bottom:10px">System Profile</label>
                        <div style="display:flex; align-items:center; gap:15px; background:rgba(255,255,255,0.05); padding:15px; border-radius:12px">
                            <div style="width:50px; height:50px; background:var(--accent-color); border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:1.5em; font-weight:bold">${username[0]}</div>
                            <div style="flex:1">
                                <div style="color:white; font-size:1.2em; font-family:inherit; width:100%">${username}</div>
                                <div style="font-size:0.8em; opacity:0.5">Administrator</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top:20px; border-top:1px solid #333; padding-top:15px">
                        <label style="display:block; margin-bottom:5px">Maintenance</label>
                        <button id="${winId}-reset" style="padding:10px; background:#f44336; color:#fff; border:none; cursor:pointer; width:100%; border-radius:8px; font-weight:bold">Factory Reset (Wipe Data)</button>
                    </div>
                `;

                document.getElementById(`${winId}-reset`).onclick = async () => {
                    if(confirm("This will wipe all your files and settings. You sure?")) {
                        await Storage.wipe();
                        localStorage.clear();
                        location.reload();
                    }
                };
            };

            const renderPersonal = () => {
                const currentTheme = Kernel.Registry.get('HKLM\\Software\\System\\Theme', 'theme-sleek');
                const currentAccent = Kernel.Registry.get('HKCU\\Control Panel\\Colors\\Accent', '#3d5afe');
                const currentFont = Kernel.Registry.get('HKCU\\Control Panel\\Desktop\\Font', 'default');
                const currentWallpaper = Kernel.Registry.get('HKCU\\Control Panel\\Desktop\\Wallpaper', 'assets/background.png');

                const wallpapers = [
                    { name: 'Default', url: 'assets/background.png' },
                    { name: 'Abstract Blue', url: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop' },
                    { name: 'Dark Minimal', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop' },
                    { name: 'Cyberpunk', url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=2070&auto=format&fit=crop' },
                    { name: 'Nature', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=2070&auto=format&fit=crop' }
                ];

                content.innerHTML = `
                    <h2 style="margin-bottom:20px">Personalization</h2>
                    
                    <div style="margin-bottom:20px">
                        <label style="display:block; margin-bottom:5px">System Theme</label>
                        <select id="${winId}-theme" style="width:100%; padding:10px; background:#111; color:white; border:1px solid #333; border-radius:8px">
                            <option value="default" ${currentTheme === 'default' ? 'selected' : ''}>Matrix Green</option>
                            <option value="theme-cyberpunk" ${currentTheme === 'theme-cyberpunk' ? 'selected' : ''}>Cyberpunk Purple</option>
                            <option value="theme-light" ${currentTheme === 'theme-light' ? 'selected' : ''}>Light Mode</option>
                            <option value="theme-classic" ${currentTheme === 'theme-classic' ? 'selected' : ''}>Classic OS</option>
                            <option value="theme-sleek" ${currentTheme === 'theme-sleek' ? 'selected' : ''}>Sleek UI</option>
                        </select>
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block; margin-bottom:5px">Accent Color</label>
                        <input type="color" id="${winId}-accent" value="${currentAccent}" style="width:100%; height:40px; border:none; background:transparent; cursor:pointer">
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block; margin-bottom:5px">System Font</label>
                        <select id="${winId}-font" style="width:100%; padding:10px; background:#111; color:white; border:1px solid #333; border-radius:8px">
                            <option value="default" ${currentFont === 'default' ? 'selected' : ''}>Default Theme Font</option>
                            <option value="'Courier New', Courier, monospace" ${currentFont.includes('Courier') ? 'selected' : ''}>Monospace (Hacker)</option>
                            <option value="'Inter', sans-serif" ${currentFont.includes('Inter') ? 'selected' : ''}>Inter (Modern)</option>
                            <option value="'Segoe UI', Tahoma, sans-serif" ${currentFont.includes('Segoe') ? 'selected' : ''}>Segoe UI (Classic)</option>
                            <option value="'Comic Sans MS', cursive" ${currentFont.includes('Comic') ? 'selected' : ''}>Comic Sans (Chaos)</option>
                        </select>
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block; margin-bottom:10px">Wallpaper Gallery</label>
                        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px">
                            ${wallpapers.map(wp => `
                                <div class="wp-thumb ${currentWallpaper === wp.url ? 'active' : ''}" data-url="${wp.url}" style="aspect-ratio:16/9; background:url('${wp.url}') center/cover; border-radius:8px; cursor:pointer; border:2px solid ${currentWallpaper === wp.url ? 'var(--accent-color)' : 'transparent'}; transition:all 0.2s">
                                    <div style="background:rgba(0,0,0,0.5); color:white; font-size:0.7em; padding:2px 5px; border-bottom-right-radius:5px">${wp.name}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block; margin-bottom:5px">Custom Wallpaper URL</label>
                        <div style="display:flex; gap:10px">
                            <input type="text" id="${winId}-wp-custom" placeholder="https://..." style="flex:1; padding:10px; background:#111; color:white; border:1px solid #333; border-radius:8px" value="${currentWallpaper}">
                            <button id="${winId}-wp-apply" style="padding:10px 20px; background:var(--accent-color); color:black; border:none; border-radius:8px; cursor:pointer">Apply</button>
                        </div>
                    </div>
                `;

                document.getElementById(`${winId}-theme`).onchange = (e) => {
                    const theme = e.target.value;
                    const accessibilityClasses = ['accessibility-high-contrast', 'accessibility-large-text', 'accessibility-no-animations'].filter(c => document.body.classList.contains(c));
                    document.body.className = theme === 'default' ? '' : theme;
                    accessibilityClasses.forEach(c => document.body.classList.add(c));
                    Kernel.Registry.set('HKLM\\Software\\System\\Theme', theme);
                    
                    // If we switched to sleek, re-apply wallpaper
                    if (theme === 'theme-sleek') {
                        const url = Kernel.Registry.get('HKCU\\Control Panel\\Desktop\\Wallpaper', 'assets/background.png');
                        document.body.style.backgroundImage = `url('${url}')`;
                    } else {
                        document.body.style.backgroundImage = '';
                    }

                    System.notify(`Theme applied: ${theme}`);
                };

                document.getElementById(`${winId}-accent`).oninput = (e) => {
                    document.documentElement.style.setProperty('--accent-color', e.target.value);
                    Kernel.Registry.set('HKCU\\Control Panel\\Colors\\Accent', e.target.value);
                };

                document.getElementById(`${winId}-font`).onchange = (e) => {
                    document.documentElement.style.setProperty('--font-main', e.target.value === 'default' ? '' : e.target.value);
                    Kernel.Registry.set('HKCU\\Control Panel\\Desktop\\Font', e.target.value);
                    System.notify(`Font updated`);
                };

                const thumbs = content.querySelectorAll('.wp-thumb');
                thumbs.forEach(thumb => {
                    thumb.onclick = () => {
                        thumbs.forEach(t => t.style.borderColor = 'transparent');
                        thumb.style.borderColor = 'var(--accent-color)';
                        const url = thumb.getAttribute('data-url');
                        Kernel.Registry.set('HKCU\\Control Panel\\Desktop\\Wallpaper', url);
                        if (document.body.classList.contains('theme-sleek')) {
                            document.body.style.backgroundImage = `url('${url}')`;
                        }
                        System.notify('Wallpaper updated!');
                    };
                });

                document.getElementById(`${winId}-wp-apply`).onclick = () => {
                    const url = document.getElementById(`${winId}-wp-custom`).value;
                    if (url) {
                        Kernel.Registry.set('HKCU\\Control Panel\\Desktop\\Wallpaper', url);
                        if (document.body.classList.contains('theme-sleek')) {
                            document.body.style.backgroundImage = `url('${url}')`;
                        }
                        System.notify('Custom wallpaper applied!');
                    }
                };
            };

            const renderAccessibility = () => {
                const highContrast = Kernel.Registry.get('HKCU\\Control Panel\\Accessibility\\HighContrast', false);
                const largeText = Kernel.Registry.get('HKCU\\Control Panel\\Accessibility\\LargeText', false);
                const noAnimations = Kernel.Registry.get('HKCU\\Control Panel\\Accessibility\\NoAnimations', false);

                content.innerHTML = `
                    <h2 style="margin-bottom:20px">Accessibility</h2>
                    <div style="display:flex; flex-direction:column; gap:15px">
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:10px">
                            <div>
                                <div style="font-weight:bold">High Contrast</div>
                                <div style="font-size:0.8em; opacity:0.6">Easier to see text and icons</div>
                            </div>
                            <input type="checkbox" id="${winId}-hc" ${highContrast ? 'checked' : ''} style="width:20px; height:20px">
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:10px">
                            <div>
                                <div style="font-weight:bold">Large Text</div>
                                <div style="font-size:0.8em; opacity:0.6">Increases system-wide font size</div>
                            </div>
                            <input type="checkbox" id="${winId}-lt" ${largeText ? 'checked' : ''} style="width:20px; height:20px">
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:10px">
                            <div>
                                <div style="font-weight:bold">Reduce Motion</div>
                                <div style="font-size:0.8em; opacity:0.6">Disables window animations</div>
                            </div>
                            <input type="checkbox" id="${winId}-na" ${noAnimations ? 'checked' : ''} style="width:20px; height:20px">
                        </div>
                    </div>
                `;

                document.getElementById(`${winId}-hc`).onchange = (e) => {
                    Kernel.Registry.set('HKCU\\Control Panel\\Accessibility\\HighContrast', e.target.checked);
                    document.body.classList.toggle('accessibility-high-contrast', e.target.checked);
                };
                document.getElementById(`${winId}-lt`).onchange = (e) => {
                    Kernel.Registry.set('HKCU\\Control Panel\\Accessibility\\LargeText', e.target.checked);
                    document.body.classList.toggle('accessibility-large-text', e.target.checked);
                };
                document.getElementById(`${winId}-na`).onchange = (e) => {
                    Kernel.Registry.set('HKCU\\Control Panel\\Accessibility\\NoAnimations', e.target.checked);
                    document.body.classList.toggle('accessibility-no-animations', e.target.checked);
                };
            };

            const renderAccounts = () => {
                const username = Kernel.Registry.get('HKCU\\Software\\ApexOS\\User\\Name', 'Apex User');
                content.innerHTML = `
                    <h2 style="margin-bottom:20px">User Accounts</h2>
                    <div style="margin-bottom:20px; display:flex; align-items:center; gap:20px">
                        <div style="width:80px; height:80px; background:var(--accent-color); border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:2.5em; font-weight:bold">${username[0]}</div>
                        <div style="flex:1">
                            <label style="display:block; margin-bottom:5px">Display Name</label>
                            <input type="text" id="${winId}-username" value="${username}" style="width:100%; padding:10px; background:#111; color:white; border:1px solid #333; border-radius:8px">
                        </div>
                    </div>
                    <div style="margin-bottom:20px">
                        <label style="display:block; margin-bottom:5px">Account Type</label>
                        <div style="padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; opacity:0.7">System Administrator</div>
                    </div>
                    <div style="margin-bottom:20px">
                        <label style="display:block; margin-bottom:5px">Change Password</label>
                        <input type="password" id="${winId}-pass" placeholder="New Password" style="width:100%; padding:10px; background:#111; color:white; border:1px solid #333; border-radius:8px; margin-bottom:10px">
                        <button id="${winId}-save-account" style="padding:10px 20px; background:var(--accent-color); color:black; border:none; border-radius:8px; cursor:pointer; width:100%">Save Changes</button>
                    </div>
                `;

                document.getElementById(`${winId}-save-account`).onclick = () => {
                    const newName = document.getElementById(`${winId}-username`).value;
                    const newPass = document.getElementById(`${winId}-pass`).value;
                    if (newName) {
                        Kernel.Registry.set('HKCU\\Software\\ApexOS\\User\\Name', newName);
                        const userSpan = document.querySelector('.user-info span');
                        const userAvatar = document.querySelector('.user-avatar');
                        if (userSpan) userSpan.textContent = newName;
                        if (userAvatar) userAvatar.textContent = newName[0];
                    }
                    if (newPass) {
                        Kernel.Registry.set('HKCU\\Software\\ApexOS\\User\\Password', newPass);
                    }
                    System.notify("Account updated successfully");
                };
            };

            const renderPrivacy = () => {
                const telemetry = Kernel.Registry.get('HKCU\\Software\\ApexOS\\Privacy\\Telemetry', true);
                const location = Kernel.Registry.get('HKCU\\Software\\ApexOS\\Privacy\\Location', false);
                const appPermissions = Kernel.Registry.get('HKCU\\Software\\ApexOS\\Privacy\\AppPermissions', true);

                content.innerHTML = `
                    <h2 style="margin-bottom:20px">Privacy & Security</h2>
                    <div style="display:flex; flex-direction:column; gap:15px">
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:10px">
                            <div>
                                <div style="font-weight:bold">Send Diagnostic Data</div>
                                <div style="font-size:0.8em; opacity:0.6">Help us improve ApexOS by sending anonymous usage data</div>
                            </div>
                            <input type="checkbox" id="${winId}-tele" ${telemetry ? 'checked' : ''} style="width:20px; height:20px">
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:10px">
                            <div>
                                <div style="font-weight:bold">Location Services</div>
                                <div style="font-size:0.8em; opacity:0.6">Allow apps to access your location for weather and maps</div>
                            </div>
                            <input type="checkbox" id="${winId}-loc" ${location ? 'checked' : ''} style="width:20px; height:20px">
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:10px">
                            <div>
                                <div style="font-weight:bold">App Permissions</div>
                                <div style="font-size:0.8em; opacity:0.6">Ask before allowing apps to access system resources</div>
                            </div>
                            <input type="checkbox" id="${winId}-perm" ${appPermissions ? 'checked' : ''} style="width:20px; height:20px">
                        </div>
                    </div>
                `;

                document.getElementById(`${winId}-tele`).onchange = (e) => Kernel.Registry.set('HKCU\\Software\\ApexOS\\Privacy\\Telemetry', e.target.checked);
                document.getElementById(`${winId}-loc`).onchange = (e) => Kernel.Registry.set('HKCU\\Software\\ApexOS\\Privacy\\Location', e.target.checked);
                document.getElementById(`${winId}-perm`).onchange = (e) => Kernel.Registry.set('HKCU\\Software\\ApexOS\\Privacy\\AppPermissions', e.target.checked);
            };

            const renderSystem = () => {
                content.innerHTML = `
                    <h2 style="margin-bottom:20px">System Information</h2>
                    <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:12px">
                        <div style="text-align:center; margin-bottom:20px">
                            <div style="font-size:3em; margin-bottom:10px">🚀</div>
                            <div style="font-size:1.5em; font-weight:bold">ApexOS v1.5.0</div>
                            <div style="opacity:0.6">"The Productivity Update"</div>
                        </div>
                        <table style="width:100%; border-collapse:collapse">
                            <tr><td style="padding:10px 0; border-bottom:1px solid #333">Kernel</td><td style="text-align:right; opacity:0.8">ApexKernel 0.5.0-RELEASE</td></tr>
                            <tr><td style="padding:10px 0; border-bottom:1px solid #333">VFS Storage</td><td style="text-align:right; opacity:0.8">IndexedDB (Encrypted)</td></tr>
                            <tr><td style="padding:10px 0; border-bottom:1px solid #333">Memory</td><td style="text-align:right; opacity:0.8">${performance.memory ? Math.round(performance.memory.jsHeapSizeLimit / 1048576) : '4096'}MB RAM</td></tr>
                            <tr><td style="padding:10px 0; border-bottom:1px solid #333">Display</td><td style="text-align:right; opacity:0.8">${window.innerWidth}x${window.innerHeight}</td></tr>
                        </table>
                        <p style="margin-top:20px; font-size:0.8em; opacity:0.4; text-align:center">Copyright © 2026 ApexSoft Industries</p>
                    </div>
                `;
            };

            const renderHelp = () => {
                content.innerHTML = `
                    <h2 style="margin-bottom:20px">Help Center</h2>
                    <div style="display:flex; flex-direction:column; gap:15px">
                        <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px">
                            <div style="font-weight:bold; margin-bottom:5px">⌨️ Keyboard Shortcuts</div>
                            <div style="font-size:0.9em; opacity:0.7">
                                Win + L: Lock Screen<br>
                                Win + R: Run Dialog<br>
                                Alt + T: Terminal<br>
                                Alt + E: File Explorer<br>
                                Alt + R: Search Everywhere
                            </div>
                        </div>
                        <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px">
                            <div style="font-weight:bold; margin-bottom:5px">📂 File Management</div>
                            <div style="font-size:0.9em; opacity:0.7">
                                Use File Explorer to manage your virtual files. You can now upload real files by dragging them into the window!
                            </div>
                        </div>
                    </div>
                `;
            };

            navItems.forEach(item => {
                document.getElementById(`${winId}-nav-${item}`).onclick = () => setActiveTab(item);
            });

            setActiveTab(defaultTab);
        }
    },
    sysmon: {
        title: "System Monitor",
        icon: "assets/settings.png",
        launch: () => {
            const winId = `sysmon-${Math.random().toString(36).substring(2, 9)}`;
            wm.createWindow("System Monitor", `
                <div style="padding:10px">
                    <p>OS: ApexOS v1.5.0</p>
                    <p>Kernel: ApexKernel 0.2.0</p>
                    <p>VFS: Online (${Object.keys(VFS["/"]["home"]["user"]).length} files)</p>
                    <div style="margin-top:10px">
                        <label>CPU Usage:</label>
                        <div style="width:100%; height:10px; background:#222; margin-top:5px; border:1px solid #444">
                            <div id="${winId}-cpu" style="width:15%; height:100%; background:var(--accent-color)"></div>
                        </div>
                    </div>
                    <div style="margin-top:10px">
                        <label>Memory Usage:</label>
                        <div style="width:100%; height:10px; background:#222; margin-top:5px; border:1px solid #444">
                            <div id="${winId}-mem" style="width:42%; height:100%; background:var(--accent-color)"></div>
                        </div>
                    </div>
                </div>
            `, 300, 300, 'sysmon');

            const interval = setInterval(() => {
                const cpu = document.getElementById(`${winId}-cpu`);
                const mem = document.getElementById(`${winId}-mem`);
                if (!cpu || !mem) {
                    clearInterval(interval);
                    return;
                }
                cpu.style.width = (Math.random() * 20 + 5) + "%";
                mem.style.width = (Math.random() * 10 + 40) + "%";
            }, 2000);
        }
    },
    about: {
        title: "About",
        icon: "assets/settings.png",
        launch: () => {
            const win = wm.createWindow("About ApexOS", `
                <div style="text-align:center; padding:10px;">
                    <h2 style="color:var(--text-color)">🚀 ApexOS v1.5.0</h2>
                    <p>Created by: <b>Naman Shettigar</b></p>
                    <p>Built by Naman Shettigar</p>
                    <p>A retro-modern WebOS experience.</p>
                    <hr style="border:0; border-top:1px solid #333; margin:15px 0;">
                    <p>Built with Vanilla JS, CSS, and HTML.</p>
                    <p>Website: <a href="https://nshettigar.me/" target="_blank" style="color:var(--text-color)">nshettigar.me</a></p>
                    <p>Hosted at: <a href="https://apexos.nshettigar.me/" target="_blank" style="color:var(--text-color)">apexos.nshettigar.me</a></p>
                    <br>
                    <button class="about-close-btn" style="padding:5px 10px; background:var(--accent-color); color:#000; border:none; cursor:pointer">Close</button>
                </div>
            `, 350, 320, 'about');
            win.querySelector('.about-close-btn').onclick = () => {
                win.querySelector('.control-btn.close-btn').click();
            };
        }
    },
    taskmgr: {
        title: "Task Manager",
        icon: "assets/settings.png",
        launch: () => {
            const winId = `taskmgr-${Date.now()}`;
            let currentTab = 'processes';
            
            const win = wm.createWindow("Task Manager", `
                <div class="taskmgr-tabs" style="display:flex; border-bottom:1px solid #333; background:#222">
                    <div id="${winId}-tab-proc" class="taskmgr-tab active" style="padding:10px; cursor:pointer; flex:1; text-align:center">Processes</div>
                    <div id="${winId}-tab-serv" class="taskmgr-tab" style="padding:10px; cursor:pointer; flex:1; text-align:center">Services</div>
                </div>
                <div id="${winId}-content" style="padding:10px; overflow-y:auto; height:calc(100% - 40px)"></div>
            `, 450, 450, 'taskmgr');

            if (!document.getElementById('taskmgr-styles')) {
                const style = document.createElement('style');
                style.id = 'taskmgr-styles';
                style.innerHTML = `
                    .taskmgr-tab.active { border-bottom: 2px solid var(--accent-color); color: var(--accent-color); background: #333; }
                    .task-table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
                    .task-table th { text-align: left; border-bottom: 1px solid #333; padding: 8px; background: #1a1a1a; position: sticky; top: 0; }
                    .task-table td { padding: 8px; border-bottom: 1px solid #222; }
                    .task-table tr:hover { background: rgba(255,255,255,0.05); }
                `;
                document.head.appendChild(style);
            }

            const render = () => {
                const content = document.getElementById(`${winId}-content`);
                if (!content) return;
                
                if (currentTab === 'processes') {
                    const procs = Kernel.ProcessManager.getProcesses();
                    content.innerHTML = `
                        <table class="task-table">
                            <thead>
                                <tr>
                                    <th>PID</th>
                                    <th>App</th>
                                    <th>CPU</th>
                                    <th>RAM</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${procs.map(p => `
                                    <tr>
                                        <td>${p.pid}</td>
                                        <td>${p.name}</td>
                                        <td>${p.cpu}%</td>
                                        <td>${p.memory}MB</td>
                                        <td><button onclick="Kernel.ProcessManager.killProcess(${p.pid}); document.querySelector('[data-pid=\\'${p.pid}\\']')?.querySelector('.close-btn').click();" style="background:#f44336; color:#fff; border:none; padding:2px 5px; cursor:pointer; border-radius:3px">End</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                } else {
                    const services = Kernel.Services.services;
                    content.innerHTML = `
                        <table class="task-table">
                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${services.map(s => `
                                    <tr>
                                        <td>${s.name}</td>
                                        <td style="color:${s.status === 'Running' ? '#4caf50' : '#f44336'}">${s.status}</td>
                                        <td>
                                            ${s.status === 'Running' ? 
                                                `<button onclick="Kernel.Services.stop('${s.id}')" style="background:#f44336; color:#fff; border:none; padding:2px 5px; cursor:pointer; border-radius:3px">Stop</button>` :
                                                `<button onclick="Kernel.Services.start('${s.id}')" style="background:#4caf50; color:#fff; border:none; padding:2px 5px; cursor:pointer; border-radius:3px">Start</button>`
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                }
            };

            const tabProc = document.getElementById(`${winId}-tab-proc`);
            const tabServ = document.getElementById(`${winId}-tab-serv`);

            tabProc.onclick = () => {
                currentTab = 'processes';
                tabProc.classList.add('active');
                tabServ.classList.remove('active');
                render();
            };

            tabServ.onclick = () => {
                currentTab = 'services';
                tabServ.classList.add('active');
                tabProc.classList.remove('active');
                render();
            };

            render();
            const interval = setInterval(render, 2000);
            
            // Cleanup interval when window is closed
            const checkExists = setInterval(() => {
                if (!document.getElementById(`${winId}-content`)) {
                    clearInterval(interval);
                    clearInterval(checkExists);
                }
            }, 5000);
        }
    },
    quotes: {
        title: "Daily Quotes",
        icon: "assets/sticky-notes.png",
        launch: () => {
            const quotes = [
                "Simplicity is the ultimate sophistication.",
                "Innovation distinguishes between a leader and a follower.",
                "Stay hungry, stay foolish.",
                "The only way to do great work is to love what you do.",
                "Code is like humor. When you have to explain it, it’s bad.",
                "First, solve the problem. Then, write the code.",
                "Experience is the name everyone gives to their mistakes.",
                "In order to be irreplaceable, one must always be different."
            ];
            const quote = quotes[Math.floor(Math.random() * quotes.length)];
            wm.createWindow("Daily Quote", `
                <div style="padding:30px; text-align:center; display:flex; flex-direction:column; justify-content:center; height:100%">
                    <div style="font-size:3em; margin-bottom:20px; opacity:0.3">"</div>
                    <div style="font-size:1.2em; font-style:italic; line-height:1.6">${quote}</div>
                    <div style="font-size:3em; margin-top:20px; opacity:0.3; align-self:flex-end">"</div>
                </div>
            `, 400, 300, 'quotes');
        }
    },
    paint: {
        title: "ApexPaint",
        icon: "assets/apex-paint.png",
        launch: () => {
            const winId = `paint-${Date.now()}`;
            const win = wm.createWindow("ApexPaint", `
                <div class="paint-toolbar">
                    <input type="color" id="${winId}-color" value="#3d5afe">
                    <input type="range" id="${winId}-size" min="1" max="20" value="5">
                    <button id="${winId}-clear" style="padding:2px 5px">Clear</button>
                </div>
                <canvas id="${winId}-canvas" class="paint-canvas" width="350" height="200"></canvas>
            `, 380, 320, 'paint');

            const canvas = document.getElementById(`${winId}-canvas`);
            const ctx = canvas.getContext('2d');
            let drawing = false;

            canvas.onmousedown = () => drawing = true;
            canvas.onmouseup = () => { drawing = false; ctx.beginPath(); };
            canvas.onmousemove = (e) => {
                if (!drawing) return;
                const rect = canvas.getBoundingClientRect();
                ctx.lineWidth = document.getElementById(`${winId}-size`).value;
                ctx.lineCap = "round";
                ctx.strokeStyle = document.getElementById(`${winId}-color`).value;
                ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
            };
            document.getElementById(`${winId}-clear`).onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    },
    snake: {
        title: "Snake Retro",
        icon: "assets/snake-retro.png",
        launch: () => {
            const winId = `snake-${Date.now()}`;
            const win = wm.createWindow("Snake Retro", `
                <div style="text-align:center; padding:5px">Score: <span id="${winId}-score">0</span></div>
                <canvas id="${winId}-canvas" class="snake-canvas" width="300" height="300"></canvas>
                <div style="font-size:0.7em; text-align:center; margin-top:5px">Use Arrow Keys to Play</div>
            `, 340, 400, 'snake');

            const canvas = document.getElementById(`${winId}-canvas`);
            const ctx = canvas.getContext('2d');
            const box = 20;
            let snake = [{x: 9 * box, y: 10 * box}];
            let food = {x: Math.floor(Math.random() * 15) * box, y: Math.floor(Math.random() * 15) * box};
            let score = 0;
            let d;

            const direction = (e) => {
                if(e.keyCode == 37 && d != "RIGHT") d = "LEFT";
                else if(e.keyCode == 38 && d != "DOWN") d = "UP";
                else if(e.keyCode == 39 && d != "LEFT") d = "RIGHT";
                else if(e.keyCode == 40 && d != "UP") d = "DOWN";
            };
            document.addEventListener("keydown", direction);

            const draw = () => {
                ctx.fillStyle = "black";
                ctx.fillRect(0, 0, 300, 300);
                for(let i = 0; i < snake.length; i++){
                    ctx.fillStyle = (i == 0) ? "var(--accent-color)" : "white";
                    ctx.fillRect(snake[i].x, snake[i].y, box, box);
                }
                ctx.fillStyle = "red";
                ctx.fillRect(food.x, food.y, box, box);

                let snakeX = snake[0].x;
                let snakeY = snake[0].y;
                if( d == "LEFT") snakeX -= box;
                if( d == "UP") snakeY -= box;
                if( d == "RIGHT") snakeX += box;
                if( d == "DOWN") snakeY += box;

                if(snakeX == food.x && snakeY == food.y){
                    score++;
                    document.getElementById(`${winId}-score`).textContent = score;
                    food = {x: Math.floor(Math.random() * 15) * box, y: Math.floor(Math.random() * 15) * box};
                } else {
                    snake.pop();
                }
                let newHead = {x: snakeX, y: snakeY};
                if(snakeX < 0 || snakeX >= 300 || snakeY < 0 || snakeY >= 300 || collision(newHead, snake)){
                    clearInterval(game);
                    document.removeEventListener("keydown", direction);
                    alert("Game Over! Score: " + score);
                }
                snake.unshift(newHead);
            };

            const collision = (head, array) => {
                for(let i = 0; i < array.length; i++) if(head.x == array[i].x && head.y == array[i].y) return true;
                return false;
            };
            let game = setInterval(draw, 100);
            win.querySelector('.close-btn').addEventListener('click', () => {
                clearInterval(game);
                document.removeEventListener("keydown", direction);
            });
        }
    },
    weather: {
        title: "Weather",
        icon: "assets/weather.png",
        launch: async () => {
            const winId = `weather-${Date.now()}`;
            const win = wm.createWindow("Weather", `
                <div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; gap:5px">
                    <input type="text" id="${winId}-search" placeholder="Enter city..." style="flex:1; background:rgba(0,0,0,0.3); border:1px solid var(--accent-color); color:#fff; padding:5px; border-radius:4px">
                    <button id="${winId}-go" style="background:var(--accent-color); color:#000; border:none; padding:5px 10px; cursor:pointer; border-radius:4px">Go</button>
                </div>
                <div id="${winId}-content" style="text-align:center; padding:20px">
                    <p>Fetching local weather...</p>
                    <div class="cursor" style="display:inline-block; margin-top:10px"></div>
                </div>
            `, 300, 350, 'weather');

            const fetchWeather = async (query = null) => {
                const content = document.getElementById(`${winId}-content`);
                content.innerHTML = `<p>Loading...</p><div class="cursor" style="display:inline-block; margin-top:10px"></div>`;
                
                try {
                    let city, lat, lon, country;
                    
                    if (query) {
                        // Search for coordinates by city name
                        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
                        const geoData = await geoRes.json();
                        if (!geoData.results || geoData.results.length === 0) {
                            content.innerHTML = `<p style="color:#ff5555">City not found.</p>`;
                            return;
                        }
                        const result = geoData.results[0];
                        city = result.name;
                        lat = result.latitude;
                        lon = result.longitude;
                        country = result.country;
                    } else {
                        // Default to IP-based location
                        const locRes = await fetch('https://ipapi.co/json/');
                        const locData = await locRes.json();
                        city = locData.city;
                        lat = locData.latitude;
                        lon = locData.longitude;
                        country = locData.country_name;
                    }

                    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                    const weatherData = await weatherRes.json();
                    const { temperature, weathercode } = weatherData.current_weather;

                    const getIcon = (code) => {
                        if (code === 0) return "☀️";
                        if (code <= 3) return "🌤️";
                        if (code <= 48) return "🌫️";
                        if (code <= 67) return "🌧️";
                        if (code <= 77) return "❄️";
                        if (code <= 82) return "🌦️";
                        if (code <= 99) return "⛈️";
                        return "🌡️";
                    };

                    content.innerHTML = `
                        <div style="font-size:3.5em; margin-bottom:10px">${getIcon(weathercode)}</div>
                        <h2 style="margin:0; color:var(--accent-color)">${city}</h2>
                        <p style="font-size:0.8em; opacity:0.7; margin:2px 0">${country}</p>
                        <div style="font-size:2.5em; margin:15px 0; font-weight:bold">${temperature}°C</div>
                        <p style="font-size:0.9em">Currently ${weathercode <= 3 ? 'Clear' : 'Overcast'}</p>
                    `;
                } catch (err) {
                    console.error("Weather error:", err);
                    content.innerHTML = `<p style="color:#ff5555">Failed to load weather data.</p>`;
                }
            };

            document.getElementById(`${winId}-go`).onclick = () => {
                const query = document.getElementById(`${winId}-search`).value;
                if (query) fetchWeather(query);
            };

            document.getElementById(`${winId}-search`).onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value;
                    if (query) fetchWeather(query);
                }
            };

            fetchWeather();
        }
    },
    browser: {
        title: "Browser",
        icon: "assets/browser.png",
        launch: () => {
            const winId = `browser-${Date.now()}`;
            let tabs = [{ title: "Wikipedia", url: "https://www.wikipedia.org" }];
            let activeTabIdx = 0;
            let bookmarks = JSON.parse(localStorage.getItem('browser_bookmarks') || '[]');
            let history = JSON.parse(localStorage.getItem('browser_history') || '[]');
            let downloads = JSON.parse(localStorage.getItem('browser_downloads') || '[]');

            wm.createWindow("ApexBrowser", `
                <div style="height:100%; display:flex; flex-direction:column">
                    <div id="${winId}-tabbar" style="display:flex; background:rgba(0,0,0,0.4); border-bottom:1px solid #333; padding:2px 5px 0 5px; gap:2px">
                        <!-- Tabs here -->
                        <button id="${winId}-add-tab" style="background:transparent; border:none; color:white; cursor:pointer; padding:5px 10px">+</button>
                    </div>
                    <div style="display:flex; padding:8px; background:rgba(0,0,0,0.2); gap:8px; align-items:center; border-bottom:1px solid #333">
                        <div style="display:flex; gap:5px">
                            <button id="${winId}-back" style="background:transparent; border:none; color:white; cursor:pointer; padding:2px">⬅️</button>
                            <button id="${winId}-forward" style="background:transparent; border:none; color:white; cursor:pointer; padding:2px">➡️</button>
                            <button id="${winId}-reload" style="background:transparent; border:none; color:white; cursor:pointer; padding:2px">🔄</button>
                        </div>
                        <input type="text" id="${winId}-url" value="" style="flex:1; background:rgba(0,0,0,0.3); border:1px solid #444; color:#fff; padding:4px 10px; border-radius:15px; font-size:0.9em; outline:none">
                        <button id="${winId}-bookmark" style="background:transparent; border:none; cursor:pointer; font-size:1.2em">⭐</button>
                        <button id="${winId}-menu" style="background:transparent; border:none; color:white; cursor:pointer; font-size:1.2em">⋮</button>
                    </div>
                    <div id="${winId}-frames" style="flex:1; position:relative; background:#fff">
                        <!-- Iframes here -->
                    </div>
                    <div id="${winId}-overlay-menu" style="display:none; position:absolute; top:80px; right:10px; background:#222; border:1px solid #444; border-radius:8px; z-index:1000; width:200px; box-shadow:0 10px 30px rgba(0,0,0,0.5)">
                        <div class="browser-menu-item" id="${winId}-menu-bookmarks" style="padding:10px; cursor:pointer; border-bottom:1px solid #333">Bookmarks</div>
                        <div class="browser-menu-item" id="${winId}-menu-history" style="padding:10px; cursor:pointer; border-bottom:1px solid #333">History</div>
                        <div class="browser-menu-item" id="${winId}-menu-downloads" style="padding:10px; cursor:pointer">Downloads</div>
                    </div>
                </div>
            `, 900, 700, 'browser');

            const tabbar = document.getElementById(`${winId}-tabbar`);
            const frameContainer = document.getElementById(`${winId}-frames`);
            const urlInput = document.getElementById(`${winId}-url`);
            const overlayMenu = document.getElementById(`${winId}-overlay-menu`);

            const updateTabs = () => {
                tabbar.querySelectorAll('.browser-tab').forEach(t => t.remove());
                tabs.forEach((tab, idx) => {
                    const tabElem = document.createElement('div');
                    tabElem.className = `browser-tab ${idx === activeTabIdx ? 'active' : ''}`;
                    tabElem.style.cssText = `
                        padding:5px 15px; background:${idx === activeTabIdx ? 'rgba(255,255,255,0.1)' : 'transparent'}; 
                        border-top-left-radius:8px; border-top-right-radius:8px; color:white; cursor:pointer; font-size:0.8em;
                        display:flex; align-items:center; gap:8px; max-width:150px; border:1px solid ${idx === activeTabIdx ? '#333' : 'transparent'}; border-bottom:none;
                    `;
                    tabElem.innerHTML = `
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${tab.title}</span>
                        <span class="close-tab" style="font-size:0.8em; opacity:0.5">✕</span>
                    `;
                    tabElem.onclick = (e) => {
                        if (e.target.classList.contains('close-tab')) {
                            closeTab(idx);
                        } else {
                            activeTabIdx = idx;
                            render();
                        }
                    };
                    tabbar.insertBefore(tabElem, document.getElementById(`${winId}-add-tab`));
                });
            };

            const render = () => {
                updateTabs();
                const activeTab = tabs[activeTabIdx];
                urlInput.value = activeTab.url;

                frameContainer.querySelectorAll('iframe').forEach(f => f.style.display = 'none');
                let frame = document.getElementById(`${winId}-frame-${activeTabIdx}`);
                if (!frame) {
                    frame = document.createElement('iframe');
                    frame.id = `${winId}-frame-${activeTabIdx}`;
                    frame.src = activeTab.url;
                    frame.style.cssText = "width:100%; height:100%; border:none; background:#fff; position:absolute; top:0; left:0";
                    frameContainer.appendChild(frame);
                }
                frame.style.display = 'block';
            };

            const closeTab = (idx) => {
                if (tabs.length === 1) return;
                const frame = document.getElementById(`${winId}-frame-${idx}`);
                if (frame) frame.remove();
                tabs.splice(idx, 1);
                if (activeTabIdx >= tabs.length) activeTabIdx = tabs.length - 1;
                // Re-index remaining frames
                frameContainer.querySelectorAll('iframe').forEach((f, i) => {
                    f.id = `${winId}-frame-${i}`;
                });
                render();
            };

            document.getElementById(`${winId}-add-tab`).onclick = () => {
                tabs.push({ title: "New Tab", url: "https://www.google.com" });
                activeTabIdx = tabs.length - 1;
                render();
            };

            const go = () => {
                let url = urlInput.value.trim();
                if (!url) return;
                if (!url.startsWith('http')) {
                    if (url.includes('.') && !url.includes(' ')) {
                        url = 'https://' + url;
                    } else {
                        url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
                    }
                }
                tabs[activeTabIdx].url = url;
                tabs[activeTabIdx].title = url.split('/')[2] || url;
                const frame = document.getElementById(`${winId}-frame-${activeTabIdx}`);
                if (frame) frame.src = url;
                
                // Add to history
                history.unshift({ title: tabs[activeTabIdx].title, url: url, time: new Date().toLocaleString() });
                if (history.length > 100) history.pop();
                localStorage.setItem('browser_history', JSON.stringify(history));
                
                render();
            };

            urlInput.onkeydown = (e) => { if (e.key === 'Enter') go(); };
            document.getElementById(`${winId}-back`).onclick = () => {
                const frame = document.getElementById(`${winId}-frame-${activeTabIdx}`);
                if (frame) frame.contentWindow.history.back();
            };
            document.getElementById(`${winId}-forward`).onclick = () => {
                const frame = document.getElementById(`${winId}-frame-${activeTabIdx}`);
                if (frame) frame.contentWindow.history.forward();
            };
            document.getElementById(`${winId}-reload`).onclick = () => {
                const frame = document.getElementById(`${winId}-frame-${activeTabIdx}`);
                if (frame) frame.src = frame.src;
            };

            document.getElementById(`${winId}-bookmark`).onclick = () => {
                const activeTab = tabs[activeTabIdx];
                if (!bookmarks.find(b => b.url === activeTab.url)) {
                    bookmarks.push({ title: activeTab.title, url: activeTab.url });
                    localStorage.setItem('browser_bookmarks', JSON.stringify(bookmarks));
                    System.notify("Bookmark added!");
                }
            };

            document.getElementById(`${winId}-menu`).onclick = () => {
                overlayMenu.style.display = overlayMenu.style.display === 'none' ? 'block' : 'none';
            };

            const showListOverlay = (title, items, type) => {
                const content = `
                    <div style="padding:15px; color:white">
                        <h3>${title}</h3>
                        <div style="max-height:300px; overflow-y:auto; margin-top:10px">
                            ${items.length === 0 ? '<div style="opacity:0.5">No items found</div>' : items.map((item, i) => `
                                <div style="padding:8px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center">
                                    <div style="flex:1; cursor:pointer" onclick="window._browser_open('${winId}', '${item.url}')">
                                        <div style="font-size:0.9em">${item.title}</div>
                                        <div style="font-size:0.7em; opacity:0.5">${item.url}</div>
                                    </div>
                                    <button style="background:transparent; border:none; color:#f44336; cursor:pointer" onclick="window._browser_remove('${winId}', '${type}', ${i})">✕</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                const listWin = wm.createWindow(title, content, 400, 400, 'browser');
            };

            window._browser_open = (bid, url) => {
                // Find the window and update its URL
                urlInput.value = url;
                go();
            };

            window._browser_remove = (bid, type, idx) => {
                if (type === 'bookmarks') {
                    bookmarks.splice(idx, 1);
                    localStorage.setItem('browser_bookmarks', JSON.stringify(bookmarks));
                } else if (type === 'history') {
                    history.splice(idx, 1);
                    localStorage.setItem('browser_history', JSON.stringify(history));
                } else if (type === 'downloads') {
                    downloads.splice(idx, 1);
                    localStorage.setItem('browser_downloads', JSON.stringify(downloads));
                }
                System.notify("Item removed");
                // Ideally refresh the overlay win, but for now just close it or notify
            };

            document.getElementById(`${winId}-menu-bookmarks`).onclick = () => {
                overlayMenu.style.display = 'none';
                showListOverlay("Bookmarks", bookmarks, 'bookmarks');
            };
            document.getElementById(`${winId}-menu-history`).onclick = () => {
                overlayMenu.style.display = 'none';
                showListOverlay("History", history, 'history');
            };
            document.getElementById(`${winId}-menu-downloads`).onclick = () => {
                overlayMenu.style.display = 'none';
                showListOverlay("Downloads", downloads, 'downloads');
            };

            // Hook into download attempts (though iframe sandbox might prevent this)
            // For this WebOS, we can simulate downloads when Kernel.downloadFile is called from somewhere.
            
            render();
        }
    },
    clock: {
        title: "Clock",
        icon: "assets/clock.png",
        launch: () => {
            const winId = `clock-${Date.now()}`;
            wm.createWindow("Clock", `
                <div style="height:100%; display:flex; flex-direction:column">
                    <div class="app-tabs">
                        <div class="app-tab active" id="${winId}-tab-clock">Clock</div>
                        <div class="app-tab" id="${winId}-tab-timer">Timer</div>
                        <div class="app-tab" id="${winId}-tab-stopwatch">Stopwatch</div>
                    </div>
                    <div id="${winId}-content" style="flex:1; padding:20px; text-align:center; display:flex; flex-direction:column; justify-content:center">
                        <!-- Content injected here -->
                    </div>
                </div>
            `, 400, 350, 'clock');

            const content = document.getElementById(`${winId}-content`);
            const tabs = ['clock', 'timer', 'stopwatch'];
            
            let stopwatchSeconds = 0;
            let stopwatchInterval = null;
            let timerSeconds = 0;
            let timerInterval = null;

            const renderClock = () => {
                content.innerHTML = `
                    <div id="${winId}-time-display" style="font-size:3.5em; margin-bottom:10px">00:00:00</div>
                    <div id="${winId}-date-display" style="color:var(--accent-color); font-size:1.2em">${new Date().toDateString()}</div>
                `;
                const updateTime = () => {
                    const display = document.getElementById(`${winId}-time-display`);
                    if (display) display.textContent = new Date().toLocaleTimeString();
                };
                setInterval(updateTime, 1000);
                updateTime();
            };

            const renderTimer = () => {
                content.innerHTML = `
                    <div id="${winId}-timer-display" style="font-size:3.5em; margin-bottom:20px">00:00:00</div>
                    <div style="display:flex; justify-content:center; gap:10px; margin-bottom:20px">
                        <input type="number" id="${winId}-timer-min" placeholder="Min" style="width:60px; background:#222; border:1px solid #444; color:white; padding:5px">
                        <input type="number" id="${winId}-timer-sec" placeholder="Sec" style="width:60px; background:#222; border:1px solid #444; color:white; padding:5px">
                    </div>
                    <div style="display:flex; justify-content:center; gap:10px">
                        <button id="${winId}-timer-start" style="padding:10px 20px; background:var(--accent-color); border:none; cursor:pointer; font-weight:bold">Start</button>
                        <button id="${winId}-timer-reset" style="padding:10px 20px; background:#444; color:white; border:none; cursor:pointer">Reset</button>
                    </div>
                `;

                const display = document.getElementById(`${winId}-timer-display`);
                const startBtn = document.getElementById(`${winId}-timer-start`);
                
                startBtn.onclick = () => {
                    if (timerInterval) {
                        clearInterval(timerInterval);
                        timerInterval = null;
                        startBtn.textContent = "Start";
                    } else {
                        if (timerSeconds === 0) {
                            const m = parseInt(document.getElementById(`${winId}-timer-min`).value) || 0;
                            const s = parseInt(document.getElementById(`${winId}-timer-sec`).value) || 0;
                            timerSeconds = (m * 60) + s;
                        }
                        if (timerSeconds <= 0) return;
                        
                        timerInterval = setInterval(() => {
                            timerSeconds--;
                            const h = Math.floor(timerSeconds / 3600).toString().padStart(2, '0');
                            const m = Math.floor((timerSeconds % 3600) / 60).toString().padStart(2, '0');
                            const s = (timerSeconds % 60).toString().padStart(2, '0');
                            display.textContent = `${h}:${m}:${s}`;
                            if (timerSeconds <= 0) {
                                clearInterval(timerInterval);
                                timerInterval = null;
                                System.notify("Timer Finished!", "success");
                                startBtn.textContent = "Start";
                            }
                        }, 1000);
                        startBtn.textContent = "Pause";
                    }
                };

                document.getElementById(`${winId}-timer-reset`).onclick = () => {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    timerSeconds = 0;
                    display.textContent = "00:00:00";
                    startBtn.textContent = "Start";
                };
            };

            const renderStopwatch = () => {
                content.innerHTML = `
                    <div id="${winId}-sw-display" style="font-size:3.5em; margin-bottom:20px">00:00:00</div>
                    <div style="display:flex; justify-content:center; gap:10px">
                        <button id="${winId}-sw-start" style="padding:10px 20px; background:var(--accent-color); border:none; cursor:pointer; font-weight:bold">Start</button>
                        <button id="${winId}-sw-reset" style="padding:10px 20px; background:#444; color:white; border:none; cursor:pointer">Reset</button>
                    </div>
                `;
                const display = document.getElementById(`${winId}-sw-display`);
                const startBtn = document.getElementById(`${winId}-sw-start`);

                startBtn.onclick = () => {
                    if (stopwatchInterval) {
                        clearInterval(stopwatchInterval);
                        stopwatchInterval = null;
                        startBtn.textContent = "Start";
                    } else {
                        stopwatchInterval = setInterval(() => {
                            stopwatchSeconds++;
                            const h = Math.floor(stopwatchSeconds / 3600).toString().padStart(2, '0');
                            const m = Math.floor((stopwatchSeconds % 3600) / 60).toString().padStart(2, '0');
                            const s = (stopwatchSeconds % 60).toString().padStart(2, '0');
                            display.textContent = `${h}:${m}:${s}`;
                        }, 1000);
                        startBtn.textContent = "Stop";
                    }
                };

                document.getElementById(`${winId}-sw-reset`).onclick = () => {
                    clearInterval(stopwatchInterval);
                    stopwatchInterval = null;
                    stopwatchSeconds = 0;
                    display.textContent = "00:00:00";
                    startBtn.textContent = "Start";
                };
            };

            tabs.forEach(tab => {
                document.getElementById(`${winId}-tab-${tab}`).onclick = (e) => {
                    document.querySelectorAll(`#${winId} .app-tab`).forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    if (tab === 'clock') renderClock();
                    if (tab === 'timer') renderTimer();
                    if (tab === 'stopwatch') renderStopwatch();
                };
            });

            renderClock();
        }
    },
    notes: {
        title: "Notes",
        icon: "assets/sticky-notes.png",
        launch: () => {
            const winId = `note-${Date.now()}`;
            wm.createWindow("Sticky Note", `
                <div style="padding:10px; background:#fff9c4; color:#333; height:100%; min-height:150px">
                    <textarea id="${winId}-text" style="width:100%; height:120px; background:transparent; border:none; font-family:'Segoe UI', Tahoma, sans-serif; resize:none;" placeholder="Write a quick note..."></textarea>
                    <div style="font-size:0.7em; margin-top:5px; opacity:0.6; text-align:right">Auto-saves to local storage</div>
                </div>
            `, 250, 250, 'notes');

            const textarea = document.getElementById(`${winId}-text`);
            const savedNote = localStorage.getItem('apex_sticky_note');
            if (savedNote) textarea.value = savedNote;

            textarea.oninput = () => {
                localStorage.setItem('apex_sticky_note', textarea.value);
            };
        }
    },
    editor: {
        title: "ApexPad",
        icon: "assets/apexpad.png",
        launch: (initialFile = null) => {
            const winId = `editor-${Date.now()}`;
            let tabs = [];
            let activeTabIdx = 0;

            const addTab = (fileName = "untitled.txt", content = "") => {
                tabs.push({ fileName, content, modified: false });
                activeTabIdx = tabs.length - 1;
            };

            if (initialFile) {
                const content = Kernel.getFile(initialFile) || "";
                addTab(initialFile, content);
            } else {
                addTab();
            }

            wm.createWindow("ApexPad", `
                <div style="height:100%; display:flex; flex-direction:column">
                    <div id="${winId}-tabbar" style="display:flex; background:rgba(255,255,255,0.05); border-bottom:1px solid #333; padding:2px 5px 0 5px; gap:2px">
                        <button id="${winId}-add-tab" style="background:transparent; border:none; color:white; cursor:pointer; padding:5px 10px">+</button>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(0,0,0,0.2); border-bottom:1px solid #333">
                        <div style="display:flex; gap:10px; align-items:center">
                            <input type="text" id="${winId}-filename" style="background:transparent; border:none; color:var(--accent-color); font-family:inherit; width:150px; font-size:0.8em" placeholder="filename.txt">
                            <select id="${winId}-lang" style="background:#222; color:white; border:1px solid #444; font-size:0.7em">
                                <option value="txt">Text</option>
                                <option value="js">JavaScript</option>
                                <option value="html">HTML</option>
                                <option value="css">CSS</option>
                                <option value="md">Markdown</option>
                            </select>
                        </div>
                        <div style="display:flex; gap:10px">
                            <button id="${winId}-save" style="font-size:0.7em; background:var(--accent-color); color:#000; border:none; cursor:pointer; font-weight:bold; padding:4px 12px; border-radius:4px">Save</button>
                        </div>
                    </div>
                    <div id="${winId}-editor-container" style="flex:1; position:relative; overflow:hidden; background:#000">
                        <textarea id="${winId}-text" style="width:100%; height:100%; background:transparent; color:transparent; border:none; font-family:'Courier New', monospace; padding:10px; resize:none; font-size:14px; outline:none; position:absolute; top:0; left:0; z-index:2; caret-color:white" spellcheck="false"></textarea>
                        <pre id="${winId}-highlight" style="width:100%; height:100%; margin:0; padding:10px; font-family:'Courier New', monospace; font-size:14px; position:absolute; top:0; left:0; z-index:1; pointer-events:none; white-space:pre-wrap; word-wrap:break-word; color:#ddd; overflow:hidden"></pre>
                    </div>
                    <div id="${winId}-stats" style="font-size:0.7em; opacity:0.7; padding:2px 10px; background:rgba(0,0,0,0.2)">Line: 1, Col: 1 | Words: 0</div>
                </div>
            `, 800, 600, 'editor');

            const tabbar = document.getElementById(`${winId}-tabbar`);
            const textarea = document.getElementById(`${winId}-text`);
            const highlight = document.getElementById(`${winId}-highlight`);
            const filenameInput = document.getElementById(`${winId}-filename`);
            const langSelect = document.getElementById(`${winId}-lang`);
            const stats = document.getElementById(`${winId}-stats`);

            const syntaxHighlight = (code, lang) => {
                const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                code = esc(code);
                if (lang === 'js') {
                    return code
                        .replace(/\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|this|async|await)\b/g, '<span style="color:#ff79c6">$1</span>')
                        .replace(/\b(true|false|null|undefined)\b/g, '<span style="color:#bd93f9">$1</span>')
                        .replace(/(".*?"|'.*?'|`.*?`)/g, '<span style="color:#f1fa8c">$1</span>')
                        .replace(/\b(\d+)\b/g, '<span style="color:#bd93f9">$1</span>')
                        .replace(/\/\/.*/g, '<span style="color:#6272a4">$&</span>');
                } else if (lang === 'html') {
                    return code
                        .replace(/(&lt;!--.*?--&gt;)/gs, '<span style="color:#6272a4">$1</span>')
                        .replace(/(&lt;\/?[a-z0-9]+)(&gt;| )/gi, '<span style="color:#ff79c6">$1</span>$2')
                        .replace(/([a-z-]+)=(&quot;.*?&quot;)/gi, '<span style="color:#50fa7b">$1</span>=<span style="color:#f1fa8c">$2</span>');
                } else if (lang === 'css') {
                    return code
                        .replace(/(\/\*.*?\*\/)/gs, '<span style="color:#6272a4">$1</span>')
                        .replace(/([a-z-]+)\s*:/gi, '<span style="color:#8be9fd">$1</span>:')
                        .replace(/(:)(.*?;)/gi, '$1<span style="color:#f1fa8c">$2</span>')
                        .replace(/([.#][a-z0-9_-]+)/gi, '<span style="color:#50fa7b">$1</span>');
                }
                return code;
            };

            const updateTabs = () => {
                tabbar.querySelectorAll('.editor-tab').forEach(t => t.remove());
                tabs.forEach((tab, idx) => {
                    const tabElem = document.createElement('div');
                    tabElem.className = `editor-tab ${idx === activeTabIdx ? 'active' : ''}`;
                    tabElem.style.cssText = `
                        padding:5px 15px; background:${idx === activeTabIdx ? 'rgba(255,255,255,0.1)' : 'transparent'}; 
                        border-top-left-radius:8px; border-top-right-radius:8px; color:white; cursor:pointer; font-size:0.8em;
                        display:flex; align-items:center; gap:8px; border:1px solid ${idx === activeTabIdx ? '#333' : 'transparent'}; border-bottom:none;
                    `;
                    tabElem.innerHTML = `
                        <span>${tab.fileName}${tab.modified ? '*' : ''}</span>
                        <span class="close-tab" style="font-size:0.8em; opacity:0.5">✕</span>
                    `;
                    tabElem.onclick = (e) => {
                        if (e.target.classList.contains('close-tab')) {
                            closeTab(idx);
                        } else {
                            saveCurrentTabState();
                            activeTabIdx = idx;
                            loadActiveTab();
                        }
                    };
                    tabbar.insertBefore(tabElem, document.getElementById(`${winId}-add-tab`));
                });
            };

            const saveCurrentTabState = () => {
                if (tabs[activeTabIdx]) {
                    tabs[activeTabIdx].content = textarea.value;
                    tabs[activeTabIdx].fileName = filenameInput.value;
                }
            };

            const loadActiveTab = () => {
                const tab = tabs[activeTabIdx];
                textarea.value = tab.content;
                filenameInput.value = tab.fileName;
                
                const ext = tab.fileName.split('.').pop();
                if (['js', 'html', 'css', 'md'].includes(ext)) {
                    langSelect.value = ext === 'md' ? 'md' : ext;
                } else {
                    langSelect.value = 'txt';
                }
                
                updateHighlight();
                updateStats();
                updateTabs();
            };

            const updateHighlight = () => {
                highlight.innerHTML = syntaxHighlight(textarea.value, langSelect.value) + "\n";
                highlight.scrollTop = textarea.scrollTop;
                highlight.scrollLeft = textarea.scrollLeft;
            };

            const updateStats = () => {
                const text = textarea.value;
                const words = text.trim() ? text.trim().split(/\s+/).length : 0;
                const lines = text.split('\n');
                const line = textarea.value.substr(0, textarea.selectionStart).split('\n').length;
                const col = textarea.selectionStart - lines.slice(0, line - 1).join('\n').length - (line > 1 ? 1 : 0) + 1;
                stats.textContent = `Line: ${line}, Col: ${col} | Words: ${words}`;
            };

            const closeTab = (idx) => {
                if (tabs.length === 1) return;
                tabs.splice(idx, 1);
                if (activeTabIdx >= tabs.length) activeTabIdx = tabs.length - 1;
                loadActiveTab();
            };

            textarea.oninput = () => {
                tabs[activeTabIdx].modified = true;
                updateHighlight();
                updateStats();
                updateTabs();
            };

            textarea.onscroll = () => {
                highlight.scrollTop = textarea.scrollTop;
                highlight.scrollLeft = textarea.scrollLeft;
            };

            textarea.onkeydown = (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    textarea.value = textarea.value.substring(0, start) + "    " + textarea.value.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                    updateHighlight();
                }
                setTimeout(updateStats, 10);
            };

            textarea.onclick = updateStats;

            filenameInput.onchange = () => {
                tabs[activeTabIdx].fileName = filenameInput.value;
                updateTabs();
            };

            langSelect.onchange = updateHighlight;

            document.getElementById(`${winId}-add-tab`).onclick = () => {
                saveCurrentTabState();
                addTab();
                loadActiveTab();
            };

            document.getElementById(`${winId}-save`).onclick = async () => {
                const tab = tabs[activeTabIdx];
                const name = filenameInput.value;
                const content = textarea.value;
                const success = await Kernel.saveFile(name, content);
                if (success) {
                    tab.fileName = name;
                    tab.content = content;
                    tab.modified = false;
                    updateTabs();
                } else {
                    System.notify("Failed to save file", "error");
                }
            };

            loadActiveTab();
        }
    },
    stopwatch: {
        title: "Stopwatch",
        icon: "assets/folder.png",
        launch: () => {
            const winId = `sw-${Date.now()}`;
            wm.createWindow("Stopwatch", `
                <div style="padding:20px; text-align:center">
                    <div id="${winId}-display" style="font-size:3em; margin-bottom:20px; font-family:monospace">00:00.00</div>
                    <div style="display:flex; justify-content:center; gap:10px">
                        <button id="${winId}-start" style="padding:10px 20px; background:var(--accent-color); color:white; border:none; cursor:pointer; border-radius:5px">Start</button>
                        <button id="${winId}-stop" style="padding:10px 20px; background:#f44336; color:white; border:none; cursor:pointer; border-radius:5px">Stop</button>
                        <button id="${winId}-reset" style="padding:10px 20px; background:#666; color:white; border:none; cursor:pointer; border-radius:5px">Reset</button>
                    </div>
                </div>
            `, 300, 250, 'stopwatch');

            let startTime, timer;
            let elapsed = 0;

            const format = (ms) => {
                const m = Math.floor(ms / 60000);
                const s = Math.floor((ms % 60000) / 1000);
                const msPart = Math.floor((ms % 1000) / 10);
                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${msPart.toString().padStart(2, '0')}`;
            };

            document.getElementById(`${winId}-start`).onclick = () => {
                if (timer) return;
                startTime = Date.now() - elapsed;
                timer = setInterval(() => {
                    elapsed = Date.now() - startTime;
                    document.getElementById(`${winId}-display`).textContent = format(elapsed);
                }, 10);
            };

            document.getElementById(`${winId}-stop`).onclick = () => {
                clearInterval(timer);
                timer = null;
            };

            document.getElementById(`${winId}-reset`).onclick = () => {
                clearInterval(timer);
                timer = null;
                elapsed = 0;
                document.getElementById(`${winId}-display`).textContent = "00:00.00";
            };
        }
    },
    imageviewer: {
        title: "Image Viewer",
        icon: "assets/folder.png",
        launch: (src = null) => {
            const winId = `img-${Date.now()}`;
            wm.createWindow("Image Viewer", `
                <div style="padding:10px; display:flex; flex-direction:column; height:100%">
                    <div style="margin-bottom:10px; display:flex; gap:5px">
                        <input type="text" id="${winId}-url" placeholder="Paste Image URL..." style="flex:1; background:#111; border:1px solid #444; color:white; padding:5px" value="${src || ''}">
                        <button id="${winId}-load" style="background:var(--accent-color); border:none; padding:5px 10px; cursor:pointer">View</button>
                    </div>
                    <div id="${winId}-canvas" style="flex:1; background:#222; display:flex; align-items:center; justify-content:center; overflow:auto; border-radius:5px">
                        ${src ? `<img src="${src}" style="max-width:100%; max-height:100%">` : '<p style="opacity:0.5">No image loaded</p>'}
                    </div>
                </div>
            `, 500, 450, 'imageviewer');

            document.getElementById(`${winId}-load`).onclick = () => {
                const url = document.getElementById(`${winId}-url`).value;
                if (url) {
                    document.getElementById(`${winId}-canvas`).innerHTML = `<img src="${url}" style="max-width:100%; max-height:100%">`;
                }
            };
        }
    },
    unitconv: {
        title: "Unit Converter",
        icon: "assets/calculator.png",
        launch: () => {
            const winId = `conv-${Date.now()}`;
            wm.createWindow("Unit Converter", `
                <div style="padding:15px">
                    <div style="margin-bottom:10px">
                        <label>Length:</label>
                        <div style="display:flex; gap:5px; margin-top:5px">
                            <input type="number" id="${winId}-m" placeholder="Meters" style="width:100%; padding:5px; background:#111; color:white; border:1px solid #444">
                            <span style="align-self:center">=</span>
                            <input type="number" id="${winId}-ft" placeholder="Feet" style="width:100%; padding:5px; background:#111; color:white; border:1px solid #444">
                        </div>
                    </div>
                    <div style="margin-bottom:10px">
                        <label>Weight:</label>
                        <div style="display:flex; gap:5px; margin-top:5px">
                            <input type="number" id="${winId}-kg" placeholder="KG" style="width:100%; padding:5px; background:#111; color:white; border:1px solid #444">
                            <span style="align-self:center">=</span>
                            <input type="number" id="${winId}-lb" placeholder="LB" style="width:100%; padding:5px; background:#111; color:white; border:1px solid #444">
                        </div>
                    </div>
                    <div style="margin-bottom:10px">
                        <label>Temp:</label>
                        <div style="display:flex; gap:5px; margin-top:5px">
                            <input type="number" id="${winId}-c" placeholder="°C" style="width:100%; padding:5px; background:#111; color:white; border:1px solid #444">
                            <span style="align-self:center">=</span>
                            <input type="number" id="${winId}-f" placeholder="°F" style="width:100%; padding:5px; background:#111; color:white; border:1px solid #444">
                        </div>
                    </div>
                </div>
            `, 350, 300, 'unitconv');

            const m = document.getElementById(`${winId}-m`), ft = document.getElementById(`${winId}-ft`);
            m.oninput = () => ft.value = (m.value * 3.28084).toFixed(2);
            ft.oninput = () => m.value = (ft.value / 3.28084).toFixed(2);

            const kg = document.getElementById(`${winId}-kg`), lb = document.getElementById(`${winId}-lb`);
            kg.oninput = () => lb.value = (kg.value * 2.20462).toFixed(2);
            lb.oninput = () => kg.value = (lb.value / 2.20462).toFixed(2);

            const c = document.getElementById(`${winId}-c`), f = document.getElementById(`${winId}-f`);
            c.oninput = () => f.value = (c.value * 9/5 + 32).toFixed(2);
            f.oninput = () => c.value = ((f.value - 32) * 5/9).toFixed(2);
        }
    },
    help: {
        title: "Help Center",
        icon: "assets/settings.png",
        launch: () => {
            wm.createWindow("Help Center", `
                <div style="padding:15px; height:100%; overflow-y:auto">
                    <h2 style="color:var(--accent-color)">Welcome to ApexOS Help</h2>
                    <div style="margin-top:15px">
                        <h3>Keyboard Shortcuts</h3>
                        <ul style="padding-left:20px">
                            <li><b>Win + L</b>: Lock Screen</li>
                            <li><b>Win + R</b>: Run Dialog</li>
                            <li><b>Win + D</b>: Show Desktop</li>
                            <li><b>Alt + T</b>: Open Terminal</li>
                            <li><b>Esc</b>: Close Menus</li>
                        </ul>
                    </div>
                    <div style="margin-top:15px">
                        <h3>Terminal Tips</h3>
                        <p>Type <code>help</code> for a list of commands. Try <code>neofetch</code> or <code>matrix</code>!</p>
                    </div>
                    <div style="margin-top:15px">
                        <h3>Personalization</h3>
                        <p>Go to Settings to change themes, accent colors, and wallpapers.</p>
                    </div>
                </div>
            `, 450, 400, 'help');
        }
    },
    appstore: {
        title: "App Store",
        icon: "assets/folder.png",
        launch: () => {
            wm.createWindow("App Store", `
                <div style="padding:15px">
                    <h2 style="color:var(--accent-color)">Featured Apps</h2>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:15px">
                        <div style="padding:10px; border:1px solid #333; text-align:center">
                            <div style="font-size:2em">🎮</div>
                            <div>Doom Clone</div>
                            <button style="margin-top:5px; background:var(--accent-color); border:none; padding:5px; cursor:pointer" onclick="System.notify('Installation failed: Not enough disk space', 'error')">Install</button>
                        </div>
                        <div style="padding:10px; border:1px solid #333; text-align:center">
                            <div style="font-size:2em">📧</div>
                            <div>Apex Mail</div>
                            <button style="margin-top:5px; background:var(--accent-color); border:none; padding:5px; cursor:pointer" onclick="System.notify('Connecting to server...', 'info')">Install</button>
                        </div>
                    </div>
                </div>
            `, 400, 350, 'appstore');
        }
    },
    media: {
        title: "Music Player",
        icon: "assets/folder.png",
        launch: () => {
            const winId = `media-${Date.now()}`;
            wm.createWindow("Music Player", `
                <div style="padding:20px; text-align:center; background:#111; height:100%; display:flex; flex-direction:column; justify-content:center; color:white">
                    <div id="${winId}-visualizer" style="height:100px; display:flex; align-items:flex-end; justify-content:center; gap:2px; margin-bottom:20px">
                        <!-- Visualizer bars -->
                    </div>
                    <div style="font-size:3em; margin-bottom:10px">🎵</div>
                    <h3 id="${winId}-title" style="color:var(--accent-color); margin-bottom:5px">No Track Loaded</h3>
                    <p id="${winId}-status" style="font-size:0.8em; opacity:0.6; margin-bottom:20px">Please upload or select an audio file</p>
                    
                    <div style="margin-bottom:20px">
                        <input type="range" id="${winId}-progress" value="0" style="width:100%; cursor:pointer">
                    </div>
                    
                    <div style="display:flex; justify-content:center; gap:20px; font-size:1.5em; cursor:pointer; align-items:center">
                        <span id="${winId}-prev">⏮️</span>
                        <span id="${winId}-play-pause" style="font-size:1.5em">▶️</span>
                        <span id="${winId}-next">⏭️</span>
                    </div>
                    
                    <div style="margin-top:20px">
                        <button id="${winId}-upload" style="background:transparent; border:1px solid var(--accent-color); color:var(--accent-color); padding:5px 10px; cursor:pointer">Upload MP3</button>
                        <input type="file" id="${winId}-file-input" accept="audio/*" style="display:none">
                    </div>
                </div>
            `, 400, 450, 'media');

            const audio = new Audio();
            let audioContext, analyser, source, dataArray;
            const playPauseBtn = document.getElementById(`${winId}-play-pause`);
            const status = document.getElementById(`${winId}-status`);
            const title = document.getElementById(`${winId}-title`);
            const visualizer = document.getElementById(`${winId}-visualizer`);
            const progress = document.getElementById(`${winId}-progress`);

            // Create visualizer bars
            for (let i = 0; i < 32; i++) {
                const bar = document.createElement('div');
                bar.style.width = '4px';
                bar.style.height = '10px';
                bar.style.background = 'var(--accent-color)';
                bar.style.transition = 'height 0.1s ease';
                visualizer.appendChild(bar);
            }

            const initAudio = () => {
                if (audioContext) return;
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                source = audioContext.createMediaElementSource(audio);
                source.connect(analyser);
                analyser.connect(audioContext.destination);
                analyser.fftSize = 64;
                dataArray = new Uint8Array(analyser.frequencyBinCount);
                updateVisualizer();
            };

            const updateVisualizer = () => {
                if (!analyser) return;
                analyser.getByteFrequencyData(dataArray);
                const bars = visualizer.children;
                for (let i = 0; i < bars.length; i++) {
                    const height = (dataArray[i] / 255) * 100;
                    bars[i].style.height = `${Math.max(2, height)}px`;
                }
                requestAnimationFrame(updateVisualizer);
            };

            playPauseBtn.onclick = () => {
                if (!audio.src) return;
                initAudio();
                if (audio.paused) {
                    audio.play();
                    playPauseBtn.textContent = '⏸️';
                    status.textContent = 'Playing...';
                } else {
                    audio.pause();
                    playPauseBtn.textContent = '▶️';
                    status.textContent = 'Paused';
                }
            };

            audio.ontimeupdate = () => {
                if (audio.duration) {
                    progress.value = (audio.currentTime / audio.duration) * 100;
                }
            };

            progress.oninput = () => {
                if (audio.duration) {
                    audio.currentTime = (progress.value / 100) * audio.duration;
                }
            };

            document.getElementById(`${winId}-upload`).onclick = () => {
                document.getElementById(`${winId}-file-input`).click();
            };

            document.getElementById(`${winId}-file-input`).onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const url = URL.createObjectURL(file);
                    audio.src = url;
                    title.textContent = file.name;
                    status.textContent = 'Ready to play';
                    playPauseBtn.textContent = '▶️';
                }
            };
        }
    },
};

document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
    }

    wm = new WindowManager();
    Kernel.boot();

    // Start Menu Toggle
    const startBtn = document.querySelector('.start-btn');
    const startMenu = document.getElementById('start-menu');
    const ctxMenu = document.getElementById('context-menu');

    startBtn.onclick = (e) => {
        e.stopPropagation();
        startMenu.classList.toggle('hidden');
        ctxMenu.classList.add('hidden');
        if (!startMenu.classList.contains('hidden')) {
            document.getElementById('start-search').focus();
        }
    };

    // Start Menu Search
    const startSearch = document.getElementById('start-search');
    startSearch.onclick = (e) => e.stopPropagation();
    startSearch.oninput = (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.start-menu-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(query)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    };

    // Context Menu Logic
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        ctxMenu.style.top = `${e.clientY}px`;
        ctxMenu.style.left = `${e.clientX}px`;
        ctxMenu.classList.remove('hidden');
        startMenu.classList.add('hidden');
    });

    document.addEventListener('click', () => {
        startMenu.classList.add('hidden');
        ctxMenu.classList.add('hidden');
    });

    // Make Apps global so onclick in HTML works
    window.Apps = Apps;
    window.System = System;

    // Handle Start Menu App Launches
    document.querySelectorAll('.start-menu-item').forEach(item => {
        item.onclick = () => {
            const appName = item.getAttribute('data-app');
            if (Apps[appName]) Apps[appName].launch();
            startMenu.classList.add('hidden');
        };
    });

    // Desktop Icons
    const desktopIcons = document.getElementById('desktop-icons');
    const appsWithIcons = ["terminal", "browser", "explorer", "editor", "notes", "calc", "clock", "settings", "snake", "paint", "weather", "media"];
    
    const refreshDesktopIcons = () => {
        desktopIcons.innerHTML = '';
        appsWithIcons.forEach((appKey, index) => {
            const app = Apps[appKey];
            const icon = document.createElement('div');
            icon.className = 'desktop-icon';
            icon.setAttribute('data-app', appKey);
            icon.style.animationDelay = `${index * 50}ms`;
            icon.title = `Launch ${app.title}`;
            
            // Grid placement logic for first-time or reset icons
            const savedPos = localStorage.getItem(`icon-pos-${appKey}`);
            if (savedPos) {
                const pos = JSON.parse(savedPos);
                icon.style.position = 'absolute';
                icon.style.top = pos.top;
                icon.style.left = pos.left;
                icon.style.zIndex = 150;
            } else {
                // Smart grid placement
                const grid = typeof ICON_GRID !== 'undefined' ? ICON_GRID : (window.ICON_GRID || { width: 100, height: 110, margin: 20, topOffset: 60 });
                const desktopHeight = window.innerHeight - grid.topOffset;
                
                const iconsPerCol = Math.max(1, Math.floor(desktopHeight / grid.height));
                const col = Math.floor(index / iconsPerCol);
                const row = index % iconsPerCol;
                
                icon.style.position = 'absolute';
                icon.style.left = `${grid.margin + (col * grid.width)}px`;
                icon.style.top = `${grid.topOffset + (row * grid.height)}px`;
            }

            const iconHtml = app.icon.endsWith('.png') ? `<img src="${app.icon}" alt="${app.title}" style="pointer-events:none; width:48px; height:48px;">` : app.icon;
            icon.innerHTML = `
                <div class="icon-graphic" style="display:flex; align-items:center; justify-content:center; width:64px; height:64px; background:rgba(255,255,255,0.05); border-radius:10px; margin-bottom:5px;">${iconHtml}</div>
                <div class="icon-label" style="font-size:0.8em; text-shadow: 1px 1px 2px black;">${app.title}</div>
            `;
            
            icon.style.opacity = '1';
            icon.style.display = 'flex';
            
            let startX, startY;
            let dragStarted = false;

            icon.addEventListener('mousedown', (e) => {
                startX = e.clientX;
                startY = e.clientY;
                dragStarted = false;
            });
            
            icon.addEventListener('mousemove', (e) => {
                if (startX === undefined) return;
                if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
                    dragStarted = true;
                }
            });

            icon.addEventListener('mouseup', () => {
                startX = undefined;
            });

            icon.addEventListener('click', (e) => {
                if (!dragStarted) {
                    app.launch();
                }
            });

            wm.makeDraggable(icon, true);
            desktopIcons.appendChild(icon);
            console.log(`Rendered icon: ${appKey} at ${icon.style.left}, ${icon.style.top}`);
        });
        console.log(`Finished rendering ${appsWithIcons.length} icons. Container height: ${desktopIcons.offsetHeight}`);
    };

    System.refreshDesktopIcons = refreshDesktopIcons;

    refreshDesktopIcons();
    // Re-call after a small delay to ensure all DOM and CSS are ready
    setTimeout(refreshDesktopIcons, 100);
    setTimeout(refreshDesktopIcons, 500);
    window.addEventListener('resize', () => {
        refreshDesktopIcons();
    });

    setTimeout(() => {
        if (sessionStorage.getItem('apex_booted_once')) return;
        
        const welcomeWin = wm.createWindow('Welcome', `
            <div style="text-align:center; padding:10px;">
                <h2 style="color:var(--text-color)">🚀 ApexOS v1.5.0</h2>
                <p>System Initialized Successfully.</p>
                <hr style="border:0; border-top:1px solid #333; margin:15px 0;">
                <p>Welcome to your retro-modern workspace.</p>
                <br>
                <p>Type 'help' in the terminal or use the APEX menu to begin.</p>
                <p><b>Shortcuts:</b> Alt+R (Run), Alt+T (Terminal), Alt+E (Explorer)</p>
                <br>
                <button class="welcome-start-btn" style="padding:10px 20px; background:var(--accent-color); color:#000; border:none; cursor:pointer; font-weight:bold;">GET STARTED</button>
            </div>
        `, 400, 380, 'about');

        welcomeWin.querySelector('.welcome-start-btn').onclick = () => {
            welcomeWin.querySelector('.control-btn.close-btn').click();
        };

        sessionStorage.setItem('apex_booted_once', 'true');
    }, 5500);
});
