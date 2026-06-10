// 1. Initialize Real-Time Connection
const socket = io();

// State variables to track what the user is doing
let currentUsername = "";
let currentServerId = "global";
let currentChannel = "general";
let authMode = "login"; // can be 'login' or 'signup'

// 2. CHECK SESSION ON LOAD
window.onload = function() {
    const savedUser = localStorage.getItem("chat_username");
    if (savedUser) {
        currentUsername = savedUser;
        enterApp();
    }
};

// 3. AUTHENTICATION LOGIC (Login / Signup)
function toggleAuthMode() {
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const toggleBtn = document.getElementById('toggle-auth');
    const submitBtn = document.querySelector('#auth-container button');

    if (authMode === "login") {
        authMode = "signup";
        title.innerText = "Create an Account";
        subtitle.innerText = "Join the community today!";
        submitBtn.innerText = "Sign Up";
        toggleBtn.innerText = "Already have an account? Log In";
    } else {
        authMode = "login";
        title.innerText = "Welcome Back!";
        subtitle.innerText = "We're so excited to see you again!";
        submitBtn.innerText = "Log In";
        toggleBtn.innerText = "Need an account? Register";
    }
}

async function handleAuth() {
    const userIn = document.getElementById('username').value.trim();
    const passIn = document.getElementById('password').value.trim();

    if (!userIn || !passIn) return alert("Please fill in all fields.");

    const res = await fetch('/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: authMode, username: userIn, password: passIn })
    });

    const data = await res.json();
    
    if (data.success) {
        currentUsername = userIn;
        localStorage.setItem("chat_username", userIn);
        enterApp();
    } else {
        alert(data.message || "Authentication failed!");
    }
}

// 4. ENTER APPLICATION DESK
function enterApp() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    document.getElementById('current-user-display').innerText = `@${currentUsername}`;
    
    loadServers();
    selectChannel('general'); // Join default channel
}

function logout() {
    localStorage.removeItem("chat_username");
    window.location.reload();
}

// 5. SERVER MANAGEMENT
async function loadServers() {
    const res = await fetch('/api/servers');
    if (!res.ok) return;
    const servers = await res.json();
    
    const rail = document.getElementById('server-rail');
    // Clear out custom servers, keep Global and "+" button
    rail.innerHTML = `
        <div class="server-icon ${currentServerId === 'global' ? 'active' : ''}" onclick="selectServer('global', 'Global Network')">🌐</div>
    `;
    
    servers.forEach(srv => {
        const icon = document.createElement('div');
        icon.className = `server-icon ${currentServerId === srv._id ? 'active' : ''}`;
        icon.innerText = srv.name.substring(0, 2).toUpperCase();
        icon.onclick = () => selectServer(srv._id, srv.name, srv.channels);
        rail.appendChild(icon);
    });
    
    // Put add button back at the bottom
    const addBtn = document.createElement('div');
    addBtn.className = "server-icon add-server-btn";
    addBtn.innerText = "+";
    addBtn.onclick = createNewServer;
    rail.appendChild(addBtn);
}

async function createNewServer() {
    const name = prompt("Enter Server Name:");
    if (!name || !name.trim()) return;

    const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    });

    if (res.ok) {
        loadServers();
    }
}

function selectServer(serverId, serverName, channels = ['general', 'gaming']) {
    currentServerId = serverId;
    document.getElementById('current-server-name').innerText = serverName;
    
    // Highlight correct server icon
    loadServers();

    // Render channels list for this server
    const listContainer = document.getElementById('channel-list');
    listContainer.innerHTML = "";
    
    channels.forEach((ch, idx) => {
        const item = document.createElement('div');
        item.className = `channel-item ${idx === 0 ? 'active' : ''}`;
        item.innerText = ch;
        item.onclick = () => {
            // Remove active classes
            document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            selectChannel(ch);
        };
        listContainer.appendChild(item);
    });

    selectChannel(channels[0]);
}

// 6. CHANNEL & LIVE MESSAGING INFRASTRUCTURE
async function selectChannel(channelName) {
    // Unique room room ID combining server and channel names
    currentChannel = `${currentServerId}-${channelName}`;
    document.getElementById('current-channel-header').innerText = `# ${channelName}`;
    document.getElementById('chat-box').placeholder = `Message #${channelName}`;

    // Tell Socket.io backend we are swapping channels
    socket.emit('join_channel', currentChannel);

    // Fetch message logs from MongoDB database
    const res = await fetch(`/api/messages/${currentChannel}`);
    const messages = await res.json();
    
    const area = document.getElementById('message-area');
    area.innerHTML = ""; // Clear view screen
    
    messages.forEach(msg => appendMessage(msg));
    scrollToBottom();
}

function sendChatMessage() {
    const box = document.getElementById('chat-box');
    const text = box.value.trim();
    if (!text) return;

    // Package data to route across web sockets
    const messagePackage = {
        channelId: currentChannel,
        username: currentUsername,
        text: text
    };

    socket.emit('send_chat_message', messagePackage);
    box.value = ""; // Clear input box
}

// Append visual message bubble to screen array
function appendMessage(msg) {
    const area = document.getElementById('message-area');
    
    const bubble = document.createElement('div');
    bubble.className = "msg-bubble";
    
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    bubble.innerHTML = `
        <div class="msg-meta">${msg.username} <span>${timeStr}</span></div>
        <div class="msg-text">${msg.text}</div>
    `;
    
    area.appendChild(bubble);
    scrollToBottom();
}

function scrollToBottom() {
    const area = document.getElementById('message-area');
    area.scrollTop = area.scrollHeight;
}

// 7. REAL-TIME SOCKET LISTENERS
socket.on('receive_chat_message', (msg) => {
    // Only append to screen if the message belongs to the room the user is looking at
    if (msg.channelId === currentChannel) {
        appendMessage(msg);
    }
});

socket.on('channel_cleared', () => {
    document.getElementById('message-area').innerHTML = "";
});
