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
    const title = document.getElementById('auth-title');
    const toggleBtn = document.getElementById('toggle-auth');
    if (title) title.innerText = isSignUpMode ? "MATRIX REGISTRATION" : "NOXKEL HUB";
    if (toggleBtn) toggleBtn.innerText = isSignUpMode ? "Already verified? Connect" : "Need an account? Sign Up";
}

async function handleAuth() {
    const usernameInputEl = document.getElementById('username');
    const passwordInputEl = document.getElementById('password');
    if (!usernameInputEl || !passwordInputEl) return;

    const usernameInput = usernameInputEl.value.trim();
    const passwordInput = passwordInputEl.value;
    if(!usernameInput || !passwordInput) return alert("Credentials required.");

    try {
        const res = await fetch('/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: isSignUpMode ? 'signup' : 'login', username: usernameInput, password: passwordInput })
        });
        const data = await res.json();
        
        if(data.success) {
            currentUsername = usernameInput;
            const authContainer = document.getElementById('auth-container');
            const appContainer = document.getElementById('app-container');
            const displayUser = document.getElementById('my-display-username');
            
            if (authContainer) authContainer.style.display = 'none';
            if (appContainer) appContainer.style.display = 'flex';
            if (displayUser) displayUser.innerText = `@${currentUsername}`;
            
            // Sync default profile picture asset lookups
            const pfpRes = await fetch(`/api/user/pfp/${currentUsername}`);
            const pfpData = await pfpRes.json();
            const avatarImg = document.getElementById('my-footer-avatar-img');
            if (avatarImg && pfpData.pfp) avatarImg.src = pfpData.pfp;

            if(data.isNewUser) {
                openModal('modal-global-invite');
            } else {
                loadServersRail();
            }
        } else {
            alert(data.message);
        }
    } catch (err) {
        console.error("Authentication handling failure:", err);
    }
}

async function executeSystemTermLogout() {
    try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if(res.ok) {
            localStorage.clear();
            sessionStorage.clear();
            location.reload();
        }
    } catch (err) {
        console.error("Logout processing failure:", err);
    }
}

// ==========================================
// 2. MODAL CORE ENGINE FUNCTIONS
// ==========================================
function openModal(id) { 
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex'; 
}

// BULLETPROOF REAL-TIME CHANNEL TERMINATION LISTENER
socket.on('channel_destroyed_signal', (data) => {
    if (data && data.serverId === currentServerId) {
        // If the client is currently sitting inside the deleted channel, boot them back to main
        if (currentChannelName.toLowerCase() === data.channelName.toLowerCase()) {
            alert(`NOTICE: Room #${data.channelName} has been completely decommissioned by management.`);
            location.reload();
        } else {
            // Otherwise, simply hot-reload their channels sidebar list silently
            fetch('/api/servers/my')
                .then(res => res.json())
                .then(servers => {
                    const match = servers.find(s => s._id === currentServerId);
                    if (match) renderChannelsList(match.channels);
                });
        }
    }
});

function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.style.display = 'none'; 
}

function toggleCodeFieldDisplay() {
    const privacyEl = document.getElementById('new-server-privacy-input');
    const wrapperEl = document.getElementById('private-code-field-wrapper');
    if (privacyEl && wrapperEl) {
        wrapperEl.style.display = (privacyEl.value === 'private') ? 'block' : 'none';
    }
}

// ==========================================
// 3. WORKSPACE SECTOR PANELS SWITCHING MOTOR
// ==========================================
function switchWorkspaceView(panelId) {
    document.querySelectorAll('.workspace-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sys-btn').forEach(b => b.classList.remove('active'));
    
    const activePanel = document.getElementById(panelId);
    if (activePanel) activePanel.classList.add('active');
    
    if(panelId === 'panel-chat-deck') {
        const btn = document.getElementById('nav-chat-btn');
        if (btn) btn.classList.add('active');
    }
    if(panelId === 'panel-discover-deck') {
        const btn = document.getElementById('nav-discover-btn');
        if (btn) btn.classList.add('active');
    }
    if(panelId === 'panel-social-deck') {
        const btn = document.getElementById('nav-social-btn');
        if (btn) b.classList.add('active');
    }
    if(panelId === 'panel-settings-deck') {
        const btn = document.getElementById('nav-settings-btn');
        if (btn) btn.classList.add('active');
    }
}

