const socket = io();

let currentUsername = "";
let currentServerId = "";
let currentChannelName = "";
let currentChannelId = ""; // Combined format: serverId-channelName
let currentServerOwner = "";
let authMode = "login";

window.onload = function() {
    const savedUser = localStorage.getItem("noxkel_user");
    if (savedUser) {
        currentUsername = savedUser;
        initHubDeck(false); 
    } else {
        // CORRECTION GATEWAY: Forces login portal to display if no local token is stored
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }

    // Bind Enter key to chat transmitter input
    document.getElementById('chat-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { transmitMessage(); }
    });
};

// 1. OVERLAY UI CONTROL MOTOR FUNCTIONS
function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }

function toggleCodeFieldDisplay() {
    const type = document.getElementById('new-server-privacy-input').value;
    const wrapper = document.getElementById('private-code-field-wrapper');
    wrapper.style.display = (type === 'private') ? 'block' : 'none';
}

// 2. IDENTITY ENTRY GATEWAYS
function toggleAuthMode() {
    const title = document.getElementById('auth-title');
    const submitBtn = document.querySelector('#auth-container button');
    const toggleBtn = document.getElementById('toggle-auth');

    if (authMode === "login") {
        authMode = "signup";
        title.innerText = "NOXKEL SIGNUP";
        submitBtn.innerText = "Create Account";
        toggleBtn.innerText = "Have an account? Log In";
    } else {
        authMode = "login";
        title.innerText = "NOXKEL HUB";
        submitBtn.innerText = "Connect";
        toggleBtn.innerText = "Need an account? Sign Up";
    }
}

async function handleAuth() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if(!u || !p) return alert("Fill in missing string fields.");

    const res = await fetch('/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: authMode, username: u, password: p })
    });
    const data = await res.json();
    
    if (data.success) {
        currentUsername = u;
        localStorage.setItem("noxkel_user", u);
        initHubDeck(data.isNewUser); 
    } else { alert(data.message || "Credential mapping error."); }
}

async function initHubDeck(isNewUser) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    document.getElementById('my-display-username').innerText = `@${currentUsername}`;
    
    const res = await fetch(`/api/user/pfp/${currentUsername}`);
    const d = await res.json();
    document.getElementById('my-footer-avatar-img').src = d.pfp;

    if (isNewUser) {
        openModal('modal-global-invite');
    } else {
        loadServersRail();
    }
}

async function acceptGlobalInvite() {
    closeModal('modal-global-invite');
    await fetch('/api/servers/join-global', { method: 'POST' });
    loadServersRail();
}

// 3. SERVER OPERATIONS
async function loadServersRail() {
    const res = await fetch('/api/servers/my');
    const servers = await res.json();
    const rail = document.getElementById('dynamic-servers-rail');
    rail.innerHTML = "";

    servers.forEach(s => {
        const btn = document.createElement('div');
        btn.className = `srv-node ${currentServerId === s._id ? 'active' : ''}`;
        btn.innerText = s.name.substring(0,2).toUpperCase();
        btn.title = s.name;
        btn.onclick = () => selectServerWorkspace(s, s.channels);
        rail.appendChild(btn);
    });

    if (servers.length > 0 && !currentServerId) {
        selectServerWorkspace(servers[0], servers[0].channels);
    }
}

async function confirmCreateServer() {
    const name = document.getElementById('new-server-name-input').value.trim();
    const privacy = document.getElementById('new-server-privacy-input').value;
    const code = document.getElementById('new-server-code-input').value.trim();

    if(!name) return alert("Name field is mandatory.");
    if(privacy === 'private' && !code) return alert("Private protocols require a key code.");

    const res = await fetch('/api/servers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, isPrivate: (privacy === 'private'), accessCode: code })
    });
    
    if(res.ok) {
        closeModal('modal-create-server');
        document.getElementById('new-server-name-input').value = "";
        document.getElementById('new-server-code-input').value = "";
        loadServersRail();
    }
}

async function confirmJoinByCode() {
    const code = document.getElementById('join-code-input').value.trim();
    if(!code) return alert("Please supply an access code.");

    const res = await fetch('/api/servers/join-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
    });
    const data = await res.json();
    
    if(data.success) {
        closeModal('modal-join-code');
        document.getElementById('join-code-input').value = "";
        currentServerId = data.server._id;
        loadServersRail();
    } else { alert(data.message); }
}

function selectServerWorkspace(serverObj, channels) {
    currentServerId = serverObj._id;
    currentServerOwner = serverObj.owner;
    document.getElementById('active-server-title').innerText = serverObj.name;
    
    const isAdmin = (currentServerOwner === currentUsername);
    document.getElementById('add-room-sidebar-btn').style.display = isAdmin ? "inline" : "none";
    document.getElementById('rules-mod-btn').style.display = isAdmin ? "block" : "none";

    document.querySelectorAll('.srv-node').forEach(n => {
        if(n.title === serverObj.name) n.classList.add('active');
        else n.classList.remove('active');
    });

    const list = document.getElementById('active-channels-list');
    list.innerHTML = "";

    channels.forEach((ch, idx) => {
        const item = document.createElement('div');
        item.className = `ch-item ${idx === 0 ? 'active' : ''}`;
        item.innerText = `# ${ch.name}`;
        
        if (ch.isReadOnly) {
            const badge = document.createElement('span');
            badge.className = "badge-readonly";
            badge.innerText = "NOTICE";
            item.appendChild(badge);
        }

        item.onclick = () => {
            document.querySelectorAll('.ch-item').forEach(c => c.classList.remove('active'));
            item.classList.add('active');
            targetChannelStream(ch);
        };
        list.appendChild(item);
    });

    if (channels.length > 0) targetChannelStream(channels[0]);
}

