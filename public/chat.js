let socket = io();
let currentUsername = "";
let currentServerId = "";
let currentChannelName = "";
let currentChannelId = "";
let currentServerOwner = "";
let isSignUpMode = false;

// Track active targeted profiles for modal manipulation
let activeInspectedUser = "";
let messageUnderRevisionId = "";

// ==========================================
// 1. CORE AUTHENTICATION MATRIX HANDLERS
// ==========================================
function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById('auth-title').innerText = isSignUpMode ? "MATRIX REGISTRATION" : "NOXKEL HUB";
    document.getElementById('toggle-auth').innerText = isSignUpMode ? "Already verified? Connect" : "Need an account? Sign Up";
}

async function handleAuth() {
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value;
    if(!usernameInput || !passwordInput) return alert("Credentials required.");

    const res = await fetch('/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: isSignUpMode ? 'signup' : 'login', username: usernameInput, password: passwordInput })
    });
    const data = await res.json();
    if(data.success) {
        currentUsername = usernameInput;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('my-display-username').innerText = `@${currentUsername}`;
        
        // Sync default profile picture asset lookups
        const pfpRes = await fetch(`/api/user/pfp/${currentUsername}`);
        const pfpData = await pfpRes.json();
        document.getElementById('my-footer-avatar-img').src = pfpData.pfp;

        if(data.isNewUser) {
            openModal('modal-global-invite');
        } else {
            loadServersRail();
        }
    } else {
        alert(data.message);
    }
}

async function executeSystemTermLogout() {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if(res.ok) {
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }
}

// ==========================================
// 2. MODAL CORE ENGINE FUNCTIONS
// ==========================================
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function toggleCodeFieldDisplay() {
    const privacy = document.getElementById('new-server-privacy-input').value;
    document.getElementById('private-code-field-wrapper').style.display = (privacy === 'private') ? 'block' : 'none';
}

// ==========================================
// 3. WORKSPACE SECTOR PANELS SWITCHING MOTOR
// ==========================================
function switchWorkspaceView(panelId) {
    document.querySelectorAll('.workspace-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sys-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(panelId).classList.add('active');
    
    if(panelId === 'panel-chat-deck') document.getElementById('nav-chat-btn').classList.add('active');
    if(panelId === 'panel-discover-deck') document.getElementById('nav-discover-btn').classList.add('active');
    if(panelId === 'panel-social-deck') document.getElementById('nav-social-btn').classList.add('active');
    if(panelId === 'panel-settings-deck') document.getElementById('nav-settings-btn').classList.add('active');
}

// ==========================================
// 4. CHAT SERVERS RAIL GENERATION ENGINE
// ==========================================
async function acceptGlobalInvite() {
    const res = await fetch('/api/servers/join-global', { method: 'POST' });
    if(res.ok) {
        closeModal('modal-global-invite');
        loadServersRail();
    }
}

async function loadServersRail() {
    const res = await fetch('/api/servers/my');
    const servers = await res.json();
    const rail = document.getElementById('dynamic-servers-rail');
    rail.innerHTML = "";
    
    servers.forEach(srv => {
        const node = document.createElement('div');
        node.className = "srv-node";
        node.innerText = srv.name.substring(0,2).toUpperCase();
        node.title = srv.name;
        node.onclick = () => activateServerWorkspace(srv);
        rail.appendChild(node);
    });
}

async function confirmCreateServer() {
    const name = document.getElementById('new-server-name-input').value.trim();
    const privacy = document.getElementById('new-server-privacy-input').value;
    const code = document.getElementById('new-server-code-input').value.trim();
    if(!name) return;

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
    if(!code) return;
    // Private connection logic checks
    alert("Synthesizing entry string...");
    closeModal('modal-join-code');
}

// ==========================================
// 5. WORKSPACE CONTEXT SWITCHING (CHANNELS)
// ==========================================
async function confirmAddRoomChannel() {
    const name = document.getElementById('new-room-name-input').value.trim().toLowerCase();
    const type = document.getElementById('new-room-type-input').value; // 'text' or 'voice' / 'read-only' depending on your HTML select dropdown
    if(!name) return alert("CRITICAL ERROR: Room name identifier cannot be blank.");

    try {
        const res = await fetch('/api/channels/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverId: currentServerId,
                channelName: name,
                isReadOnly: (type === 'readonly') // If your select option value for read-only is 'readonly'
            })
        });

        if(res.ok) {
            alert(`SYSTEM: Custom room sector #${name} successfully injected into database.`);
            closeModal('modal-add-room');
            document.getElementById('new-room-name-input').value = ""; // Clear input field
            
            // Hot reload the server workspace instantly so the new channel appears on your sidebar
            const refreshRes = await fetch('/api/servers/my');
            const servers = await refreshRes.json();
            const currentServerData = servers.find(s => s._id === currentServerId);
            if(currentServerData) {
                renderChannelsList(currentServerData.channels);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            alert(`ERROR: Mainframe rejected room injection. ${errData.message || ''}`);
        }
    } catch (err) {
        console.error("Room creation sequence failure:", err);
        alert("ERROR: Failed to establish channel creation handshake stream.");
    }
}
// ==========================================
// 6. MESSAGING STREAM ENGINE (TRANSMISSIONS)
// ==========================================
async function transmitMessage() {
    const input = document.getElementById('chat-input');
    const val = input.value.trim();
    if(!val) return;

    // INTERCEPT PROTOCOL: MANUAL SLASH COMMAND BAR SCANNING
    if(val.startsWith('/')) {
        handleSlashCommands(val);
        input.value = "";
        return;
    }

    socket.emit('send_chat_message', {
        serverId: currentServerId,
        channelId: currentChannelId,
        channelName: currentChannelName,
        username: currentUsername,
        text: val,
        imageUrl: ""
    });
    input.value = "";
}

