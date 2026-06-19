/**
 * ApexOS - A Retro-Modern WebOS
 * "Because even code should feel like it has a soul."
 */

// --- Virtual File System (VFS) ---
// Just a simple nested object for now.
// Note to self: maybe move this to localStorage later so users can save stuff.
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

    getFile(path) {
        // Look in /home/user for simplicity
        return VFS["/"]["home"]["user"][path] || null;
    },

    saveFile(path, content) {
        VFS["/"]["home"]["user"][path] = content;
        Storage.save(); // Persist immediately
        
        // Refresh explorer if open
        const explorers = document.querySelectorAll('.window-header span');
        explorers.forEach(span => {
            if (span.textContent === "File Explorer") {
                // This is a bit hacky but works for now: relaunch to refresh
                // Apps.explorer.launch(); // Don't do this, it opens a new window
                // Better: find the specific window and refresh its content
                // For now, let's just log it.
            }
        });
        console.log(`Saved ${path}`);
    },

    listDir() {
        return Object.keys(VFS["/"]["home"]["user"]).join("  ");
    },

    async boot() {
        Storage.load(); // Load files before boot finishes
        
        // Apply saved theme
        const savedTheme = localStorage.getItem('apex_theme');
        if (savedTheme && savedTheme !== 'default') {
            document.body.className = savedTheme;
        }

        const logContainer = document.getElementById('boot-log');
        const bootScreen = document.getElementById('boot-screen');
        const desktop = document.getElementById('desktop');

        // Check if we already booted this session to skip long waits
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
        }, 1000);
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
        wm.createWindow("Clock", content);
    }
};

// --- Window Management ---
// I'm keeping this simple but expandable. Using a class might be overkill, 
// but it makes managing multiple instances much cleaner.

class WindowManager {
    constructor() {
        this.container = document.getElementById('window-container');
        this.windows = [];
        this.zIndexCounter = 10;
    }

    createWindow(title, content) {
        const id = `win-${Math.random().toString(36).substring(2, 11)}`;
        const win = document.createElement('div');
        win.className = 'window';
        win.id = id;
        win.style.top = `${50 + (this.windows.length * 30)}px`;
        win.style.left = `${50 + (this.windows.length * 30)}px`;
        win.style.zIndex = this.zIndexCounter++;

        win.innerHTML = `
            <div class="window-header">
                <span>${title}</span>
                <div class="window-controls">
                    <span class="control-btn min-btn">_</span>
                    <span class="control-btn max-btn">[]</span>
                    <span class="control-btn close-btn">X</span>
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
        win.onmousedown = () => {
            if (!win.classList.contains('minimized')) {
                win.style.zIndex = this.zIndexCounter++;
            }
        };

        this.makeDraggable(win);
        this.container.appendChild(win);
        this.windows.push({ id, title, element: win });
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
            btn.textContent = w.title;
            btn.onclick = () => {
                if (w.element.classList.contains('minimized')) {
                    w.element.classList.remove('minimized');
                }
                w.element.style.zIndex = this.zIndexCounter++;
            };
            activeApps.appendChild(btn);
        });
    }

    makeDraggable(element, isIcon = false) {
        const handle = isIcon ? element : element.querySelector('.window-header');
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = (e) => {
            if (e.button !== 0) return; // Only left click
            e.preventDefault();
            
            // For icons, we might want to bring them to front or just handle the drag
            if (isIcon) {
                element.style.position = 'absolute';
                element.style.zIndex = 1000;
            } else {
                element.style.zIndex = this.zIndexCounter++;
            }

            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        };

        const elementDrag = (e) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        };

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            if (isIcon) {
                element.style.zIndex = 1; // Reset z-index after drag
                // Save position if we had a persistence system
                const appKey = element.getAttribute('data-app');
                localStorage.setItem(`icon-pos-${appKey}`, JSON.stringify({
                    top: element.style.top,
                    left: element.style.left
                }));
            }
        }
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
            `);

            const input = document.getElementById(`${id}-in`);
            const output = document.getElementById(`${id}-out`);