// 4. CHANNELS & CHANNEL LOGIC
async function confirmAddRoomChannel() {
    const roomName = document.getElementById('new-room-name-input').value.trim();
    const type = document.getElementById('new-room-type-input').value;

    if(!roomName) return alert("Room identification label required.");

    const res = await fetch('/api/channels/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            serverId: currentServerId,
            roomName,
            isReadOnly: (type === 'readonly')
        })
    });
    
    if(res.ok) {
        closeModal('modal-add-room');
        document.getElementById('new-room-name-input').value = "";
        const refreshRes = await fetch('/api/servers/my');
        const workspaces = await refreshRes.json();
        const activeSrv = workspaces.find(w => w._id === currentServerId);
        selectServerWorkspace(activeSrv, activeSrv.channels);
    }
}

async function targetChannelStream(channelObj) {
    currentChannelName = channelObj.name;
    currentChannelId = `${currentServerId}-${channelObj.name}`;
    document.getElementById('active-channel-title').innerText = `# ${channelObj.name}`;
    
    const inputField = document.getElementById('chat-input');
    if (channelObj.isReadOnly && currentServerOwner !== currentUsername) {
        inputField.disabled = true;
        inputField.placeholder = "[READ ONLY — NOTICES CHANNEL]";
    } else {
        inputField.disabled = false;
        inputField.placeholder = "Broadcast string packet...";
    }

    socket.emit('join_channel', currentChannelId);

    const res = await fetch(`/api/messages/${currentChannelId}`);
    const history = await res.json();
    
    const scroller = document.getElementById('chat-scroller');
    scroller.innerHTML = "";

    for (const msg of history) {
        const pfpRes = await fetch(`/api/user/pfp/${msg.username}`);
        const pfpData = await pfpRes.json();
        renderMessageRow(msg, pfpData.pfp);
    }
}

// 5. CHAT MESSAGING SYSTEMS
async function transmitMessage() {
    const input = document.getElementById('chat-input');
    const val = input.value.trim();
    if(!val) return;

    socket.emit('send_chat_message', {
        serverId: currentServerId,
        channelId: currentChannelId,
        channelName: currentChannelName,
        username: currentUsername,
        text: val
    });
    input.value = "";
}

function renderMessageRow(msg, avatarUrl) {
    const scroller = document.getElementById('chat-scroller');
    const row = document.createElement('div');
    row.className = "msg-line";
    
    row.innerHTML = `
        <img src="${avatarUrl}" class="msg-avatar">
        <div class="msg-info">
            <span class="msg-user">@${msg.username}</span>
            <span class="msg-text">${msg.text}</span>
        </div>
    `;
    scroller.appendChild(row);
    scroller.scrollTop = scroller.scrollHeight;
}

// 6. UTILITY MANAGEMENT MODALS (AUTOMOD/PFP)
function openAutoModConfigModal() { openModal('modal-automod'); }

async function confirmAutoModRules() {
    const words = document.getElementById('automod-words-input').value.trim();
    
    const res = await fetch('/api/servers/automod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: currentServerId, words })
    });
    const d = await res.json();
    if(d.success) {
        closeModal('modal-automod');
        alert("AutoMod parameters injected successfully.");
    }
}

async function confirmPfpUpdate() {
    const url = document.getElementById('user-pfp-url-input').value.trim();
    if(!url) return;

    const res = await fetch('/api/profile/pfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pfp: url })
    });
    if(res.ok) {
        closeModal('modal-user-pfp');
        document.getElementById('my-footer-avatar-img').src = url;
        alert("Avatar asset synchronized.");
    }
}

// 7. LISTENING MATRIX INTERCEPTORS
socket.on('receive_chat_message', (msg) => {
    if (msg.channelId === currentChannelId) {
        renderMessageRow(msg, msg.pfp || "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel");
    }
});

socket.on('mod_action', (action) => {
    alert(action.text);
    
    if(action.type === 'temp_mute') {
        const inputField = document.getElementById('chat-input');
        inputField.disabled = true;
        let timeRemaining = action.minutes * 60;

        const countdown = setInterval(() => {
            timeRemaining--;
            let mins = Math.floor(timeRemaining / 60);
            let secs = timeRemaining % 60;
            inputField.placeholder = `[MUTED — VIOLATION DETECTED: ${mins}m ${secs}s]`;

            if (timeRemaining <= 0) {
                clearInterval(countdown);
                inputField.disabled = false;
                inputField.placeholder = "Broadcast string packet...";
            }
        }, 1000);
    }

    if(action.type === 'perma_mute') {
        document.getElementById('chat-input').disabled = true;
        document.getElementById('chat-input').placeholder = "[LOCKED - PERMANENT BAN/MUTE ACTIVE]";
    }
});