// ==========================================
// 4. CHAT SERVERS RAIL GENERATION ENGINE
// ==========================================
async function acceptGlobalInvite() {
    try {
        const res = await fetch('/api/servers/join-global', { method: 'POST' });
        if(res.ok) {
            closeModal('modal-global-invite');
            loadServersRail();
        }
    } catch (err) {
        console.error("Global invite acceptance failure:", err);
    }
}

async function loadServersRail() {
    try {
        const res = await fetch('/api/servers/my');
        const servers = await res.json();
        const rail = document.getElementById('dynamic-servers-rail');
        if (!rail) return;
        rail.innerHTML = "";
        
        servers.forEach(srv => {
            const node = document.createElement('div');
            node.className = "srv-node";
            node.innerText = srv.name ? srv.name.substring(0,2).toUpperCase() : "SRV";
            node.title = srv.name || "Server";
            node.onclick = () => activateServerWorkspace(srv);
            rail.appendChild(node);
        });
    } catch (err) {
        console.error("Failed loading backend servers rail:", err);
    }
}

async function activateServerWorkspace(srv) {
    if (!srv) return;
    currentServerId = srv._id;
    currentServerOwner = srv.owner;
    
    const titleHeader = document.getElementById('active-server-title');
    if (titleHeader) {
        titleHeader.innerText = srv.name;
    }

    const addRoomBtn = document.getElementById('add-room-sidebar-btn');
    if (addRoomBtn) {
        if (srv.owner === currentUsername) {
            addRoomBtn.style.display = 'inline-block';
        } else {
            addRoomBtn.style.display = 'none';
        }
    }

    if (srv.channels && srv.channels.length > 0) {
        renderChannelsList(srv.channels);
        const targetChannel = srv.channels[0];
        selectChannelNode(targetChannel.name || targetChannel.channelName, targetChannel._id);
    } else {
        const channelsContainer = document.getElementById('sidebar-channels-list');
        if (channelsContainer) {
            channelsContainer.innerHTML = "<p style='font-size:0.75rem; color:#444; padding:10px;'>No channels built.</p>";
        }
    }
    switchWorkspaceView('panel-chat-deck');
}

function renderChannelsList(channels) {
    const container = document.getElementById('sidebar-channels-list');
    if (!container) return;
    container.innerHTML = "";

    channels.forEach(ch => {
        const row = document.createElement('div');
        row.className = "channel-row-item";
        row.setAttribute('data-ch-id', ch._id); 
        row.style.padding = "5px 10px";
        row.style.cursor = "pointer";
        row.style.color = ch._id === currentChannelId ? "#00ff55" : "#aaa";
        
        let prefixSymbol = ch.isReadOnly ? "🔒 " : "# ";
        row.innerText = `${prefixSymbol}${ch.name || ch.channelName}`;
        
        row.onclick = () => selectChannelNode(ch.name || ch.channelName, ch._id);
        container.appendChild(row);
    });
}

async function selectChannelNode(name, id) {
    currentChannelName = name;
    currentChannelId = id;

    const container = document.getElementById('sidebar-channels-list');
    if (container) {
        container.querySelectorAll('.channel-row-item').forEach(div => {
            if(div.getAttribute('data-ch-id') === id) div.style.color = "#00ff55";
            else div.style.color = "#aaa";
        });
    }

    const scroller = document.getElementById('chat-scroller');
    if (scroller) scroller.innerHTML = "<p style='font-size:0.75rem; color:#444; padding:10px;'>Fetching secure stream parameters...</p>";

    socket.emit('join_channel', id);

    try {
        const res = await fetch(`/api/messages/${currentServerId}/${currentChannelId}`);
        if(res.ok) {
            const messages = await res.json();
            if (scroller) {
                scroller.innerHTML = "";
                messages.forEach(msg => renderMessageRow(msg));
            }

            const mainChatInput = document.getElementById('chat-input');
            const sendButton = mainChatInput ? mainChatInput.nextElementSibling : null;
            if (mainChatInput) {
                if ((name.toLowerCase() === 'announcements' || name.toLowerCase() === 'announcement') && currentUsername !== currentServerOwner) {
                    mainChatInput.placeholder = "🔒 This sector is read-only.";
                    mainChatInput.disabled = true;
                    if (sendButton) sendButton.disabled = true;
                } else {
                    mainChatInput.placeholder = "Broadcast string packet...";
                    mainChatInput.disabled = false;
                    if (sendButton) sendButton.disabled = false;
                }
            }
        }
    } catch(err) {
        console.error("Failed to load channel history packet:", err);
    }
}

