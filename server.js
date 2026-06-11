const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect('mongodb+srv://sweetcafw:BLACKPINK%40LISA@cluster0.oxbhatm.mongodb.net/?appName=Cluster0');

// ==========================================
// 1. UPDATED SCHEMAS WITH ALL NEW FEATURES
// ==========================================
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pfp: { type: String, default: "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel" },
    servers: { type: Array, default: [] },
    modRecords: { type: Map, of: Object, default: {} },
    
    // Settings & Profile Upgrades
    pronouns: { type: String, default: "Not Specified" },
    age: { type: Number, default: null },
    bio: { type: String, default: "No bio written yet." },
    datingPartner: { type: String, default: "" }, // Stores username of who they are dating
    
    // Social Infrastructure
    friends: { type: Array, default: [] },          // Array of usernames
    friendRequests: { type: Array, default: [] }    // Array of usernames who sent requests
}));

const ChatServer = mongoose.models.ChatServer || mongoose.model('ChatServer', new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: String, required: true },
    admins: { type: Array, default: [] }, // Array of usernames with admin clearance
    isPrivate: { type: Boolean, default: false },
    accessCode: { type: String, default: "" },
    bannedWords: { type: Array, default: [] },
    channels: [{ name: { type: String, required: true }, isReadOnly: { type: Boolean, default: false } }],
    
    // Abadaba State Trackers
    abadabaActive: { type: Boolean, default: false },
    originalNamesBackup: { type: Map, of: String, default: {} } // Maps username to real names if needed
}));

const Message = mongoose.models.Message || mongoose.model('Message', new mongoose.Schema({
    channelId: { type: String, required: true }, // Can be serverId-channelName OR a DM identifier
    username: { type: String, required: true },
    text: { type: String, required: true },
    imageUrl: { type: String, default: "" },      // Photo sharing link support
    isEdited: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'super-secret-key', resave: false, saveUninitialized: false }));

// ==========================================
// 2. EXISTING & NEW API TRACKS
// ==========================================

// Existing Authentication Matrix + Session Clear Fixes
app.post('/auth', async (req, res) => {
    const { type, username, password } = req.body;
    if (type === 'signup') {
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.create({ username, password: hashedPassword });
            req.session.user = username;
            res.json({ success: true, isNewUser: true });
        } catch (err) { res.json({ success: false, message: "Username taken!" }); }
    } else {
        const user = await User.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = username;
            res.json({ success: true, isNewUser: false });
        } else { res.json({ success: false, message: "Invalid credentials" }); }
    }
});

// LOGOUT CONFIG MATRIX
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// PROFILE & SETTINGS UPDATE MOTOR
app.post('/api/user/settings', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { pronouns, age, bio } = req.body;
    await User.findOneAndUpdate(
        { username: req.session.user },
        { pronouns, age: age ? parseInt(age) : null, bio }
    );
    res.json({ success: true });
});

// GET PROFILE INFO MATRIX (For clicking on users)
app.get('/api/user/profile/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "User missing" });
    
    // Automatically craft bio injection if they are dating someone
    let completeBio = user.bio;
    if (user.datingPartner) {
        completeBio += `\n❤️ Dating @${user.datingPartner} ❤️`;
    }

    res.json({
        username: user.username,
        pfp: user.pfp,
        pronouns: user.pronouns,
        age: user.age,
        bio: completeBio,
        datingPartner: user.datingPartner
    });
});

// DISCOVER PAGE CORE: Pulls all open public nodes
app.get('/api/discover/servers', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const publicServers = await ChatServer.find({ isPrivate: false });
    res.json(publicServers);
});

// DELETING SERVERS AND CHANNELS
app.delete('/api/servers/:serverId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const srv = await ChatServer.findById(req.params.serverId);
    if (!srv || srv.owner !== req.session.user) return res.status(403).json({ error: "Owner clearance only." });
    
    await ChatServer.findByIdAndDelete(req.params.serverId);
    res.json({ success: true });
});

app.delete('/api/channels/:serverId/:channelName', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const srv = await ChatServer.findById(req.params.serverId);
    if (!srv || srv.owner !== req.session.user) return res.status(403).json({ error: "Owner clearance only." });

    await ChatServer.findByIdAndUpdate(req.params.serverId, {
        $pull: { channels: { name: req.params.channelName } }
    });
    res.json({ success: true });
});