function handleSlashCommands(str) {
    const parts = str.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ').trim();

    if(command === '/commands') {
        openModal('modal-admin-terminal-dashboard');
        return;
    }
    if(command === '/clear') {
        document.getElementById('chat-scroller').innerHTML = "";
        return;
    }

    // FEATURE 1: DATE MATRIX ROLLBACK INTERCEPTOR
    if(command === '/rollbackdaterequest') {
        const target = args.replace('@', '').trim();
        if(!target) return alert("CRITICAL ERROR: Specify a target user handle to execute rollback.");

        fetch('/api/social/cancel-date', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername, targetUser: target })
        })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                alert(`SYSTEM: Transmission aborted. Date request sent to @${target} has been purged.`);
            } else {
                alert("ERROR: Mainframe failed to purge packet.");
            }
        })
        .catch(err => console.error("Rollback failed:", err));
        return;
    }

    // FEATURE 2: ROOM OBLITERATION VIA SLASH COMMAND
    if(command === '/deleteroom') {
        const targetRoom = args.replace('#', '').trim();
        if(!targetRoom) return alert("CRITICAL ERROR: Specify a custom channel name to delete.");
        if(currentServerOwner !== currentUsername) return alert("ACCESS DENIED: Only the Server Owner can execute channel terminations.");

        if(!confirm(`Execute terminal destruction command on channel #${targetRoom}?`)) return;

        fetch(`/api/channels/${currentServerId}/${targetRoom}`, { method: 'DELETE' })
        .then(res => {
            if(res.ok) {
                alert(`SYSTEM: Channel #${targetRoom} data signature wiped from node.`);
                location.reload();
            } else {
                alert("ERROR: Destruction route rejected by backend database.");
            }
        })
        .catch(err => console.error("Room destruction failure:", err));
        return;
    }

    // Pass structural commands to backend handler tree
    if(['/kick', '/giveadmin', '/abadaba', '/undoabadaba'].includes(command)) {
        socket.emit('execute_admin_override', {
            serverId: currentServerId,
            channelId: currentChannelId,
            command,
            targetUser: args.replace('@', ''),
            caller: currentUsername
        });
    }
}

