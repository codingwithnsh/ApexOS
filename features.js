// ApexOS - Extra Features Module
// Adds: terminal tabs/splits, app store, permissions manager, shortcut editor,
// collaboration stub (manual signaling), backup/restore, theme manager, scheduler,
// developer tools, smart launcher enhancements, and helpers for desktop icons.

(function(){
    // Ensure we don't run until core has initialized. Poll until ready or timeout.
    const whenReady = (fn, timeout = 5000) => {
        const start = Date.now();
        const check = () => {
            if (window.System && window.Apps && window.wm && window.Kernel && window.Storage) {
                try { fn(); } catch (e) { console.error('features.js init failed', e); }
                return;
            }
            if (Date.now() - start > timeout) {
                console.warn('features.js: core objects not ready within timeout.');
                return;
            }
            setTimeout(check, 50);
        };
        check();
    };

    whenReady(() => {
        // --- Helper: Add/Remove Desktop Icon without touching internal arrays ---
        System.addDesktopIcon = function(appKey) {
            try {
                const app = Apps[appKey];
                if (!app) { System.notify(`App not found: ${appKey}`, 'error'); return false; }
                const desktopIcons = document.getElementById('desktop-icons');
                if (!desktopIcons) return false;
                // Avoid duplicates
                if ([...desktopIcons.children].some(el => el.getAttribute('data-app') === appKey)) return false;

                const icon = document.createElement('div');
                icon.className = 'desktop-icon';
                icon.setAttribute('tabindex', '0');
                icon.setAttribute('role', 'button');
                icon.setAttribute('aria-label', `Launch ${app.title || appKey}`);
                icon.setAttribute('data-app', appKey);

                // Simple placement: place at next free slot or stack
                icon.style.position = 'absolute';
                icon.style.left = `${20 + (desktopIcons.children.length % 6) * (ICON_GRID.width||110)}px`;
                icon.style.top = `${(ICON_GRID.topOffset||60) + Math.floor(desktopIcons.children.length/6) * (ICON_GRID.height||130)}px`;
                icon.style.zIndex = 150;

                const iconHtml = app.icon && typeof app.icon === 'string' && app.icon.endsWith('.png') ? `<img src="${app.icon}" alt="${app.title||appKey}" style="pointer-events:none; width:54px; height:54px;">` : `<div style="font-size:3em">${app.icon || '⚙️'}</div>`;
                icon.innerHTML = `
                    <div class="icon-graphic" style="display:flex; align-items:center; justify-content:center; width:64px; height:64px; background:rgba(255,255,255,0.05); border-radius:12px;">${iconHtml}</div>
                    <div class="icon-label">${app.title || appKey}</div>
                `;

                let dragStarted = false; let startX; let startY;
                icon.addEventListener('mousedown', (e)=>{ startX = e.clientX; startY = e.clientY; dragStarted = false; });
                icon.addEventListener('mousemove', (e)=>{ if(startX===undefined) return; if(Math.abs(e.clientX-startX)>5||Math.abs(e.clientY-startY)>5) dragStarted=true; });
                icon.addEventListener('mouseup', ()=>{ startX=undefined; });
                icon.addEventListener('click', ()=>{ try { if(!dragStarted) app.launch(); } catch(err) { console.error(err); } });
                icon.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' ') { e.preventDefault(); try { app.launch(); } catch(err){ console.error(err); } } });

                try { wm && wm.makeDraggable && wm.makeDraggable(icon, true); } catch(e) { console.warn('makeDraggable failed', e); }
                desktopIcons.appendChild(icon);
                if (typeof System.refreshDesktopIcons === 'function') System.refreshDesktopIcons();
                System.notify(`Installed ${app.title || appKey} to Desktop`, 'success');
                return true;
            } catch (e) { console.error(e); return false; }
        };

        System.removeDesktopIcon = function(appKey) {
            try {
                const desktopIcons = document.getElementById('desktop-icons');
                if (!desktopIcons) return false;
                const el = [...desktopIcons.children].find(c => c.getAttribute('data-app') === appKey);
                if (el) el.remove();
                if (typeof System.refreshDesktopIcons === 'function') System.refreshDesktopIcons();
                System.notify(`Removed ${appKey} from Desktop`, 'info');
                return true;
            } catch(e) { console.error(e); return false; }
        };

        // --- App Store ---
        Apps.appstore = Apps.appstore || {};
        Apps.appstore.title = 'App Store';
        Apps.appstore.icon = 'assets/appstore.png';
        Apps.appstore.launch = function() {
            const installed = Kernel.Registry.get('HKCU\\Software\\InstalledApps', {}) || {};
            let html = `<div style="padding:12px; color:white"><h3>App Store</h3><div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; margin-top:10px">`;
            const catalog = Object.keys(Apps).map(k => ({ key:k, title: Apps[k].title || k, icon: Apps[k].icon || '⚙️' }));
            catalog.forEach(item => {
                const isInstalled = !!installed[item.key];
                html += `
                    <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; text-align:center;">
                        <div style="font-size:2em">${item.icon.endsWith('.png') ? `<img src='${item.icon}' style='width:48px;height:48px'/>` : item.icon}</div>
                        <div style="margin-top:8px">${item.title}</div>
                        <div style="margin-top:8px">
                            <button style='padding:6px 8px; cursor:pointer' data-app='${item.key}'>${isInstalled? 'Uninstall' : 'Install'}</button>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;

            const win = wm.createWindow('App Store', html, 700, 420, 'appstore');
            win.querySelectorAll('button[data-app]').forEach(btn => {
                btn.onclick = (e) => {
                    const key = e.target.getAttribute('data-app');
                    const inst = Kernel.Registry.get('HKCU\\Software\\InstalledApps', {}) || {};
                    if (inst[key]) {
                        delete inst[key];
                        Kernel.Registry.set('HKCU\\Software\\InstalledApps', inst);
                        System.removeDesktopIcon(key);
                        System.notify(`${Apps[key].title || key} uninstalled`, 'warning');
                        e.target.textContent = 'Install';
                    } else {
                        inst[key] = { installedAt: Date.now() };
                        Kernel.Registry.set('HKCU\\Software\\InstalledApps', inst);
                        System.addDesktopIcon(key);
                        System.notify(`${Apps[key].title || key} installed`, 'success');
                        e.target.textContent = 'Uninstall';
                    }
                };
            });
        };

        // --- Terminal: Tabs & Split Panes (basic tabs) ---
        Apps.terminal.launchTabs = function() {
            const win = wm.createWindow('Terminal (Tabs)', `
                <div style="display:flex; flex-direction:column; height:100%">
                    <div id="term-tabbar" style="display:flex; gap:6px; padding:6px; border-bottom:1px solid #333"></div>
                    <div id="term-tabviews" style="flex:1; position:relative; overflow:hidden"></div>
                    <div style="padding:6px; border-top:1px solid #333; display:flex; gap:8px; align-items:center">
                        <input id="term-input-global" style="flex:1; background:transparent; border:none; color:white; outline:none" placeholder="Type command for active tab...">
                        <button id="term-newtab">New Tab</button>
                    </div>
                </div>
            `, 700, 480, 'terminal');

            const tabbar = win.querySelector('#term-tabbar');
            const views = win.querySelector('#term-tabviews');
            const globalInput = win.querySelector('#term-input-global');
            const tabs = [];

            function createTab(name) {
                const id = `t-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                const tabBtn = document.createElement('div');
                tabBtn.className = 'browser-tab';
                tabBtn.style.padding = '6px 10px';
                tabBtn.style.cursor = 'pointer';
                tabBtn.textContent = name || 'Terminal';

                const view = document.createElement('div');
                view.style.position = 'absolute';
                view.style.top = '0'; view.style.left = '0'; view.style.right='0'; view.style.bottom='0';
                view.style.padding = '10px';
                view.style.overflowY = 'auto';
                view.style.fontFamily = 'monospace';
                view.style.display = 'none';
                view.innerHTML = `<div><b>${name}</b></div>`;

                tabBtn.onclick = () => setActive(id);

                tabbar.appendChild(tabBtn);
                views.appendChild(view);
                tabs.push({ id, btn: tabBtn, view, history: [] });
                setActive(id);
                return id;
            }

            function setActive(id) {
                tabs.forEach(t => {
                    const active = t.id === id;
                    t.view.style.display = active ? 'block' : 'none';
                    t.btn.classList.toggle('active', active);
                    if (active) t.view.scrollTop = t.view.scrollHeight;
                });
            }

            win.querySelector('#term-newtab').onclick = () => createTab('Terminal');
            globalInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const txt = globalInput.value.trim();
                    if (!txt) return;
                    const active = tabs.find(t => t.btn.classList.contains('active')) || tabs[0];
                    if (!active) return;
                    active.history.push(txt);
                    active.view.innerHTML += `<div style="color:var(--accent-color)">> ${txt}</div>`;
                    // Hook basic commands into Kernel like existing terminal
                    if (txt.startsWith('echo ')) active.view.innerHTML += `<div>${txt.slice(5)}</div>`;
                    else if (txt === 'clear') active.view.innerHTML = '';
                    else if (txt === 'whoami') active.view.innerHTML += `<div>apex_user</div>`;
                    else if (txt === 'backup') System.backup();
                    else if (txt === 'help') active.view.innerHTML += `<div>Basic tabs: echo/clear/whoami/backup/restore/help</div>`;
                    else active.view.innerHTML += `<div style='opacity:0.7'>Command not recognized in mini-shell.</div>`;
                    globalInput.value = '';
                    active.view.scrollTop = active.view.scrollHeight;
                }
            };

            // create initial tab
            createTab('Terminal');
        };

        // Override default terminal launcher to open tabs UI
        const originalTerminalLaunch = (Apps.terminal && Apps.terminal.launch) ? Apps.terminal.launch : null;
        if (Apps.terminal) {
            Apps.terminal.launch = function() {
                try { Apps.terminal.launchTabs(); } catch(e) { console.error(e); if (originalTerminalLaunch) try { originalTerminalLaunch(); } catch(_){} }
            };
        }

        // --- Permissions / Sandboxing Manager ---
        System.permissions = System.permissions || {};
        System.permissions.data = Kernel.Registry.get('HKCU\\Software\\AppPermissions', {}) || {};
        System.openPermissionsManager = function() {
            let html = `<div style='padding:12px; color:white'><h3>App Permissions</h3><div style='display:flex;flex-direction:column;gap:8px;margin-top:10px'>`;
            Object.keys(Apps).forEach(k => {
                const perms = System.permissions.data[k] || { camera:false, mic:false, storage:true };
                html += `<div style='display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:6px;background:rgba(255,255,255,0.02)'><div><b>${Apps[k].title||k}</b><div style='font-size:0.8em;opacity:0.6'>${k}</div></div><div style='display:flex;gap:6px;align-items:center'><label style='font-size:0.8em'>Cam<input type='checkbox' data-app='${k}' data-perm='camera' ${perms.camera?'checked':''}></label><label style='font-size:0.8em'>Mic<input type='checkbox' data-app='${k}' data-perm='mic' ${perms.mic?'checked':''}></label><label style='font-size:0.8em'>Storage<input type='checkbox' data-app='${k}' data-perm='storage' ${perms.storage?'checked':''}></label></div></div>`;
            });
            html += `</div></div>`;
            const win = wm.createWindow('Permissions', html, 600, 480, 'settings');
            win.querySelectorAll('input[type=checkbox]').forEach(cb => {
                cb.onchange = (e) => {
                    const app = e.target.getAttribute('data-app');
                    const perm = e.target.getAttribute('data-perm');
                    System.permissions.data[app] = System.permissions.data[app] || {camera:false,mic:false,storage:true};
                    System.permissions.data[app][perm] = e.target.checked;
                    Kernel.Registry.set('HKCU\\Software\\AppPermissions', System.permissions.data);
                    System.notify(`Set ${perm} for ${app} => ${e.target.checked}`, 'info');
                };
            });
        };

        // --- Shortcuts Editor ---
        System.openShortcutEditor = function() {
            const shortcuts = Kernel.Registry.get('HKCU\\Shortcuts', { 'Toggle Spotlight': 'Meta+Space' });
            let html = `<div style='padding:12px;color:white'><h3>Keyboard Shortcuts</h3><div style='display:flex;flex-direction:column;gap:8px;margin-top:10px'>`;
            Object.keys(shortcuts).forEach(name => {
                const val = shortcuts[name];
                html += `<div style='display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:6px;background:rgba(255,255,255,0.02)'><div>${name}</div><input data-key='${name}' value='${val}' style='background:transparent; border:1px solid #333; color:white; padding:6px; border-radius:6px'></div>`;
            });
            html += `</div><div style='margin-top:12px'><button id='sc-save'>Save</button></div></div>`;
            const win = wm.createWindow('Shortcut Editor', html, 540, 380, 'settings');
            win.querySelector('#sc-save').onclick = () => {
                win.querySelectorAll('input[data-key]').forEach(inp => {
                    const key = inp.getAttribute('data-key');
                    shortcuts[key] = inp.value;
                });
                Kernel.Registry.set('HKCU\\Shortcuts', shortcuts);
                System.notify('Shortcuts saved', 'success');
                win.querySelector('.control-btn.close-btn').click();
            };
        };

        // Bind editor to Settings app if present
        if (Apps.settings && !Apps.settings.openShortcutsBound) {
            const orig = Apps.settings.launch;
            Apps.settings.launch = function() {
                orig && orig();
                // keep the existing behavior; user can open Shortcuts from Control Center later
            };
            Apps.settings.openShortcutEditor = System.openShortcutEditor;
            Apps.settings.openPermissions = System.openPermissionsManager;
            Apps.settings.openThemeManager = () => System.openThemeManager();
            Apps.settings.openBackup = () => System.openBackupWindow();
            Apps.settings.openShortcutEditor && (Apps.settings.openShortcutsBound = true);
        }

        // --- Backup / Restore (download + import) ---
        System.backup = function() {
            const blob = new Blob([JSON.stringify(VFS, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `apexos-backup-${Date.now()}.json`; a.click();
            URL.revokeObjectURL(url);
            System.notify('Backup exported', 'success');
        };

        System.openBackupWindow = function() {
            const html = `<div style='padding:12px;color:white'><h3>Backup & Restore</h3><div style='display:flex;gap:8px;margin-top:10px'><button id='do-backup'>Download Backup</button><input id='file-restore' type='file' accept='.json' style='display:none'><button id='do-restore'>Restore From File</button></div><div style='margin-top:10px;font-size:0.9em;opacity:0.8'>Restoring will overwrite your current VFS. Proceed with caution.</div></div>`;
            const win = wm.createWindow('Backup', html, 520, 220, 'settings');
            win.querySelector('#do-backup').onclick = System.backup;
            win.querySelector('#do-restore').onclick = () => win.querySelector('#file-restore').click();
            win.querySelector('#file-restore').onchange = (e) => {
                const f = e.target.files[0]; if(!f) return;
                const r = new FileReader(); r.onload = async (ev) => {
                    try { VFS = JSON.parse(ev.target.result); await Storage.save(); System.notify('Restore complete. Reloading...', 'success'); setTimeout(()=>location.reload(),800); } catch(err){ System.notify('Restore failed', 'error'); }
                }; r.readAsText(f);
            };
        };

        // --- Theme Engine & Marketplace (simple) ---
        System.themes = System.themes || {
            'sleek': 'theme-sleek',
            'light': 'theme-light',
            'cyberpunk': 'theme-cyberpunk',
            'classic': 'theme-classic'
        };

        System.openThemeManager = function() {
            let html = `<div style='padding:12px;color:white'><h3>Themes</h3><div style='display:flex;gap:8px;margin-top:10px'>`;
            Object.keys(System.themes).forEach(key => {
                html += `<div style='padding:10px;border-radius:8px;background:rgba(255,255,255,0.02)'><div style='font-weight:bold'>${key}</div><div style='margin-top:8px'><button data-theme='${key}'>Apply</button></div></div>`;
            });
            html += `</div></div>`;
            const win = wm.createWindow('Themes', html, 520, 240, 'settings');
            win.querySelectorAll('button[data-theme]').forEach(btn => btn.onclick = (e) => {
                const theme = e.target.getAttribute('data-theme');
                const bodyClass = System.themes[theme] || '';
                document.body.className = bodyClass;
                Kernel.Registry.set('HKLM\\Software\\System\\Theme', bodyClass);
                System.notify(`Theme applied: ${theme}`, 'success');
            });
        };

        // --- Scheduler / Alarms ---
        System.scheduler = System.scheduler || { tasks: [] };
        System.scheduler.init = function() {
            if (this._inited) return; this._inited = true;
            setInterval(() => {
                const now = Date.now();
                this.tasks.forEach(t => {
                    if (!t._fired && t.time <= now) {
                        t._fired = true;
                        System.notify(`Scheduled: ${t.title}`, 'info');
                        if (t.action === 'open-app' && Apps[t.target]) Apps[t.target].launch();
                    }
                });
            }, 1000);
        };
        System.scheduler.addTask = function(title, timeMs, action = 'notify', target = null) {
            const task = { id: `s-${Date.now()}-${Math.floor(Math.random()*1000)}`, title, time: timeMs, action, target };
            // `this` refers to System.scheduler here
            this.tasks.push(task);
            Kernel.Registry.set('HKCU\\Scheduler', this.tasks);
            System.notify(`Task scheduled: ${title}`, 'success');
            return task;
        };
        System.openScheduler = function() {
            System.scheduler.init();
            let html = `<div style='padding:12px;color:white'><h3>Scheduled Tasks</h3><div style='display:flex;flex-direction:column;gap:8px;margin-top:10px'><div><input id='sched-title' placeholder='Title' style='width:60%'><input id='sched-time' placeholder='Delay (seconds)' style='width:30%'><button id='sched-add'>Add</button></div><div id='sched-list' style='margin-top:8px'></div></div></div>`;
            const win = wm.createWindow('Scheduler', html, 540, 380, 'settings');
            const list = win.querySelector('#sched-list');
            const reloadList = () => { list.innerHTML = System.scheduler.tasks.map(t => `<div style='padding:6px;background:rgba(255,255,255,0.02);border-radius:6px'>${t.title} - ${new Date(t.time).toLocaleString()}</div>`).join(''); };
            win.querySelector('#sched-add').onclick = () => {
                const t = win.querySelector('#sched-title').value || 'Alarm';
                const s = parseInt(win.querySelector('#sched-time').value||'10',10);
                const timeMs = Date.now() + Math.max(1,s)*1000;
                try { System.scheduler.addTask(t, timeMs); } catch(e) { console.error('Failed to add scheduled task', e); }
                reloadList();
            };
            reloadList();
        };

        // --- Developer Tools (basic inspector & live reload) ---
        Apps.devtools = Apps.devtools || { title: 'Dev Tools', icon: '⚒️' };
        Apps.devtools.launch = function() {
            const html = `<div style='padding:12px;color:white'><h3>Developer Tools</h3><div style='display:flex;gap:8px'><button id='dt-inspect'>Inspect Element</button><button id='dt-reload'>Live Reload</button></div><div id='dt-log' style='margin-top:10px; max-height:300px; overflow:auto; background:rgba(255,255,255,0.02); padding:10px; border-radius:6px'></div></div>`;
            const win = wm.createWindow('Dev Tools', html, 640, 420, 'devtools');
            const log = win.querySelector('#dt-log');
            win.querySelector('#dt-reload').onclick = () => { System.notify('Reloading...', 'info'); setTimeout(()=>location.reload(),300); };
            win.querySelector('#dt-inspect').onclick = () => {
                log.innerHTML += '<div>Click any element to inspect. Press Escape to stop.</div>';
                const handler = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const r = e.target.getBoundingClientRect();
                    log.innerHTML += `<div style="padding:8px;border-radius:6px;background:rgba(255,255,255,0.03)">Tag: ${e.target.tagName} | Classes: ${e.target.className} | HTML: ${e.target.outerHTML.substring(0,200)}</div>`;
                };
                document.addEventListener('click', handler, { once: true, capture:true });
            };
        };

        // --- Simple Collaboration (manual signaling using copy/paste SDP) ---
        Apps.collaboration = Apps.collaboration || { title:'Collaboration', icon:'👥'};
        Apps.collaboration.launch = function() {
            const html = `<div style='padding:12px;color:white'><h3>Collaboration (Manual Signaling)</h3>
                <div style='display:flex;flex-direction:column;gap:8px'><button id='coll-start'>Start Session (Create Offer)</button><textarea id='coll-offer' placeholder='Offer / Answer goes here' style='height:120px'></textarea><button id='coll-apply'>Apply Remote SDP</button><div id='coll-state'></div></div></div>`;
            const win = wm.createWindow('Collaboration', html, 560, 380, 'collab');
            let pc, dc;
            win.querySelector('#coll-start').onclick = async () => {
                try {
                    pc = new RTCPeerConnection();
                    dc = pc.createDataChannel('apex-collab');
                    dc.onopen = () => System.notify('Data channel opened', 'success');
                    dc.onmessage = (ev) => System.notify(`Peer: ${ev.data}`, 'info');
                    pc.onicecandidate = (e) => {
                        if (!e.candidate && pc && pc.localDescription) {
                            try { win.querySelector('#coll-offer').value = JSON.stringify(pc.localDescription); } catch(e){}
                        }
                    };
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    win.querySelector('#coll-state').textContent = 'Offer created. Share the SDP with peer.';
                } catch(err) { console.error('Collaboration start failed', err); System.notify('Failed to start collaboration', 'error'); }
            };
            win.querySelector('#coll-apply').onclick = async () => {
                const val = win.querySelector('#coll-offer').value.trim(); if(!val) return;
                try {
                    const obj = JSON.parse(val);
                    if (!pc) pc = new RTCPeerConnection();
                    await pc.setRemoteDescription(obj);
                    if (obj.type === 'offer') {
                        const ans = await pc.createAnswer();
                        await pc.setLocalDescription(ans);
                        // show answer for copy
                        win.querySelector('#coll-offer').value = JSON.stringify(pc.localDescription);
                    }
                    pc.ondatachannel = (e) => { dc = e.channel; dc.onmessage = (ev) => System.notify(`Peer: ${ev.data}`, 'info'); };
                    System.notify('Remote SDP applied', 'success');
                } catch(err) { console.error('Apply SDP failed', err); System.notify('Failed to apply SDP', 'error'); }
            };
        };

        // --- Smart Launcher AI suggestions (mocked) ---
        const origSpotlight = System.toggleSpotlight;
        System.toggleSpotlight = function() {
            try {
                origSpotlight && origSpotlight();
                setTimeout(()=>{
                    const input = document.getElementById('spotlight-input');
                    const results = document.getElementById('spotlight-results');
                    if (!input || !results) return;
                    const query = input.value.trim().toLowerCase();
                    const suggestions = [];
                    // Mock AI: suggest recently used apps and files
                    try { const recentApps = (Kernel && Kernel.ProcessManager && Kernel.ProcessManager.processes||[]).slice(-5).map(p => p.name).filter(Boolean); recentApps.forEach(a => suggestions.push({type:'app', title:`Reopen ${a}`})); } catch(e){}
                    try { Object.keys(VFS['/'] || {}).slice(0,5).forEach(f => suggestions.push({type:'file', title:`Open ${f}`})); } catch(e){}
                    // Prepare suggestion container
                    let sug = results.querySelector('#spotlight-suggestions');
                    if (!sug) {
                        sug = document.createElement('div');
                        sug.id = 'spotlight-suggestions';
                        results.prepend(sug);
                    }
                    let html = `<div style='opacity:0.7;margin-bottom:8px'>AI Suggestions</div>`;
                    suggestions.forEach(s => html += `<div style='padding:8px;border-radius:6px;background:rgba(255,255,255,0.02);margin-bottom:6px'>${s.title}</div>`);
                    sug.innerHTML = html;
                }, 120);
            } catch(e) { console.error('spotlight override failed', e); }
        };

        // --- Init scheduler stored tasks ---
        try {
            const stored = Kernel.Registry.get('HKCU\\Scheduler', null);
            if (Array.isArray(stored)) {
                System.scheduler.tasks = stored;
                System.scheduler.init();
            } else if (stored && typeof stored === 'object' && Array.isArray(stored.tasks)) {
                System.scheduler.tasks = stored.tasks;
                System.scheduler.init();
            }
        } catch(e){ console.error('Failed to load scheduler from registry', e); }

        // --- New apps: Calendar, Notes Sync, Mini IDE ---
        Apps.calendar = Apps.calendar || { title: 'Calendar', icon: 'assets/calendar.svg' };
        Apps.calendar.launch = function() {
            const evts = Kernel.Registry.get('HKCU\\Calendar\\Events', {}) || {};
            let now = new Date();
            let viewYear = now.getFullYear();
            let viewMonth = now.getMonth();

            function renderMonth() {
                const first = new Date(viewYear, viewMonth, 1);
                const last = new Date(viewYear, viewMonth+1, 0);
                const startDay = first.getDay();
                const days = last.getDate();
                let html = `<div style="padding:12px;color:white"><div style='display:flex;justify-content:space-between;align-items:center'><button id='cal-prev'>◀</button><h3>${first.toLocaleString(undefined,{month:'long'})} ${viewYear}</h3><button id='cal-next'>▶</button></div><div style='display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:10px'>`;
                const weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                weekdayNames.forEach(d => { html += `<div style='text-align:center;opacity:0.7'>${d}</div>`; });
                for (let i=0;i<startDay;i++) html += `<div></div>`;
                for (let d=1; d<=days; d++) {
                    const key = `${viewYear}-${(viewMonth+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
                    const has = evts[key] && evts[key].length>0;
                    html += `<div style='padding:6px;border-radius:6px;min-height:48px;background:${has?"rgba(255,204,0,0.08)":"transparent"};cursor:pointer' data-day='${d}'>${d}${has?'<div style="font-size:0.7em;opacity:0.8">'+(evts[key]||[]).slice(0,1).map(x=>x.title).join(',')+'</div>':''}</div>`;
                }
                html += `</div></div>`;
                win.querySelector('.window-content').innerHTML = html;
                win.querySelector('#cal-prev').onclick = () => { viewMonth--; if (viewMonth<0){ viewMonth=11; viewYear--; } renderMonth(); };
                win.querySelector('#cal-next').onclick = () => { viewMonth++; if (viewMonth>11){ viewMonth=0; viewYear++; } renderMonth(); };
                win.querySelectorAll('[data-day]').forEach(el => {
                    el.onclick = () => {
                        const day = el.getAttribute('data-day');
                        const key = `${viewYear}-${(viewMonth+1).toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
                        const list = evts[key] || [];
                        const note = prompt('Add event for '+key+' (title)');
                        if (note) {
                            evts[key] = evts[key] || [];
                            evts[key].push({ title: note, created: Date.now() });
                            Kernel.Registry.set('HKCU\\Calendar\\Events', evts);
                            renderMonth();
                            System.notify('Event saved', 'success');
                        }
                    };
                });
            }

            const win = wm.createWindow('Calendar', '<div style="padding:12px;color:white">Loading...</div>', 520, 420, 'calendar');
            renderMonth();
        };

        Apps.notesync = Apps.notesync || { title: 'Notes Sync', icon: 'assets/notesync.svg' };
        Apps.notesync.launch = function() {
            (async () => {
                try {
                    // ensure notes dir
                    if (!Kernel.getDirObj('/home/user/notes')) await Kernel.makeDir('/home/user/notes');
                } catch(e){}
                const listDir = () => {
                    const dir = Kernel.getDirObj('/home/user/notes') || {};
                    return Object.keys(dir).filter(k => typeof dir[k] !== 'object');
                };
                const winId = 'notes-'+Date.now();
                const win = wm.createWindow('Notes Sync', `
                    <div style='display:flex;flex-direction:column;height:100%'>
                        <div style='display:flex;gap:8px;padding:8px;border-bottom:1px solid #333'>
                            <input id='${winId}-title' placeholder='New note name' style='flex:1;background:transparent;border:1px solid #333;padding:6px;border-radius:6px'>
                            <button id='${winId}-new'>New</button>
                        </div>
                        <div style='display:flex;flex:1;overflow:hidden'>
                            <div id='${winId}-list' style='width:200px;overflow:auto;padding:8px;border-right:1px solid #333'></div>
                            <div style='flex:1;display:flex;flex-direction:column'>
                                <textarea id='${winId}-editor' style='flex:1;background:transparent;border:none;color:white;padding:10px;outline:none;resize:none'></textarea>
                                <div style='padding:8px;border-top:1px solid #333;display:flex;gap:8px;justify-content:flex-end'>
                                    <button id='${winId}-save'>Save</button>
                                    <button id='${winId}-delete'>Delete</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `, 700, 480, 'notesync');

                const renderList = () => {
                    const list = listDir();
                    const container = win.querySelector('#'+winId+'-list');
                    container.innerHTML = '';
                    list.forEach(name => {
                        const el = document.createElement('div');
                        el.textContent = name;
                        el.style.padding = '6px'; el.style.cursor='pointer'; el.onclick = async () => {
                            const content = Kernel.getFile('/home/user/notes/'+name) || '';
                            win.querySelector('#'+winId+'-editor').value = content;
                            win.querySelector('#'+winId+'-title').value = name;
                        };
                        container.appendChild(el);
                    });
                };

                win.querySelector('#'+winId+'-new').onclick = () => {
                    const name = win.querySelector('#'+winId+'-title').value || `note-${Date.now()}.txt`;
                    win.querySelector('#'+winId+'-editor').value = '';
                    win.querySelector('#'+winId+'-title').value = name;
                };
                win.querySelector('#'+winId+'-save').onclick = async () => {
                    const name = win.querySelector('#'+winId+'-title').value || `note-${Date.now()}.txt`;
                    const content = win.querySelector('#'+winId+'-editor').value || '';
                    await Kernel.saveFile('/home/user/notes/'+name, content);
                    renderList();
                    System.notify('Note saved', 'success');
                };
                win.querySelector('#'+winId+'-delete').onclick = async () => {
                    const name = win.querySelector('#'+winId+'-title').value;
                    if (!name) return;
                    if (confirm('Delete '+name+'?')) { await Kernel.deleteFile('/home/user/notes/'+name); win.querySelector('#'+winId+'-editor').value=''; win.querySelector('#'+winId+'-title').value=''; renderList(); System.notify('Deleted', 'info'); }
                };

                renderList();
            })();
        };

        Apps.ide = Apps.ide || { title: 'Mini IDE', icon: 'assets/ide.svg' };
        Apps.ide.launch = function() {
            (async ()=>{
                try { if (!Kernel.getDirObj('/home/user/ide')) await Kernel.makeDir('/home/user/ide'); } catch(e){}
                const winId = 'ide-'+Date.now();
                const win = wm.createWindow('Mini IDE', `
                    <div style='display:flex;flex-direction:column;height:100%'>
                        <div style='display:flex;gap:8px;padding:8px;border-bottom:1px solid #333'>
                            <input id='${winId}-name' placeholder='script.js' style='background:transparent;border:1px solid #333;padding:6px;border-radius:6px'>
                            <button id='${winId}-run'>Run</button>
                            <button id='${winId}-save'>Save</button>
                        </div>
                        <textarea id='${winId}-code' style='flex:1;background:transparent;border:none;color:white;padding:10px;outline:none;resize:none'>// JavaScript code here\nconsole.log('Hello from Mini IDE');</textarea>
                        <div id='${winId}-output' style='height:120px;overflow:auto;border-top:1px solid #333;padding:8px;background:#080808;color:#0f0;font-family:monospace'></div>
                    </div>
                `, 800, 560, 'ide');

                const run = () => {
                    const code = win.querySelector('#'+winId+'-code').value || '';
                    const out = win.querySelector('#'+winId+'-output');
                    out.innerHTML = '';
                    try {
                        // capture console.log
                        const origLog = console.log;
                        console.log = function(...args) { out.innerHTML += args.map(a=>String(a)).join(' ')+'<br/>'; origLog.apply(console,args); };
                        new Function(code)();
                        console.log = origLog;
                    } catch(e) { out.innerHTML += 'Error: '+e.message; }
                };

                win.querySelector('#'+winId+'-run').onclick = run;
                win.querySelector('#'+winId+'-save').onclick = async () => {
                    const name = win.querySelector('#'+winId+'-name').value || 'script-'+Date.now()+'.js';
                    const content = win.querySelector('#'+winId+'-code').value || '';
                    await Kernel.saveFile('/home/user/ide/'+name, content);
                    System.notify('Saved script', 'success');
                };

                // quick load list
                const files = Kernel.getDirObj('/home/user/ide') || {};
                const names = Object.keys(files).filter(k=>typeof files[k] !== 'object');
                if (names.length>0) win.querySelector('#'+winId+'-name').value = names[0];
            })();
        };

        // Robustly add start-menu items and desktop icons (retry until DOM ready).
        (function addNewAppsToUI(){
            const apps = ['calendar','notesync','ide'];
            let attempts = 0;
            const maxAttempts = 50;
            const doAdd = () => {
                attempts++;
                const startItems = document.getElementById('start-menu-items');
                const desktopIcons = document.getElementById('desktop-icons');
                let done = true;

                if (startItems) {
                    try {
                        apps.forEach(key => {
                            // avoid duplicate menu entries
                            if ([...startItems.children].some(c => c.getAttribute && c.getAttribute('data-app') === key)) return;
                            const item = document.createElement('div');
                            item.className = 'start-menu-item';
                            item.setAttribute('data-app', key);
                            item.setAttribute('tabindex','0');
                            item.setAttribute('role','button');
                            item.style.display='flex'; item.style.alignItems='center';
                            const icon = document.createElement('img'); icon.src = Apps[key].icon; icon.style.width='24px'; icon.style.height='24px'; icon.style.marginRight='12px'; icon.style.borderRadius='4px';
                            item.appendChild(icon);
                            item.appendChild(document.createTextNode(Apps[key].title));
                            item.onclick = () => { try{ Apps[key].launch(); }catch(e){console.error(e);} const sm = document.getElementById('start-menu'); if(sm) sm.classList.add('hidden'); };
                            item.onkeydown = (e) => { if(e.key==='Enter' || e.key===' '){ e.preventDefault(); item.click(); } };
                            startItems.appendChild(item);
                        });
                    } catch(e){ console.error('Failed to add start menu items', e); }
                } else done = false;

                if (desktopIcons) {
                    try {
                        apps.forEach(k=>{
                            if (!document.querySelector(`#desktop-icons [data-app='${k}']`)) {
                                System.addDesktopIcon(k);
                            }
                        });
                    } catch(e){ console.error('Failed adding desktop icons', e); }
                } else done = false;

                // Wrap refreshDesktopIcons to preserve our icons across refreshes
                if (typeof System.refreshDesktopIcons === 'function' && !System._features_icons_wrapped) {
                    const orig = System.refreshDesktopIcons;
                    System.refreshDesktopIcons = function(){ try{ orig(); }catch(e){console.error(e);} setTimeout(()=>{ apps.forEach(k=>{ if (!document.querySelector(`#desktop-icons [data-app='${k}']`)) try{ System.addDesktopIcon(k); }catch(e){} }); }, 80); };
                    System._features_icons_wrapped = true;
                }

                if (!done && attempts < maxAttempts) setTimeout(doAdd, 100);
            };
            doAdd();
        })();

        // Final small UX helpers
        System.openAppStore = Apps.appstore.launch;
        System.openDevTools = Apps.devtools.launch;
        System.openCollaboration = Apps.collaboration.launch;

        console.log('features.js loaded: Extended features and 3 new apps available');
    });
})();