async function confirmCreateServer() {
    const nameEl = document.getElementById('new-server-name-input');
    const privacyEl = document.getElementById('new-server-privacy-input');
    const codeEl = document.getElementById('new-server-code-input');
    if (!nameEl || !privacyEl || !codeEl) return;

    const name = nameEl.value.trim();
    const privacy = privacyEl.value;
    const code = codeEl.value.trim();
    if(!name) return;

    try {
        const res = await fetch('/api/servers/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, isPrivate: (privacy === 'private'), accessCode: code })
        });
        if(res.ok) {
            closeModal('modal-create-server');
            nameEl.value = "";
            codeEl.value = "";
            loadServersRail();
        }
    } catch (err) {
        console.error("Server creation protocol error:", err);
    }
}

async function confirmJoinByCode() {
    const codeEl = document.getElementById('join-code-input');
    if (!codeEl) return;
    const code = codeEl.value.trim();
    if(!code) return;
    alert("Synthesizing entry string...");
    closeModal('modal-join-code');
}

// ==========================================
// 5. WORKSPACE CONTEXT SWITCHING (CHANNELS)
// ==========================================
async function confirmAddRoomChannel() {
    const nameEl = document.getElementById('new-room-name-input');
    const typeEl = document.getElementById('new-room-type-input');
    if (!nameEl || !typeEl) return;

    const name = nameEl.value.trim().toLowerCase();
    const type = typeEl.value; 
    if(!name) return alert("CRITICAL ERROR: Room name identifier cannot be blank.");

    try {
        const res = await fetch('/api/channels/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverId: currentServerId,
                channelName: name,
                isReadOnly: (type === 'readonly')
            })
        });

        if(res.ok) {
            alert(`SYSTEM: Custom room sector #${name} successfully injected into database.`);
            closeModal('modal-add-room');
            nameEl.value = ""; 
            
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
    if (!input) return;
    const val = input.value.trim();
    if(!val) return;

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

// DIAGNOSTICALLY TUNED SLASH COMMAND MATRIX HANDLER
function handleSlashCommands(str) {
    const parts = str.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ').trim();

    if(command === '/commands') {
        openModal('modal-admin-terminal-dashboard');
        return;
    }
    if(command === '/clear') {
        const scroller = document.getElementById('chat-scroller');
        if (scroller) scroller.innerHTML = "";
        return;
    }

    if(command === '/rollbackdaterequest') {
        const target = args.replace('@', '').trim();
        if(!target) return alert("CRITICAL ERROR: Specify a target user handle to execute rollback.");

        fetch('/api/social/cancel-date', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername, targetUser: target })
        })
        .then(res => res.json().catch(() => ({ success: false })))
        .then(data => {
            if(data.success) {
                alert(`SYSTEM: Transmission aborted. Invite request sent to @${target} has been purged.`);
            } else {
                alert("ERROR: Mainframe failed to purge packet.");
            }
        })
        .catch(err => console.error("Rollback failed:", err));
        return;
    }

    if(command === '/deleteroom') {
        // Strip out any # formatting symbols and trim stray space configurations safely
        const targetRoom = args.replace('#', '').trim().toLowerCase();
        if(!targetRoom) return alert("CRITICAL ERROR: Specify a custom channel name to delete.");
        if(currentServerOwner !== currentUsername) return alert("ACCESS DENIED: Only the Server Owner can execute channel terminations.");

        if(!confirm(`Execute terminal destruction command on channel #${targetRoom}?`)) return;

        fetch(`/api/channels/${currentServerId}/${targetRoom}`, { method: 'DELETE' })
        .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if(res.ok && data.success) {
                alert(`SYSTEM: Channel #${targetRoom} data signature wiped from node.`);
                // Hot reload the channel state profile to immediately clear sidebar visuals
                fetch('/api/servers/my')
                    .then(r => r.json())
                    .then(servers => {
                        const currentServerData = servers.find(s => s._id === currentServerId);
                        if(currentServerData) activateServerWorkspace(currentServerData);
                    });
            } else {
                alert(`ERROR: Mainframe rejected room injection. Reason: ${data.message || 'Unknown Matrix Logic Failure'}`);
            }
        })
        .catch(err => {
            console.error("Room destruction failure:", err);
            alert("ERROR: Handshake disconnected during termination signal cycle.");
        });
        return;
    }

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
    const targetEl = document.getElementById('admin-manual-target-user');
    if (!targetEl) return;
    const target = targetEl.value.trim();
    if(!target && ['/kick', '/giveadmin'].includes(commandType)) return alert("Target handle required.");
    
    handleSlashCommands(`${commandType} ${target}`);
    closeModal('modal-admin-terminal-dashboard');
    targetEl.value = "";
}