function dispatchManualAdminCommand(commandType) {
    const target = document.getElementById('admin-manual-target-user').value.trim();
    if(!target && ['/kick', '/giveadmin'].includes(commandType)) return alert("Target handle required.");
    
    handleSlashCommands(`${commandType} ${target}`);
    closeModal('modal-admin-terminal-dashboard');
    document.getElementById('admin-manual-target-user').value = "";
}

function confirmPhotoPacketTransmission() {
    const url = document.getElementById('photo-packet-url-input').value.trim();
    if(!url) return;

    socket.emit('send_chat_message', {
        serverId: currentServerId,
        channelId: currentChannelId,
        channelName: currentChannelName,
        username: currentUsername,
        text: "Sent an attachment map.",
        imageUrl: url
    });
    closeModal('modal-send-photo');
    document.getElementById('photo-packet-url-input').value = "";
}

// RENDERING PIPELINES WITH ATTACHMENT AND MESSAGE REVISION HUBS
function renderMessageRow(msg) {
    const scroller = document.getElementById('chat-scroller');
    const row = document.createElement('div');
    row.className = "msg-line";
    row.id = `msg-block-${msg._id}`;
    
    const safeSrc = msg.pfp || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.username}`;
    let imageTag = msg.imageUrl ? `<img src="${msg.imageUrl}" class="msg-img-attachment" onerror="this.style.display='none';">` : "";
    let editBadge = msg.isEdited ? `<span style="font-size:0.6rem; color:#444; margin-left:5px;">(edited)</span>` : "";

    // Insert actions triggers for self messages (Edit / Delete / Forward)
    let actionMenu = "";
    if(msg.username === currentUsername) {
        actionMenu = `
            <div class="msg-actions-trigger">
                <button class="msg-action-btn" onclick="triggerEditPacketPrompt('${msg._id}', '${msg.text}')">EDIT</button>
                <button class="msg-action-btn" onclick="triggerDeletePacket('${msg._id}')">DEL</button>
                <button class="msg-action-btn" onclick="triggerForwardPacket('${msg.text}')">FWD</button>
            </div>
        `;
    } else {
        actionMenu = `
            <div class="msg-actions-trigger">
                <button class="msg-action-btn" onclick="triggerForwardPacket('${msg.text}')">FWD</button>
            </div>
        `;
    }

    row.innerHTML = `
        <img src="${safeSrc}" class="msg-avatar" onclick="inspectUserProfile('${msg.username}')">
        <div class="msg-info">
            <span class="msg-user" onclick="inspectUserProfile('${msg.username}')">@${msg.username}</span>
            <span class="msg-text" id="text-render-${msg._id}">${msg.text} ${editBadge}</span>
            ${imageTag}
        </div>
        ${actionMenu}
    `;
    scroller.appendChild(row);
    scroller.scrollTop = scroller.scrollHeight;
}

// EDIT, DELETE, AND FORWARD REVISIONS CORE FUNCTIONS
function triggerEditPacketPrompt(id, rawText) {
    messageUnderRevisionId = id;
    document.getElementById('edit-message-text-input').value = rawText;
    openModal('modal-edit-message');
    
    document.getElementById('confirm-edit-msg-btn').onclick = async function() {
        const nText = document.getElementById('edit-message-text-input').value.trim();
        const res = await fetch('/api/messages/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: messageUnderRevisionId, newText: nText })
        });
        if(res.ok) {
            closeModal('modal-edit-message');
            selectChannelNode(currentChannelName); // Instant hot reload
        }
    };
}

async function triggerDeletePacket(id) {
    if(!confirm("Erase this text packet from stream database?")) return;
    const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
    if(res.ok) document.getElementById(`msg-block-${id}`).remove();
}

function triggerForwardPacket(text) {
    const targetDest = prompt("Enter target room location identifier channel name (e.g., lounge):");
    if(!targetDest) return;
    socket.emit('send_chat_message', {
        serverId: currentServerId, channelId: `${currentServerId}-${targetDest}`,
        channelName: targetDest, username: currentUsername, text: `[Forwarded]: ${text}`, imageUrl: ""
    });
    alert("Message packet forwarded.");
}

// ==========================================
// 7. PROFILE RENDERING & SOCIAL SYSTEMS MATRIX
// ==========================================
async function inspectUserProfile(targetName) {
    activeInspectedUser = targetName;
    const res = await fetch(`/api/user/profile/${targetName}`);
    const data = await res.json();
    
    document.getElementById('prof-modal-username').innerText = `@${data.username}`;
    document.getElementById('prof-modal-pfp').src = data.pfp;
    document.getElementById('prof-modal-pronouns').innerText = `Pronouns: ${data.pronouns}`;
    document.getElementById('prof-modal-age').innerText = `Age: ${data.age || "Not tracked"}`;
    document.getElementById('prof-modal-bio').innerText = data.bio;
    
    const actionBar = document.getElementById('prof-modal-interaction-bar');
    actionBar.innerHTML = "";
    
    if(targetName !== currentUsername) {
        actionBar.innerHTML = `
            <button onclick="dispatchSocialRequest('friend')">you r my friend now?</button>
            <button onclick="dispatchSocialRequest('date')" style="border-color:#ff0055; color:#ff0055;">DATE?</button>
        `;
    }
    openModal('modal-view-profile');
}

async function dispatchSocialRequest(type) {
    closeModal('modal-view-profile');
    if(type === 'friend') {
        const res = await fetch('/api/social/friend-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUser: activeInspectedUser })
        });
        if(res.ok) alert("Friend synchronization query sent.");
    }
    if(type === 'date') {
        await fetch('/api/social/date-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUser: activeInspectedUser })
        });
        alert(`Dating connection request transmitted to @${activeInspectedUser}. Waiting for signature...`);
    }
}

// ==========================================
// 8. DISCOVER PAGE GRID INTERFACE LOGIC
// ==========================================
async function loadDiscoverMainframe() {
    switchWorkspaceView('panel-discover-deck');
    const res = await fetch('/api/discover/servers');
    const openServers = await res.json();
    const grid = document.getElementById('discover-servers-grid');
    grid.innerHTML = "";

    openServers.forEach(srv => {
        const card = document.createElement('div');
        card.className = "matrix-card";
        card.innerHTML = `
            <div>
                <h4>${srv.name}</h4>
                <p>Host Controller: @${srv.owner}</p>
            </div>
            <button class="sys-btn" style="text-align:center;" id="disc-join-${srv._id}">Establish Connection Sync</button>
        `;
        grid.appendChild(card);
        
        card.querySelector(`#disc-join-${srv._id}`).onclick = () => {
            activateServerWorkspace(srv);
        };
    });
}