// FIX FEATURE: PER-SERVER ROOM DELETION (OWNER ONLY)
app.post('/api/channels/delete-room', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { serverId, roomName } = req.body;

    try {
        const srv = await ChatServer.findById(serverId);
        if (!srv) return res.status(404).json({ success: false, message: "Server not found." });
        
        // Check if the running session user is the actual creator/owner of this server
        if (srv.owner !== req.session.user) {
            return res.status(403).json({ success: false, message: "Clearance Error: Only the Server Owner can delete custom rooms!" });
        }

        // Pull the specific room layout completely out of the channels array array
        await ChatServer.findByIdAndUpdate(serverId, {
            $pull: { channels: { name: roomName } }
        });

        res.json({ success: true, message: `Room '${roomName}' successfully cleared.` });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal Engine Error." });
    }
});

// MESSAGE MODIFICATION TRACKS (Edit/Delete)
app.post('/api/messages/edit', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { messageId, newText } = req.body;
    const msg = await Message.findById(messageId);
    if (msg.username !== req.session.user) return res.status(403).json({ error: "Lock error." });
    
    msg.text = newText;
    msg.isEdited = true;
    await msg.save();
    res.json({ success: true });
});

app.delete('/api/messages/:messageId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const msg = await Message.findById(req.params.messageId);
    if (msg.username !== req.session.user) return res.status(403).json({ error: "Lock error." });
    
    await Message.findByIdAndDelete(req.params.messageId);
    res.json({ success: true });
});

// SOCIAL GATEWAY CONNECTIONS (Friends & Dating Links)
app.post('/api/social/friend-request', async (req, res) => {
    const { targetUser } = req.body;
    if (targetUser === req.session.user) return res.json({ success: false, message: "Can't friend yourself." });
    await User.updateOne({ username: targetUser }, { $addToSet: { friendRequests: req.session.user } });
    res.json({ success: true });
});

app.post('/api/social/accept-friend', async (req, res) => {
    const { targetUser } = req.body;
    await User.updateOne({ username: req.session.user }, { $pull: { friendRequests: targetUser }, $addToSet: { friends: targetUser } });
    await User.updateOne({ username: targetUser }, { $addToSet: { friends: req.session.user } });
    res.json({ success: true });
});

app.post('/api/social/date-request', async (req, res) => {
    const { targetUser } = req.body;
    // Dispatches socket invitation system event
    io.emit('incoming_date_packet', { sender: req.session.user, target: targetUser });
    res.json({ success: true });
});

app.post('/api/social/accept-date', async (req, res) => {
    const { targetUser } = req.body;
    await User.updateOne({ username: req.session.user }, { datingPartner: targetUser });
    await User.updateOne({ username: targetUser }, { datingPartner: req.session.user });
    res.json({ success: true });
});

// RETAINED LEGACY ROUTERS
app.post('/api/servers/join-global', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        let globalSrv = await ChatServer.findOne({ owner: 'sweetcafw', name: 'Global Network' });
        if (!globalSrv) {
            globalSrv = await ChatServer.create({
                name: 'Global Network', owner: 'sweetcafw', isPrivate: false,
                channels: [{ name: 'lounge', isReadOnly: false }, { name: 'announcements', isReadOnly: true }]
            });
        }
        await User.updateOne({ username: req.session.user }, { $addToSet: { servers: globalSrv._id.toString() } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/servers/my', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findOne({ username: req.session.user });
    if (!user || !user.servers) return res.json([]);
    res.json(await ChatServer.find({ _id: { $in: user.servers } }));
});

app.post('/api/servers/create', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        const { name, isPrivate, accessCode } = req.body;
        const newServer = await ChatServer.create({
            name: name.trim(), owner: req.session.user, isPrivate,
            accessCode: isPrivate ? accessCode.trim() : "", channels: [{ name: 'lounge', isReadOnly: false }]
        });
        await User.updateOne({ username: req.session.user }, { $addToSet: { servers: newServer._id.toString() } });
        res.status(200).json(newServer);
    } catch (err) { res.status(500).json({ error: "Interception error." }); }
});

