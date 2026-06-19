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
        setInterval(() => {
            const now = new Date();
            clock.textContent = now.toLocaleTimeString();
        }, 1000);
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
        const id = `win-${Date.now()}`;
        const win = document.createElement('div');
        win.className = 'window';
        win.id = id;
        win.style.top = `${50 + (this.windows.length * 30)}px`;
        win.style.left = `${50 + (this.windows.length * 30)}px`;
        win.style.zIndex = this.zIndexCounter++;

        win.innerHTML = `
            <div class="window-header">
                <span>${title}</span>
                <span class="close-btn" style="cursor:pointer">X</span>
            </div>
            <div class="window-content">${content}</div>
        `;

        win.querySelector('.close-btn').onclick = () => {
            win.remove();
            this.windows = this.windows.filter(w => w.element !== win);
            this.updateTaskbar();
        };

        // Simple focus mechanism
        win.onmousedown = () => {
            win.style.zIndex = this.zIndexCounter++;
        };

        this.makeDraggable(win);
        this.container.appendChild(win);
        this.windows.push({ id, title, element: win });
        this.updateTaskbar();
    }

    updateTaskbar() {
        const activeApps = document.getElementById('active-apps');
        activeApps.innerHTML = '';
        this.windows.forEach(w => {
            const btn = document.createElement('div');
            btn.className = 'taskbar-item';
            btn.textContent = w.title;
            btn.onclick = () => {
                w.element.style.zIndex = this.zIndexCounter++;
            };
            activeApps.appendChild(btn);
        });
    }

    makeDraggable(element) {
        const header = element.querySelector('.window-header');
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        header.onmousedown = (e) => {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        };

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
}

// Initializing things
let wm;

const Apps = {
    terminal: {
        title: "Apex Terminal",
        icon: "",
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
                    } else if (cmd === "help") {
                        output.innerHTML += `<div>Commands: ls, clear, help, whoami, date</div>`;
                    } else if (cmd === "whoami") {
                        output.innerHTML += `<div>apex_user</div>`;
                    } else if (cmd === "clear") {
                        output.innerHTML = "";
                    } else if (cmd === "date") {
                        output.innerHTML += `<div>${new Date().toLocaleString()}</div>`;
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
        icon: "",
        launch: () => {
            const winId = `explorer-${Date.now()}`;
            
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
        icon: "󰃬",
        launch: () => {
            const winId = `calc-${Date.now()}`;
            wm.createWindow("Calculator", `
                <div id="${winId}-display" style="background:#000; color:var(--text-color); padding:10px; text-align:right; margin-bottom:10px; border:1px solid var(--accent-color); min-height:40px; font-size:1.2em">0</div>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:5px">
                    ${['7','8','9','/','4','5','6','*','1','2','3','-','0','C','=','+'].map(b => 
                        `<button class="calc-btn" style="padding:10px; background:var(--window-bg); color:var(--text-color); border:1px solid #444; cursor:pointer">${b}</button>`
                    ).join('')}
                </div>
            `);

            let current = "";
            const display = document.getElementById(`${winId}-display`);
            const btns = document.querySelectorAll(`#win-${winId.split('-')[1]} .calc-btn`);
            
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
        icon: "⚙️",
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
                    </select>
                    <div style="margin-top:20px; font-size:0.8em; opacity:0.7">
                        ApexOS v0.1.0<br>
                        VFS Status: Online<br>
                        Persistence: Enabled
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
    editor: {
        title: "ApexPad",
        icon: "📝",
        launch: (initialFile = null) => {
            const fileName = initialFile || "untitled.txt";
            const content = initialFile ? Kernel.getFile(fileName) : "";
            
            const winId = `editor-${Date.now()}`;
            wm.createWindow("ApexPad", `
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

    startBtn.onclick = (e) => {
        e.stopPropagation();
        startMenu.classList.toggle('hidden');
    };

    document.addEventListener('click', () => {
        startMenu.classList.add('hidden');
    });

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
        const icon = document.createElement('div');
        icon.className = 'desktop-icon';
        icon.innerHTML = `
            <div class="icon-graphic">${app.icon}</div>
            <div class="icon-label">${app.title}</div>
        `;
        icon.onclick = () => app.launch();
        desktopIcons.appendChild(icon);
    });

    // Just for fun, let's open a "Readme" after boot
    setTimeout(() => {
        wm.createWindow('Welcome', `
            <h3>Welcome to ApexOS</h3>
            <p>This is a human-centric experiment in minimalism.</p>
            <br>
            <p>Click the <b>APEX</b> button or double-click icons to start.</p>
        `);
    }, 5500);
});