function confirmPhotoPacketTransmission() {
    const urlEl = document.getElementById('photo-packet-url-input');
    if (!urlEl) return;
    const url = urlEl.value.trim();
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
    urlEl.value = "";
}

function renderMessageRow(msg) {
    const scroller = document.getElementById('chat-scroller');
    if (!scroller) return;
    const row = document.createElement('div');
    row.className = "msg-line";
    row.id = `msg-block-${msg._id}`;
    
    const safeSrc = msg.pfp || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.username}`;
    let imageTag = msg.imageUrl ? `<img src="${msg.imageUrl}" class="msg-img-attachment" onerror="this.style.display='none';">` : "";
    let editBadge = msg.isEdited ? `<span style="font-size:0.6rem; color:#444; margin-left:5px;">(edited)</span>` : "";

    let actionMenu = "";
    if(msg.username === currentUsername) {
        actionMenu = `
            <div class="msg-actions-trigger">
                <button class="msg-action-btn" id="edit-btn-${msg._id}">EDIT</button>
                <button class="msg-action-btn" onclick="triggerDeletePacket('${msg._id}')">DEL</button>
                <button class="msg-action-btn" id="fwd-btn-${msg._id}">FWD</button>
            </div>
        `;
    } else {
        actionMenu = `
            <div class="msg-actions-trigger">
                <button class="msg-action-btn" id="fwd-btn-${msg._id}">FWD</button>
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

    const editButton = row.querySelector(`#edit-btn-${msg._id}`);
    if (editButton) {
        editButton.onclick = () => triggerEditPacketPrompt(msg._id, msg.text);
    }
    const fwdButton = row.querySelector(`#fwd-btn-${msg._id}`);
    if (fwdButton) {
        fwdButton.onclick = () => triggerForwardPacket(msg.text);
    }

    scroller.scrollTop = scroller.scrollHeight;
}

function triggerEditPacketPrompt(id, rawText) {
    messageUnderRevisionId = id;
    const textInput = document.getElementById('edit-message-text-input');
    if (textInput) textInput.value = rawText;
    openModal('modal-edit-message');
    
    const confirmBtn = document.getElementById('confirm-edit-msg-btn');
    if (confirmBtn) {
        confirmBtn.onclick = async function() {
            const nText = textInput ? textInput.value.trim() : "";
            try {
                const res = await fetch('/api/messages/edit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messageId: messageUnderRevisionId, newText: nText })
                });
                if(res.ok) {
                    closeModal('modal-edit-message');
                    selectChannelNode(currentChannelName, currentChannelId); 
                }
            } catch (err) {
                console.error("Message adjustment handshake dropped:", err);
            }
        };
    }
}

async function triggerDeletePacket(id) {
    if(!confirm("Erase this text packet from stream database?")) return;
    try {
        const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
        if(res.ok) {
            const block = document.getElementById(`msg-block-${id}`);
            if (block) block.remove();
        }
    } catch (err) {
        console.error("Database deletion route blocked:", err);
    }
}

