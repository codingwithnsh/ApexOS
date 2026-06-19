/**
 * ApexOS - A Retro-Modern WebOS
 * 
 * Hey! This is the heart of the system. I've tried to keep things 
 * clean and modular, but you know how it goes when you're 
 * coding at 2 AM. 
 * 
 * "Because even code should feel like it has a soul." - Naman
 */

// --- Virtual File System (VFS) ---
// Just a simple nested object for now. 
// Note to self: maybe move this to a more robust structure later, 
// but for a demo, this works great.
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

// --- Storage Helper ---
const ICON_GRID = {
    width: 100,
    height: 110,
    margin: 20,
    topOffset: 60
};

const Storage = {
    save() {
        localStorage.setItem('apex_vfs', JSON.stringify(VFS));
    },
    load() {
        const saved = localStorage.getItem('apex_vfs');
        if (saved) {
            VFS = JSON.parse(saved);
        }
    }
};

const Kernel = {
    // ... boot logs remain same
    currentDir: "/home/user",
    
    // Get the object at current directory
    getDirObj(path = this.currentDir) {
        let current = VFS["/"];
        const parts = path.split('/').filter(p => p);
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
        const dir = this.getDirObj();
        return dir ? dir[path] : null;
    },

    saveFile(path, content) {
        const dir = this.getDirObj();
        if (dir) {
            dir[path] = content;
            Storage.save();
            console.log(`Saved ${path}`);
            System.notify(`File saved: ${path}`);
        }
    },

    deleteFile(path) {
        const dir = this.getDirObj();
        if (dir && dir[path] !== undefined) {
            delete dir[path];
            Storage.save();
            return true;
        }
        return false;
    },

    makeDir(name) {
        const dir = this.getDirObj();
        if (dir && !dir[name]) {
            dir[name] = {};
            Storage.save();
            return true;
        }
        return false;
    },

    listDir() {
        const dir = this.getDirObj();
        if (!dir) return "";
        return Object.keys(dir).map(name => {
            const isDir = typeof dir[name] === 'object';
            return isDir ? `[DIR] ${name}` : name;
        }).join("  ");
    },

    async boot() {
        Storage.load(); // Grab user's files before we start the show
        
        // Let's get the user's preferred vibe
        const savedTheme = localStorage.getItem('apex_theme');
        if (savedTheme && savedTheme !== 'default') {
            document.body.className = savedTheme;
        }

        const savedWallpaper = localStorage.getItem('apex_wallpaper');
        if (savedWallpaper && document.body.classList.contains('theme-sleek')) {
            document.body.style.backgroundImage = `url('${savedWallpaper}')`;
        }

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
        this.startClock();
        System.setupShortcuts();
        System.notify("System booted successfully", "success");
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
        setInterval(() => {
            const now = new Date();
            clock.textContent = now.toLocaleTimeString();
            this.updateSystemStats();
        }, 1000);
        this.initBattery();
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
        if (localStorage.getItem('apex_show_stats') === 'true') {
            const mem = (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : '??') + 'MB';
            stats.textContent = `RAM: ${mem}`;
        } else {
            stats.textContent = '';
        }
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
        console.log(`[System] ${message}`);
        const container = document.getElementById('notification-container') || this.createNotificationContainer();
        
        const toast = document.createElement('div');
        toast.className = `notification toast-${type}`;
        toast.innerHTML = `
            <div class="notification-content">${message}</div>
            <div class="notification-progress"></div>
        `;
        
        container.appendChild(toast);
        
        // Remove after animation
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
        return container;
    },

    launchRunDialog() {
        if (document.getElementById('run-dialog')) return;

        const dialog = document.createElement('div');
        dialog.id = 'run-dialog';
        dialog.innerHTML = `
            <div class="run-dialog-inner">
                <span style="color:var(--accent-color); margin-right:10px">></span>
                <input type="text" id="run-input" placeholder="Type app name or command..." autofocus>
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
                } else if (val === 'terminal') {
                    Apps.terminal.launch();
                } else {
                    this.notify(`App not found: ${val}`, 'error');
                }
                dialog.remove();
            } else if (e.key === 'Escape') {
                dialog.remove();
            }
        };

        // Close on click outside
        dialog.onclick = (e) => {
            if (e.target === dialog) dialog.remove();
        };
    },

    setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt + T: Terminal
            if (e.altKey && e.key.toLowerCase() === 't') {
                e.preventDefault();
                Apps.terminal.launch();
            }
            // Alt + E: Explorer
            if (e.altKey && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                Apps.explorer.launch();
            }
            // Alt + R: Run Dialog
            if (e.altKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                this.launchRunDialog();
            }
            // Escape: Close Start Menu and Run Dialog
            if (e.key === 'Escape') {
                document.getElementById('start-menu').classList.add('hidden');
                const runDialog = document.getElementById('run-dialog');
                if (runDialog) runDialog.remove();
            }
        });
    },

    sortIcons() {
        const appsWithIcons = ["terminal", "browser", "explorer", "editor", "notes", "calc", "clock", "settings", "snake", "paint", "weather", "sysinfo"];
        appsWithIcons.forEach(appKey => {
            localStorage.removeItem(`icon-pos-${appKey}`);
        });
        if (this.refreshDesktopIcons) this.refreshDesktopIcons();
    }
};

class WindowManager {
    constructor() {
        this.container = document.getElementById('window-container');
        this.windows = [];
        this.zIndexCounter = 200; // Start higher than desktop icons and window container base
    }

    createWindow(title, content, width = 400, height = 300, appKey = null) {
        // Generating a random ID so we can target specific windows later
        const id = `win-${Math.random().toString(36).substring(2, 11)}`;
        const win = document.createElement('div');
        win.className = 'window';
        win.id = id;
        win.setAttribute('data-app-key', appKey);
        
        // Default size (can be customized later if needed)
        const winWidth = width;
        const winHeight = height;
        
        // Center the window on the screen
        const left = (window.innerWidth - winWidth) / 2;
        const top = (window.innerHeight - winHeight) / 2;
        
        // Offset new windows slightly so they don't stack perfectly if multiple are opened at once
        const offset = this.windows.length * 20;
        
        win.style.width = `${winWidth}px`;
        win.style.height = `${winHeight}px`; // Added explicit height
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
            win.classList.toggle('maximized');
        };

        // Simple focus mechanism
        win.onmousedown = (e) => {
            if (!win.classList.contains('minimized')) {
                win.style.zIndex = this.zIndexCounter++;
            }
        };

        // Ensure clicking content also focuses
        win.querySelector('.window-content').onmousedown = (e) => {
            // e.stopPropagation(); // Allow it to bubble to win.onmousedown
        };

        this.makeDraggable(win);
        this.container.appendChild(win);
        this.windows.push({ id, title, element: win, appKey });
        this.updateTaskbar();
        return win;
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
                    const snappedLeft = Math.round((left - ICON_GRID.margin) / ICON_GRID.width) * ICON_GRID.width + ICON_GRID.margin;
                    const snappedTop = Math.round((top - ICON_GRID.topOffset) / ICON_GRID.height) * ICON_GRID.height + ICON_GRID.topOffset;
                    
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
                    } 
                    // Snap to Left -> Half Screen Left
                    else if (e.clientX < 10) {
                        element.style.top = '40px';
                        element.style.left = '0';
                        element.style.width = '50%';
                        element.style.height = 'calc(100vh - 40px)';
                    }
                    // Snap to Right -> Half Screen Right
                    else if (e.clientX > window.innerWidth - 10) {
                        element.style.top = '40px';
                        element.style.left = '50%';
                        element.style.width = '50%';
                        element.style.height = 'calc(100vh - 40px)';
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
                <div class="terminal-output" id="${id}-out">ApexOS Shell v0.1\nType 'help' for commands.</div>
                <div class="terminal-input-line">
                    <span>></span>
                    <input type="text" class="terminal-input" id="${id}-in" autofocus>
                </div>
            `, 400, 300, 'terminal');

            const input = document.getElementById(`${id}-in`);
            const output = document.getElementById(`${id}-out`);

            input.onkeydown = (e) => {
                if (e.key === "Enter") {
                    const cmd = input.value.trim().toLowerCase();
                    output.innerHTML += `<div>> ${cmd}</div>`;
                    
                    if (cmd === "ls") {
                        output.innerHTML += `<div>${Kernel.listDir()}</div>`;
                    } else if (cmd.startsWith("mkdir ")) {
                        const name = cmd.substring(6).trim();
                        if (Kernel.makeDir(name)) {
                            output.innerHTML += `<div>Directory created: ${name}</div>`;
                        } else {
                            output.innerHTML += `<div>Failed to create directory.</div>`;
                        }
                    } else if (cmd.startsWith("touch ")) {
                        const name = cmd.substring(6).trim();
                        Kernel.saveFile(name, "");
                        output.innerHTML += `<div>File created: ${name}</div>`;
                    } else if (cmd.startsWith("rm ")) {
                        const name = cmd.substring(3).trim();
                        if (Kernel.deleteFile(name)) {
                            output.innerHTML += `<div>Deleted: ${name}</div>`;
                        } else {
                            output.innerHTML += `<div>File not found: ${name}</div>`;
                        }
                    } else if (cmd.startsWith("cat ")) {
                        const file = cmd.split(" ")[1];
                        if (!file) {
                            output.innerHTML += `<div>Usage: cat <filename></div>`;
                        } else {
                            const content = Kernel.getFile(file);
                            output.innerHTML += content ? `<div style="white-space:pre-wrap; background:#111; padding:5px; border-left:2px solid var(--accent-color)">${content}</div>` : `<div>File not found: ${file}</div>`;
                        }
                    } else if (cmd.startsWith("echo ")) {
                        output.innerHTML += `<div>${input.value.substring(5)}</div>`;
                    } else if (cmd === "matrix") {
                        this.launchMatrix();
                    } else if (cmd === "weather") {
                        Apps.weather.launch();
                    } else if (cmd === "help") {
                        output.innerHTML += `<div>Commands: ls, mkdir, touch, rm, cat, echo, clear, help, whoami, date, apexfetch, neofetch, ver, theme, matrix, weather, reboot</div>`;
                    } else if (cmd === "whoami") {
                        output.innerHTML += `<div>apex_user</div>`;
                    } else if (cmd === "clear") {
                        output.innerHTML = "";
                    } else if (cmd === "date") {
                        output.innerHTML += `<div>${new Date().toLocaleString()}</div>`;
                    } else if (cmd === "ver") {
                        output.innerHTML += `<div>ApexOS v1.3.0 "Power Update"</div>`;
                    } else if (cmd === "reboot") {
                        output.innerHTML += `<div>Rebooting...</div>`;
                        setTimeout(() => location.reload(), 1000);
                    } else if (cmd === "apexfetch" || cmd === "neofetch") {
                        output.innerHTML += `
                            <div style="display:flex; gap:10px; margin-top:5px; color:var(--accent-color)">
                                <div style="font-size:1.5em">🚀</div>
                                <div>
                                    <b>ApexOS v1.3.0</b><br>
                                    Kernel: ApexKernel 0.2.0<br>
                                    VFS: Online<br>
                                    Uptime: ${Math.floor(performance.now()/60000)}m<br>
                                    Resolution: ${window.innerWidth}x${window.innerHeight}
                                </div>
                            </div>
                        `;
                    } else if (cmd.startsWith("theme ")) {
                        const theme = cmd.split(" ")[1];
                        const themes = {
                            "matrix": "default",
                            "cyberpunk": "theme-cyberpunk",
                            "light": "theme-light",
                            "classic": "theme-classic",
                            "sleek": "theme-sleek"
                        };
                        if (themes[theme]) {
                            const target = themes[theme];
                            document.body.className = target === 'default' ? '' : target;
                            localStorage.setItem('apex_theme', target);
                            output.innerHTML += `<div>Theme changed to ${theme}.</div>`;
                        } else {
                            output.innerHTML += `<div>Available themes: matrix, cyberpunk, light, classic, sleek</div>`;
                        }
                    } else if (cmd !== "") {
                        output.innerHTML += `<div>Unknown command: ${cmd}</div>`;
                    }

                    input.value = "";
                    output.scrollTop = output.scrollHeight;
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
                const files = Kernel.listDir().split('  ');
                return files.map(f => `
                    <div class="file-item" data-file="${f}" style="cursor:pointer; text-align:center; padding:5px; border:1px solid transparent">
                        <div style="font-size:1.5em">📄</div>
                        <div style="font-size:0.7em; overflow:hidden; text-overflow:ellipsis">${f}</div>
                    </div>
                `).join('');
            };
            
            wm.createWindow("File Explorer", `
                <div class="explorer-path" style="border-bottom:1px solid #333; margin-bottom:10px; padding-bottom:5px">Location: ${Kernel.currentDir}</div>
                <div class="explorer-files" id="${winId}-files" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px">
                    ${renderFiles()}
                </div>
                <button id="${winId}-refresh" style="margin-top:10px; background:transparent; color:var(--accent-color); border:1px solid var(--accent-color); cursor:pointer; font-size:0.7em; padding:2px 5px">Refresh</button>
            `, 400, 300, 'explorer');

            const attachHandlers = () => {
                const container = document.getElementById(`${winId}-files`);
                if (!container) return;
                
                container.querySelectorAll('.file-item').forEach(item => {
                    item.onclick = () => {
                        const fileName = item.getAttribute('data-file');
                        Apps.editor.launch(fileName);
                    };
                    item.onmouseover = () => item.style.borderColor = 'var(--accent-color)';
                    item.onmouseout = () => item.style.borderColor = 'transparent';
                });
            };

            setTimeout(() => {
                attachHandlers();
                document.getElementById(`${winId}-refresh`).onclick = () => {
                    document.getElementById(`${winId}-files`).innerHTML = renderFiles();
                    attachHandlers();
                };
            }, 100);
        }
    },
    calc: {
        title: "Calc",
        icon: "assets/calculator.png",
        launch: () => {
            const winId = `calc-${Math.random().toString(36).substring(2, 9)}`;
            const win = wm.createWindow("Calculator", `
                <div id="${winId}-display" style="background:#000; color:var(--text-color); padding:10px; text-align:right; margin-bottom:10px; border:1px solid var(--accent-color); min-height:40px; font-size:1.2em">0</div>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:5px">
                    ${['7','8','9','/','4','5','6','*','1','2','3','-','0','C','=','+'].map(b => 
                        `<button class="calc-btn" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">${b}</button>`
                    ).join('')}
                </div>
            `, 400, 300, 'calc');

            let current = "";
            const display = win.querySelector(`#${winId}-display`);
            const btns = win.querySelectorAll(`.calc-btn`);
            
            btns.forEach(btn => {
                btn.onclick = () => {
                    const val = btn.textContent;
                    if (val === "=") {
                        try { current = eval(current).toString(); } catch { current = "Error"; }
                    } else if (val === "C") {
                        current = "";
                    } else {
                        current += val;
                    }
                    display.textContent = current || "0";
                };
            });
        }
    },
    settings: {
        title: "Settings",
        icon: "assets/settings.png",
        launch: () => {
            const winId = `settings-${Date.now()}`;
            const currentTheme = localStorage.getItem('apex_theme') || 'default';
            
            wm.createWindow("Settings", `
                <div style="padding:10px">
                    <label>System Theme:</label>
                    <select id="${winId}-theme" style="width:100%; margin-top:5px; padding:5px; background:#000; color:var(--text-color); border:1px solid var(--accent-color)">
                        <option value="default" ${currentTheme === 'default' ? 'selected' : ''}>Matrix Green</option>
                        <option value="theme-cyberpunk" ${currentTheme === 'theme-cyberpunk' ? 'selected' : ''}>Cyberpunk Purple</option>
                        <option value="theme-light" ${currentTheme === 'theme-light' ? 'selected' : ''}>Light Mode</option>
                        <option value="theme-classic" ${currentTheme === 'theme-classic' ? 'selected' : ''}>Classic OS</option>
                        <option value="theme-sleek" ${currentTheme === 'theme-sleek' ? 'selected' : ''}>Sleek UI</option>
                    </select>

                    <div style="margin-top:10px">
                        <label>Wallpaper (Sleek only):</label>
                        <input type="text" id="${winId}-wp" placeholder="Image URL..." style="width:100%; margin-top:5px; padding:5px; background:#000; color:var(--text-color); border:1px solid var(--accent-color)" value="${localStorage.getItem('apex_wallpaper') || ''}">
                    </div>

                    <div style="margin-top:10px">
                        <label><input type="checkbox" id="${winId}-stats" ${localStorage.getItem('apex_show_stats') === 'true' ? 'checked' : ''}> Show RAM usage in taskbar</label>
                    </div>
                    
                    <div style="margin-top:20px; border-top:1px solid #333; padding-top:10px">
                        <strong>ApexOS v1.3.0</strong><br>
                        VFS Status: Online<br>
                        Persistence: Enabled<br>
                        <button id="${winId}-reset" style="margin-top:10px; padding:5px; background:#f44336; color:#fff; border:none; cursor:pointer; width:100%">Clear All Data (Reset)</button>
                    </div>
                </div>
            `, 400, 450, 'settings');

            document.getElementById(`${winId}-reset`).onclick = () => {
                if(confirm("This will wipe all your files and settings. You sure?")) {
                    localStorage.clear();
                    location.reload();
                }
            };

            document.getElementById(`${winId}-theme`).onchange = (e) => {
                const theme = e.target.value;
                document.body.className = theme === 'default' ? '' : theme;
                localStorage.setItem('apex_theme', theme);
                if (theme === 'theme-sleek') {
                    const savedWallpaper = localStorage.getItem('apex_wallpaper');
                    if (savedWallpaper) document.body.style.backgroundImage = `url('${savedWallpaper}')`;
                } else {
                    document.body.style.backgroundImage = '';
                }
            };

            document.getElementById(`${winId}-wp`).onchange = (e) => {
                localStorage.setItem('apex_wallpaper', e.target.value);
                if (document.body.classList.contains('theme-sleek')) {
                    document.body.style.backgroundImage = `url('${e.target.value}')`;
                }
            };

            document.getElementById(`${winId}-stats`).onchange = (e) => {
                localStorage.setItem('apex_show_stats', e.target.checked);
            };
        }
    },
    sysmon: {
        title: "System Monitor",
        icon: "assets/settings.png",
        launch: () => {
            const winId = `sysmon-${Math.random().toString(36).substring(2, 9)}`;
            wm.createWindow("System Monitor", `
                <div style="padding:10px">
                    <p>OS: ApexOS v1.3.0</p>
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
                    <h2 style="color:var(--text-color)">🚀 ApexOS v1.3.0</h2>
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
            const win = wm.createWindow("Task Manager", `<div id="${winId}-list" style="padding:10px"></div>`, 300, 400, 'taskmgr');
            
            const updateList = () => {
                const list = document.getElementById(`${winId}-list`);
                if (!list) return;
                list.innerHTML = wm.windows.map(w => `
                    <div class="task-item">
                        <span>${w.title}</span>
                        <button onclick="document.getElementById('${w.id}').querySelector('.close-btn').click();" style="background:#f44336; color:#fff; border:none; padding:2px 5px; cursor:pointer">End Task</button>
                    </div>
                `).join('');
            };

            updateList();
            const interval = setInterval(updateList, 2000);
            win.onremove = () => clearInterval(interval);
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
        icon: "assets/folder.png",
        launch: () => {
            const winId = `browser-${Date.now()}`;
            wm.createWindow("ApexBrowser", `
                <div style="display:flex; padding:5px; background:#222; gap:5px">
                    <input type="text" id="${winId}-url" value="https://www.wikipedia.org" style="flex:1; background:#000; border:1px solid #444; color:#fff; padding:2px 5px">
                    <button id="${winId}-go" style="background:var(--accent-color); border:none; padding:2px 10px; cursor:pointer">Go</button>
                </div>
                <iframe id="${winId}-frame" src="https://www.wikipedia.org" style="width:100%; height:calc(100% - 35px); border:none; background:#fff"></iframe>
            `, 600, 450, 'browser');

            const go = () => {
                let url = document.getElementById(`${winId}-url`).value;
                if (!url && !url.trim()) return;
                if (!url.startsWith('http')) url = 'https://' + url;
                document.getElementById(`${winId}-frame`).src = url;
            };

            document.getElementById(`${winId}-go`).onclick = go;
            document.getElementById(`${winId}-url`).onkeydown = (e) => { if(e.key === 'Enter') go(); };
        }
    },
    clock: {
        title: "Clock",
        icon: "assets/settings.png",
        launch: () => {
            const winId = `clock-${Date.now()}`;
            wm.createWindow("Clock & Timer", `
                <div style="padding:15px; text-align:center">
                    <div id="${winId}-time" style="font-size:3em; margin-bottom:20px">00:00:00</div>
                    <div style="display:flex; justify-content:center; gap:10px">
                        <button id="${winId}-start" style="padding:10px 20px; background:var(--accent-color); border:none; cursor:pointer">Start</button>
                        <button id="${winId}-stop" style="padding:10px 20px; background:#444; color:#fff; border:none; cursor:pointer">Reset</button>
                    </div>
                </div>
            `, 300, 200, 'clock');

            let seconds = 0;
            let timer = null;
            const display = document.getElementById(`${winId}-time`);

            document.getElementById(`${winId}-start`).onclick = (e) => {
                if (timer) {
                    clearInterval(timer);
                    timer = null;
                    e.target.textContent = "Start";
                } else {
                    timer = setInterval(() => {
                        seconds++;
                        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
                        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
                        const s = (seconds % 60).toString().padStart(2, '0');
                        display.textContent = `${h}:${m}:${s}`;
                    }, 1000);
                    e.target.textContent = "Stop";
                }
            };

            document.getElementById(`${winId}-stop`).onclick = () => {
                clearInterval(timer);
                timer = null;
                seconds = 0;
                display.textContent = "00:00:00";
                document.getElementById(`${winId}-start`).textContent = "Start";
            };
        }
    },
    sysinfo: {
        title: "System Info",
        icon: "assets/settings.png",
        launch: () => {
            wm.createWindow("System Information", `
                <div style="padding:15px">
                    <h2 style="color:var(--accent-color); margin-bottom:10px">ApexOS Specifications</h2>
                    <table style="width:100%; border-collapse:collapse">
                        <tr><td style="padding:5px; border-bottom:1px solid #333">OS Version</td><td style="padding:5px; border-bottom:1px solid #333">v1.3.0 "Power Update"</td></tr>
                        <tr><td style="padding:5px; border-bottom:1px solid #333">Kernel</td><td style="padding:5px; border-bottom:1px solid #333">ApexKernel 0.2.0-LTS</td></tr>
                        <tr><td style="padding:5px; border-bottom:1px solid #333">VFS Mode</td><td style="padding:5px; border-bottom:1px solid #333">Persistent LocalStorage</td></tr>
                        <tr><td style="padding:5px; border-bottom:1px solid #333">Processor</td><td style="padding:5px; border-bottom:1px solid #333">Virtual Apex Core x86</td></tr>
                        <tr><td style="padding:5px; border-bottom:1px solid #333">Memory</td><td style="padding:5px; border-bottom:1px solid #333">${performance.memory ? Math.round(performance.memory.jsHeapSizeLimit / 1048576) : '4096'}MB</td></tr>
                    </table>
                    <p style="margin-top:15px; font-size:0.8em; opacity:0.6; text-align:center">Copyright © 2026 Naman Shettigar.</p>
                </div>
            `, 400, 350, 'sysinfo');
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
            const fileName = initialFile || "untitled.txt";
            const content = initialFile ? Kernel.getFile(fileName) : "";
            
            const winId = `editor-${Math.random().toString(36).substring(2, 9)}`;
            const win = wm.createWindow("ApexPad", `
                <div style="margin-bottom:5px">Editing: <input type="text" id="${winId}-filename" value="${fileName}" style="background:transparent; border:none; color:var(--accent-color); font-family:inherit"></div>
                <textarea id="${winId}-text" style="width:100%; height:350px; background:#000; color:var(--text-color); border:1px solid var(--accent-color); font-family:inherit; padding:10px; resize:none;">${content}</textarea>
                <div style="text-align:right; margin-top:10px">
                    <button id="${winId}-save" style="padding:8px 20px; background:var(--accent-color); color:#000; border:none; cursor:pointer; font-weight:bold; border-radius:4px">Save to VFS</button>
                </div>
            `, 500, 500, 'editor');

            document.getElementById(`${winId}-save`).onclick = () => {
                const name = document.getElementById(`${winId}-filename`).value;
                const text = document.getElementById(`${winId}-text`).value;
                Kernel.saveFile(name, text);
                alert(`Saved ${name} to ApexOS storage!`);
            };
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
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
    System.refreshDesktopIcons = refreshDesktopIcons;

    // Handle Start Menu App Launches
    document.querySelectorAll('.start-menu-item').forEach(item => {
        item.onclick = () => {
            const appName = item.getAttribute('data-app');
            if (Apps[appName]) Apps[appName].launch();
        };
    });

    // Desktop Icons
    const desktopIcons = document.getElementById('desktop-icons');
    const appsWithIcons = ["terminal", "browser", "explorer", "editor", "notes", "calc", "clock", "settings", "snake", "paint", "weather", "sysinfo"];
    
    const refreshDesktopIcons = () => {
        desktopIcons.innerHTML = '';
        appsWithIcons.forEach((appKey, index) => {
            const app = Apps[appKey];
            const icon = document.createElement('div');
            icon.className = 'desktop-icon';
            icon.setAttribute('data-app', appKey);
            
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
                const desktopHeight = window.innerHeight - ICON_GRID.topOffset;
                
                const iconsPerCol = Math.max(1, Math.floor(desktopHeight / ICON_GRID.height));
                const col = Math.floor(index / iconsPerCol);
                const row = index % iconsPerCol;
                
                icon.style.position = 'absolute';
                icon.style.left = `${ICON_GRID.margin + (col * ICON_GRID.width)}px`;
                icon.style.top = `${ICON_GRID.topOffset + (row * ICON_GRID.height)}px`;
            }

            const iconHtml = app.icon.endsWith('.png') ? `<img src="${app.icon}" alt="${app.title}" style="pointer-events:none">` : app.icon;
            icon.innerHTML = `
                <div class="icon-graphic">${iconHtml}</div>
                <div class="icon-label">${app.title}</div>
            `;
            
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
        });
    };

    refreshDesktopIcons();
    window.addEventListener('resize', () => {
        // Only refresh icons if they aren't manually positioned? 
        // Actually, overlapping often happens when resizing or if the grid logic is flaky.
        // Let's re-run the layout for non-saved icons.
        refreshDesktopIcons();
    });

    setTimeout(() => {
        if (sessionStorage.getItem('apex_booted_once')) return;
        
        const welcomeWin = wm.createWindow('Welcome', `
            <div style="text-align:center; padding:10px;">
                <h2 style="color:var(--text-color)">🚀 ApexOS v1.3.0</h2>
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