// ==========================================
// 9. FRIEND MATRIX TRACK SECTOR LOADERS
// ==========================================
async function loadSocialMainframe() {
    switchWorkspaceView('panel-social-deck');
    
    const reqBox = document.getElementById('social-requests-box');
    const friendBox = document.getElementById('social-friends-box');
    
    reqBox.innerHTML = "<p style='font-size:0.75rem; color:#444;'>Scanning request logs...</p>";
    friendBox.innerHTML = "<p style='font-size:0.75rem; color:#444;'>Scanning active pipelines...</p>";

    try {
        // Fetch the user's live profile data containing friends and pending requests arrays
        const res = await fetch(`/api/user/profile/${currentUsername}`);
        const data = await res.json();

        // 1. RENDER PENDING INCOMING FRIEND REQUESTS
        reqBox.innerHTML = "";
        // Checks if backend sends a pending requests array (adjust key name if your backend uses 'incomingRequests' or 'requests')
        const pendingRequests = data.pendingRequests || []; 
        
        if (pendingRequests.length === 0) {
            reqBox.innerHTML = "<p style='font-size:0.75rem; color:#666;'>No pending synchronization queries.</p>";
        } else {
            pendingRequests.forEach(sender => {
                const row = document.createElement('div');
                row.className = "matrix-card";
                row.style.display = "flex";
                row.style.justifyContent = "space-between";
                row.style.alignItems = "center";
                row.style.margin = "5px 0";
                row.style.padding = "8px";
                row.style.background = "#111";
                row.style.border = "1px solid #333";

                row.innerHTML = `
                    <span style="font-size:0.85rem; color:#fff;">Incoming: @${sender}</span>
                    <button class="sys-btn" style="padding:2px 8px; font-size:0.75rem;" onclick="acceptFriendPipeline('${sender}')">ACCEPT</button>
                `;
                reqBox.appendChild(row);
            });
        }

        // 2. RENDER ACTIVE FRIENDS LIST
        friendBox.innerHTML = "";
        const friendsList = data.friends || [];
        
        if (friendsList.length === 0) {
            friendBox.innerHTML = "<p style='font-size:0.75rem; color:#666;'>No direct active pipelines established.</p>";
        } else {
            friendsList.forEach(friend => {
                const div = document.createElement('div');
                div.style.padding = "5px 0";
                div.style.color = "#00ff55"; // Clean hacker green for verified friends
                div.style.fontIndex = "0.85rem";
                div.innerText = `• @${friend} [SECURE CONNECTION]`;
                friendBox.appendChild(div);
            });
        }

    } catch (err) {
        console.error("Failed to load social mainframe matrices:", err);
        reqBox.innerHTML = "<p style='font-size:0.75rem; color:#ff0055;'>CRITICAL TRACK READ ERROR</p>";
    }
}