function triggerForwardPacket(text) {
    const targetDestName = prompt("Enter target room location identifier channel name (e.g., lounge):");
    if(!targetDestName) return;

    const container = document.getElementById('sidebar-channels-list');
    let targetedChannelId = currentChannelId; 
    
    if (container) {
        const matchingNode = Array.from(container.querySelectorAll('.channel-row-item')).find(div => div.innerText.includes(targetDestName.toLowerCase()));
        if(matchingNode) {
            targetedChannelId = matchingNode.getAttribute('data-ch-id');
        }
    }

    socket.emit('send_chat_message', {
        serverId: currentServerId, 
        channelId: targetedChannelId,
        channelName: targetDestName, 
        username: currentUsername, 
        text: `[Forwarded]: ${text}`, 
        imageUrl: ""
    });
    alert("Message packet forwarded.");
}

// ==========================================
// 7. PROFILE RENDERING & SOCIAL SYSTEMS MATRIX
// ==========================================
async function inspectUserProfile(targetName) {
    activeInspectedUser = targetName;
    try {
        const res = await fetch(`/api/user/profile/${targetName}`);
        const data = await res.json();
        
        const usernameEl = document.getElementById('prof-modal-username');
        const pfpEl = document.getElementById('prof-modal-pfp');
        const pronounsEl = document.getElementById('prof-modal-pronouns');
        const ageEl = document.getElementById('prof-modal-age');
        const bioEl = document.getElementById('prof-modal-bio');

        if (usernameEl) usernameEl.innerText = `@${data.username}`;
        if (pfpEl && data.pfp) pfpEl.src = data.pfp;
        if (pronounsEl) pronounsEl.innerText = `Pronouns: ${data.pronouns || "Unspecified"}`;
        if (ageEl) ageEl.innerText = `Age: ${data.age || "Not tracked"}`;
        if (bioEl) bioEl.innerText = data.bio || "";
        
        const actionBar = document.getElementById('prof-modal-interaction-bar');
        if (actionBar) {
            actionBar.innerHTML = "";
            if(targetName !== currentUsername) {
                const friendBtn = document.createElement('button');
                friendBtn.innerText = "you r my friend now?";
                friendBtn.onclick = () => dispatchSocialRequest('friend', targetName);

                const dateBtn = document.createElement('button');
                dateBtn.innerText = "INVITE?";
                dateBtn.style.borderColor = "#ff0055";
                dateBtn.style.color = "#ff0055";
                dateBtn.onclick = () => dispatchSocialRequest('date', targetName);

                actionBar.appendChild(friendBtn);
                actionBar.appendChild(dateBtn);
            }
        }
        openModal('modal-view-profile');
    } catch (err) {
        console.error("Profile inspection system exception:", err);
    }
}

async function dispatchSocialRequest(type, preciseTargetUser) {
    closeModal('modal-view-profile');
    const userToTarget = preciseTargetUser || activeInspectedUser;
    
    try {
        if(type === 'friend') {
            const res = await fetch('/api/social/friend-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUser: userToTarget })
            });
            if(res.ok) alert("Friend synchronization query sent.");
        }
        if(type === 'date') {
            await fetch('/api/social/date-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUser: userToTarget })
            });
            alert(`Connection request transmitted to @${userToTarget}. Waiting for signature...`);
        }
    } catch (err) {
        console.error("Social pipeline negotiation error:", err);
    }
}

// ==========================================
// 8. DISCOVER PAGE GRID INTERFACE LOGIC
// ==========================================
async function loadDiscoverMainframe() {
    switchWorkspaceView('panel-discover-deck');
    try {
        const res = await fetch('/api/discover/servers');
        const openServers = await res.json();
        const grid = document.getElementById('discover-servers-grid');
        if (!grid) return;
        grid.innerHTML = "";

        openServers.forEach(srv => {
            const card = document.createElement('div');
            card.className = "matrix-card";
            card.innerHTML = `
                <div>
                    <h4>${srv.name || 'Unnamed Server'}</h4>
                    <p>Host Controller: @${srv.owner || 'Unknown'}</p>
                </div>
                <button class="sys-btn" style="text-align:center;" id="disc-join-${srv._id}">Establish Connection Sync</button>
            `;
            grid.appendChild(card);
            
            const connBtn = card.querySelector(`#disc-join-${srv._id}`);
            if (connBtn) {
                connBtn.onclick = () => {
                    activateServerWorkspace(srv);
                };
            }
        });
    } catch (err) {
        console.error("Discover sector framework synchronization trace dropped:", err);
    }
}