app.post('/api/servers/automod', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { serverId, words } = req.body;
    const srv = await ChatServer.findById(serverId);
    srv.bannedWords = words.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    await srv.save();
    res.json({ success: true });
});

app.get('/api/messages/:channelId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    res.json(await Message.find({ channelId: req.params.channelId }).sort({ timestamp: 1 }).limit(50));
});

app.post('/api/profile/pfp', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findOneAndUpdate({ username: req.session.user }, { pfp: req.body.pfp }, { new: true });
    res.json({ success: true, pfp: user.pfp });
});

app.get('/api/user/pfp/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    res.json({ pfp: user ? user.pfp : "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel" });
});

// ==========================================
// 3. SOCKETS CONTROLLER (WITH PFPS FIXED)
// ==========================================
io.on('connection', (socket) => {
    socket.on('join_channel', (channelId) => { socket.join(channelId); });

    socket.on('send_chat_message', async (data) => {
        let { serverId, channelId, channelName, username, text, imageUrl } = data;
        const currentServer = await ChatServer.findById(serverId);
        
        if (currentServer) {
            // Apply Abadaba Troller Check
            if (currentServer.abadabaActive && username !== "⚠️ AUTOMOD" && username !== "📢 SYSTEM ANNOUNCEMENT") {
                username = "abadaba";
            }

            // Admin Tree Authorization checks
            const isOwner = currentServer.owner === data.username;
            const isAdmin = currentServer.admins.includes(data.username) || isOwner;

            const targetChannel = currentServer.channels.find(c => c.name === channelName);
            if (targetChannel && targetChannel.isReadOnly && !isAdmin) {
                return socket.emit('mod_action', { type: 'error', text: "Notice-only room restriction." });
            }

            // AutoMod Scanner Injection
            if (!isAdmin && currentServer.bannedWords.some(w => text.toLowerCase().includes(w))) {
                return socket.emit('mod_action', { type: 'temp_mute', minutes: 10 });
            }
        }

        // FIX FEATURE: Locate sender in DB to pull their accurate custom PFP link string
        const senderInfo = await User.findOne({ username: data.username });
        const activePfp = senderInfo ? senderInfo.pfp : "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel";

        const savedMsg = await Message.create({ channelId, username, text, imageUrl });
        
        // Emit the payload containing the true custom pfp string to the frontend UI
        io.to(channelId).emit('receive_chat_message', { 
            ...savedMsg._doc, 
            pfp: activePfp 
        });
    });

    // COMMANDS PROTOCOL HANDLERS
    socket.on('execute_admin_override', async (payload) => {
        const { serverId, channelId, command, targetUser, caller } = payload;
        const srv = await ChatServer.findById(serverId);
        if (!srv) return;

        const isOwner = srv.owner === caller;
        const isAdmin = srv.admins.includes(caller) || isOwner;

        if (!isAdmin) {
            return socket.emit('mod_action', { type: 'error', text: "Command access denied." });
        }

        if (command === '/giveadmin') {
            if (!isOwner) return socket.emit('mod_action', { type: 'error', text: "Owner clearance required." });
            await ChatServer.findByIdAndUpdate(serverId, { $addToSet: { admins: targetUser } });
            io.to(channelId).emit('receive_chat_message', { channelId, username: "📢 SYSTEM", text: `@${targetUser} has been elevated to Admin status.` });
        }
        
        if (command === '/kick') {
            await User.updateOne({ username: targetUser }, { $pull: { servers: serverId } });
            io.to(channelId).emit('receive_chat_message', { channelId, username: "📢 SYSTEM", text: `@${targetUser} was removed from the server.` });
        }

        if (command === '/abadaba') {
            if (!isOwner) return;
            srv.abadabaActive = true;
            await srv.save();
            io.to(channelId).emit('receive_chat_message', { channelId, username: "📢 TROLL", text: "ERROR: Mainframe corrupted. Everyone is now abadaba." });
        }

        if (command === '/undoabadaba') {
            if (!isOwner) return;
            srv.abadabaActive = false;
            await srv.save();
            io.to(channelId).emit('receive_chat_message', { channelId, username: "📢 TROLL", text: "Security matrix restored. Original signatures online." });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Engine running smoothly on port ${PORT}`));