// NEW HANDLER: FIRES THE ACCEPT ANCHOR TO THE BACKEND
async function acceptFriendPipeline(senderUsername) {
    const res = await fetch('/api/social/accept-friend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUser: senderUsername })
    });
    
    if (res.ok) {
        alert(`SYSTEM: Friendship synchronization signed with @${senderUsername}!`);
        loadSocialMainframe(); // Refresh boxes instantly
    } else {
        alert("ERROR: Failed to establish secure friend bridge.");
    }
}
// ==========================================
// 10. ACCOUNT PROFILE PARAMETERS STORAGE MOTOR
// ==========================================
async function commitHardwareSettingsChanges() {
    const pronouns = document.getElementById('setting-pronouns-input').value;
    const ageInputVal = document.getElementById('setting-age-input').value;
    const bio = document.getElementById('setting-bio-input').value;

    // FIXED: Form parses raw string to valid Int data structures before JSON translation
    const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            pronouns, 
            age: ageInputVal ? parseInt(ageInputVal) : null, 
            bio
        })
    });
    if(res.ok) alert("Hardware configuration parameters logged and synchronized.");
}

async function confirmPfpUpdate() {
    let url = document.getElementById('user-pfp-url-input').value.trim();
    if(!url) return;
    const res = await fetch('/api/profile/pfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pfp: url })
    });
    if(res.ok) {
        closeModal('modal-user-pfp');
        document.getElementById('my-footer-avatar-img').src = url;
    }
}

// ==========================================
// 11. SOCKET BROADCAST CAPTURE OVERRIDES
// ==========================================
socket.on('receive_chat_message', (msg) => {
    if(msg.channelId === currentChannelId) {
        renderMessageRow(msg);
    }
});

socket.on('mod_action', (data) => {
    alert(`AUTOMOD INTERCEPTION: ${data.text || "Action triggered."}`);
});

socket.on('incoming_date_packet', async (data) => {
    if(data.target === currentUsername) {
        if(confirm(`⚠️ INCOMING DATING REQUEST: @${data.sender} sent a 'DATE?' request packet. Establish heart connection synchronization matrix?`)) {
            await fetch('/api/social/accept-date', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUser: data.sender })
            });
            alert(`Synchronization successful! You are now dating @${data.sender}. Check out your bio update!`);
        }
    }
});

// FIXED: Keydown structural interface interceptor pasted seamlessly at script level base
document.addEventListener("DOMContentLoaded", () => {
    const mainChatInput = document.getElementById('chat-input');
    if (mainChatInput) {
        mainChatInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault(); 
                transmitMessage();
            }
        });
    }
});