// ==========================================
// 9. FRIEND MATRIX TRACK SECTOR LOADERS
// ==========================================
async function loadSocialMainframe() {
    switchWorkspaceView('panel-social-deck');
    
    const reqBox = document.getElementById('social-requests-box');
    const friendBox = document.getElementById('social-friends-box');
    
    if (reqBox) reqBox.innerHTML = "<p style='font-size:0.75rem; color:#444;'>Scanning request logs...</p>";
    if (friendBox) friendBox.innerHTML = "<p style='font-size:0.75rem; color:#444;'>Scanning active pipelines...</p>";

    try {
        const res = await fetch(`/api/user/profile/${currentUsername}`);
        const data = await res.json();

        if (reqBox) {
            reqBox.innerHTML = "";
            const pendingRequests = data.friendRequests || data.pendingRequests || []; 
            
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
                        <button class="sys-btn" style="padding:2px 8px; font-size:0.75rem;" id="accept-friend-${sender}">ACCEPT</button>
                    `;
                    reqBox.appendChild(row);
                    
                    const acceptBtn = row.querySelector(`#accept-friend-${sender}`);
                    if (acceptBtn) {
                        acceptBtn.onclick = () => acceptFriendPipeline(sender);
                    }
                });
            }
        }

        if (friendBox) {
            friendBox.innerHTML = "";
            const friendsList = data.friends || [];
            
            if (friendsList.length === 0) {
                friendBox.innerHTML = "<p style='font-size:0.75rem; color:#666;'>No direct active pipelines established.</p>";
            } else {
                friendsList.forEach(friend => {
                    const div = document.createElement('div');
                    div.style.padding = "5px 0";
                    div.style.color = "#00ff55"; 
                    div.style.fontSize = "0.85rem";
                    div.innerText = `• @${friend} [SECURE CONNECTION]`;
                    friendBox.appendChild(div);
                });
            }
        }

    } catch (err) {
        console.error("Failed to load social mainframe matrices:", err);
        if (reqBox) reqBox.innerHTML = "<p style='font-size:0.75rem; color:#ff0055;'>CRITICAL TRACK READ ERROR</p>";
    }
}

async function acceptFriendPipeline(senderUsername) {
    try {
        const res = await fetch('/api/social/accept-friend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUser: senderUsername })
        });
        
        if (res.ok) {
            alert(`SYSTEM: Friendship synchronization signed with @${senderUsername}!`);
            loadSocialMainframe(); 
        } else {
            alert("ERROR: Failed to establish secure friend bridge.");
        }
    } catch (err) {
        console.error("Friend link confirmation exception failure:", err);
    }
}

// ==========================================
// 10. ACCOUNT PROFILE PARAMETERS STORAGE MOTOR
// ==========================================
async function commitHardwareSettingsChanges() {
    const pronounsEl = document.getElementById('setting-pronouns-input');
    const ageEl = document.getElementById('setting-age-input');
    const bioEl = document.getElementById('setting-bio-input');

    const pronouns = pronounsEl ? pronounsEl.value : "";
    const ageInputVal = ageEl ? ageEl.value : "";
    const bio = bioEl ? bioEl.value : "";

    try {
        const res = await fetch('/api/user/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                pronouns, 
                age: ageInputVal ? parseInt(ageInputVal, 10) : null, 
                bio
            })
        });
        if(res.ok) alert("Hardware configuration parameters logged and synchronized.");
    } catch (err) {
        console.error("Settings parameter validation connection drop:", err);
    }
}

async function confirmPfpUpdate() {
    const urlEl = document.getElementById('user-pfp-url-input');
    if (!urlEl) return;
    let url = urlEl.value.trim();
    if(!url) return;

    try {
        const res = await fetch('/api/profile/pfp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pfp: url })
        });
        if(res.ok) {
            closeModal('modal-user-pfp');
            const avatarImg = document.getElementById('my-footer-avatar-img');
            if (avatarImg) avatarImg.src = url;
        }
    } catch (err) {
        console.error("Profile picture structural upload tracking dropped:", err);
    }
}