            input.onkeydown = (e) => {
                if (e.key === "Enter") {
                    const cmd = input.value.trim().toLowerCase();
                    output.innerHTML += `<div>> ${cmd}</div>`;
                    
                    if (cmd === "ls") {
                        output.innerHTML += `<div>${Kernel.listDir()}</div>`;
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
                    } else if (cmd === "help") {
                        output.innerHTML += `<div>Commands: ls, cat, echo, clear, help, whoami, date, apexfetch, theme</div>`;
                    } else if (cmd === "whoami") {
                        output.innerHTML += `<div>apex_user</div>`;
                    } else if (cmd === "clear") {
                        output.innerHTML = "";
                    } else if (cmd === "date") {
                        output.innerHTML += `<div>${new Date().toLocaleString()}</div>`;
                    } else if (cmd === "apexfetch") {
                        output.innerHTML += `
                            <div style="display:flex; gap:10px; margin-top:5px; color:var(--accent-color)">
                                <div style="font-size:1.5em">🚀</div>
                                <div>
                                    <b>ApexOS v1.0.0</b><br>
                                    Kernel: ApexKernel 0.1.0<br>
                                    VFS: Online<br>
                                    Uptime: ${Math.floor(performance.now()/60000)}m
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
        }
    },
    explorer: {
        title: "File Explorer",
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
            `);

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
        title: "Calculator",
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
            `);

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
                    
                    <div style="margin-top:20px; border-top:1px solid #333; padding-top:10px">
                        <strong>ApexOS v1.0.0</strong><br>
                        VFS Status: Online<br>
                        Persistence: Enabled<br>
                        <p style="font-size:0.8em; margin-top:10px; opacity:0.7">System details available in 'About ApexOS'</p>
                    </div>
                </div>
            `);

            document.getElementById(`${winId}-theme`).onchange = (e) => {
                const theme = e.target.value;
                document.body.className = theme === 'default' ? '' : theme;
                localStorage.setItem('apex_theme', theme);
            };
        }
    },
    sysmon: {
        title: "System Monitor",
        icon: "assets/folder.png",
        launch: () => {
            const winId = `sysmon-${Math.random().toString(36).substring(2, 9)}`;
            wm.createWindow("System Monitor", `
                <div style="padding:10px">
                    <p>OS: ApexOS v1.0.0</p>
                    <p>Kernel: ApexKernel 0.1.0</p>
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
            `);

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
        icon: "assets/folder.png",
        launch: () => {
            const win = wm.createWindow("About ApexOS", `
                <div style="text-align:center; padding:10px;">
                    <h2 style="color:var(--text-color)">🚀 ApexOS v1.0.0</h2>
                    <p>Created by: <b>Naman Shettigar</b></p>
                    <p>A retro-modern WebOS experience.</p>
                    <hr style="border:0; border-top:1px solid #333; margin:15px 0;">
                    <p>Built with Vanilla JS, CSS, and HTML.</p>
                    <p>Hosted at: <a href="https://nshettigar.me/WebOS/" target="_blank" style="color:var(--text-color)">nshettigar.me/WebOS/</a></p>
                    <br>
                    <button class="about-close-btn" style="padding:5px 10px; background:var(--accent-color); color:#000; border:none; cursor:pointer">Close</button>
                </div>
            `);
            win.querySelector('.about-close-btn').onclick = () => {
                win.querySelector('.control-btn.close-btn').click();
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
                <textarea id="${winId}-text" style="width:100%; height:200px; background:#000; color:var(--text-color); border:1px solid var(--accent-color); font-family:inherit; padding:10px;">${content}</textarea>
                <button id="${winId}-save" style="margin-top:5px; padding:5px; background:var(--accent-color); color:#000; border:none; cursor:pointer">Save to VFS</button>
            `);

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

    // Handle Start Menu App Launches
    document.querySelectorAll('.start-menu-item').forEach(item => {
        item.onclick = () => {
            const appName = item.getAttribute('data-app');
            if (Apps[appName]) Apps[appName].launch();
        };
    });

    // Desktop Icons
    const desktopIcons = document.getElementById('desktop-icons');
    Object.keys(Apps).forEach(appKey => {
        const app = Apps[appKey];
        if (!app.icon) return; // Skip apps without icons for desktop
        const icon = document.createElement('div');
        icon.className = 'desktop-icon';
        icon.setAttribute('data-app', appKey);
        
        // Restore position if saved
        const savedPos = localStorage.getItem(`icon-pos-${appKey}`);
        if (savedPos) {
            const pos = JSON.parse(savedPos);
            icon.style.position = 'absolute';
            icon.style.top = pos.top;
            icon.style.left = pos.left;
        }

        const iconHtml = app.icon.endsWith('.png') ? `<img src="${app.icon}" alt="${app.title}">` : app.icon;
        icon.innerHTML = `
            <div class="icon-graphic">${iconHtml}</div>
            <div class="icon-label">${app.title}</div>
        `;
        
        let dragStarted = false;
        icon.addEventListener('mousedown', () => { dragStarted = false; });
        icon.addEventListener('mousemove', () => { dragStarted = true; });
        icon.addEventListener('click', (e) => {
            if (!dragStarted) {
                app.launch();
            }
        });

        wm.makeDraggable(icon, true);
        desktopIcons.appendChild(icon);
    });

    setTimeout(() => {
        if (sessionStorage.getItem('apex_booted_once')) return;
        
        const welcomeWin = wm.createWindow('Welcome', `
            <div style="text-align:center; padding:10px;">
                <h2 style="color:var(--text-color)">🚀 ApexOS v1.0.0</h2>
                <p>System Initialized Successfully.</p>
                <hr style="border:0; border-top:1px solid #333; margin:15px 0;">
                <p>Welcome to your retro-modern workspace.</p>
                <br>
                <p>Type 'help' in the terminal or use the APEX menu to begin.</p>
                <br>
                <button class="welcome-start-btn" style="padding:10px 20px; background:var(--accent-color); color:#000; border:none; cursor:pointer; font-weight:bold;">GET STARTED</button>
            </div>
        `);

        welcomeWin.querySelector('.welcome-start-btn').onclick = () => {
            welcomeWin.querySelector('.control-btn.close-btn').click();
        };

        sessionStorage.setItem('apex_booted_once', 'true');
    }, 5500);
});