// ==========================================
// 11. SOCKET BROADCAST CAPTURE OVERRIDES
// ==========================================
socket.on('receive_chat_message', (msg) => {
    if(msg && msg.channelId === currentChannelId) {
        renderMessageRow(msg);
    }
});

socket.on('mod_action', (data) => {
    if (data) alert(`AUTOMOD INTERCEPTION: ${data.text || "Action triggered."}`);
});

socket.on('incoming_date_packet', async (data) => {
    if(data && data.target === currentUsername) {
        if(confirm(`⚠️ INCOMING INVITE REQUEST: @${data.sender} sent an invitation packet. Establish connection synchronization matrix?`)) {
            try {
                await fetch('/api/social/accept-date', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetUser: data.sender })
                });
                alert(`Synchronization successful! Connection confirmed with @${data.sender}. Check out your bio update!`);
            } catch (err) {
                console.error("Data tracking signature validation broken:", err);
            }
        }
    }
});

// ==========================================
// 12. INITIALIZATION & SESSION RESTORATION RUNNERS
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    const mainChatInput = document.getElementById('chat-input');
    if (mainChatInput) {
        mainChatInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault(); 
                transmitMessage();
            }
        });
    }

    try {
        const checkRes = await fetch('/api/auth/check');
        if (!checkRes.ok) return;
        const checkData = await checkRes.json();
        
        if (checkData && checkData.loggedIn) {
            currentUsername = checkData.username;
            
            const authContainer = document.getElementById('auth-container');
            const appContainer = document.getElementById('app-container');
            const displayUser = document.getElementById('my-display-username');

            if (authContainer) authContainer.style.display = 'none';
            if (appContainer) appContainer.style.display = 'flex';
            if (displayUser) displayUser.innerText = `@${currentUsername}`;
            
            try {
                const pfpRes = await fetch(`/api/user/pfp/${currentUsername}`);
                if (pfpRes.ok) {
                    const pfpData = await pfpRes.json();
                    const avatarImg = document.getElementById('my-footer-avatar-img');
                    if (avatarImg && pfpData.pfp) avatarImg.src = pfpData.pfp;
                }
            } catch (pfpErr) {
                console.warn("PFP route not found or failed, skipping...", pfpErr);
            }
            
            try {
                const res = await fetch('/api/servers/my');
                if (res.ok) {
                    const servers = await res.json();
                    
                    const rail = document.getElementById('dynamic-servers-rail');
                    if (rail) {
                        rail.innerHTML = "";
                        servers.forEach(srv => {
                            const node = document.createElement('div');
                            node.className = "srv-node";
                            node.innerText = srv.name ? srv.name.substring(0,2).toUpperCase() : "SRV";
                            node.title = srv.name || "Server";
                            node.onclick = () => activateServerWorkspace(srv);
                            rail.appendChild(node);
                        });
                    }

                    if (servers && servers.length > 0) {
                        activateServerWorkspace(servers[0]);
                    } else {
                        const channelsContainer = document.getElementById('sidebar-channels-list');
                        if (channelsContainer) {
                            channelsContainer.innerHTML = "<p style='font-size:0.75rem; color:#444; padding:10px;'>Join or create a server to start.</p>";
                        }
                    }
                }
            } catch (serverErr) {
                console.error("Failed to load servers rail:", serverErr);
            }
            
            try {
                const profileRes = await fetch(`/api/user/profile/${currentUsername}`);
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    if (profileData) {
                        const bioInput = document.getElementById('setting-bio-input');
                        const pronounsInput = document.getElementById('setting-pronouns-input');
                        const ageInput = document.getElementById('setting-age-input');

                        if (bioInput) bioInput.value = profileData.bio || "";
                        if (pronounsInput) pronounsInput.value = profileData.pronouns || "";
                        if (ageInput && profileData.age) ageInput.value = profileData.age;
                    }
                }
            } catch (profErr) {
                console.warn("Profile stats fetch failed or route missing, skipping...", profErr);
            }

            console.log("⚡ SESSION RESTORE PROTOCOL: Secure token match. Welcome back.");
        }
    } catch (sessionError) {
        console.warn("Session scanner idle or backend server offline:", sessionError);
    }
});
