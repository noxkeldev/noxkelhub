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

// 1. DATABASE SCHEMAS
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pfp: { type: String, default: "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel" },
    servers: { type: Array, default: [] }, // Array of serverIds this user has joined
    // Maps serverId -> { warnings: Number, muteUntil: Date/Null, permaMuted: Boolean }
    modRecords: { type: Map, of: Object, default: {} }
});
const User = mongoose.model('User', userSchema);

const serverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: String, required: true },
    isPrivate: { type: Boolean, default: false },
    accessCode: { type: String, default: "" }, // Used if private
    bannedWords: { type: Array, default: [] }, // AutoMod words configured by admin
    channels: [{
        name: { type: String, required: true },
        isReadOnly: { type: Boolean, default: false } // True = Announcement board
    }]
});
const ChatServer = mongoose.model('ChatServer', serverSchema);

const messageSchema = new mongoose.Schema({
    channelId: { type: String, required: true }, // Format: "serverId-channelName"
    username: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// 2. MIDDLEWARE
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'super-secret-key', resave: false, saveUninitialized: false }));

// 3. API ROUTING
// Auth System
app.post('/auth', async (req, res) => {
    const { type, username, password } = req.body;
    if (type === 'signup') {
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = await User.create({ username, password: hashedPassword });
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

// Force-Join Global Server Route
app.post('/api/servers/join-global', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    
    // Find or automatically establish the global hub managed by sweetcafw
    let globalSrv = await ChatServer.findOne({ owner: 'sweetcafw', name: 'Global Network' });
    if (!globalSrv) {
        globalSrv = await ChatServer.create({
            name: 'Global Network',
            owner: 'sweetcafw',
            isPrivate: false,
            channels: [{ name: 'lounge', isReadOnly: false }, { name: 'announcements', isReadOnly: true }]
        });
    }

    await User.updateOne({ username: req.session.user }, { $addToSet: { servers: globalSrv._id.toString() } });
    res.json({ success: true });
});

// Get User's Joined Servers
app.get('/api/servers/my', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findOne({ username: req.session.user });
    const servers = await ChatServer.find({ _id: { $in: user.servers } });
    res.json(servers);
});

// Get Public Discover Servers
app.get('/api/servers/discover', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const publicServers = await ChatServer.find({ isPrivate: false });
    res.json(publicServers);
});

// Create Server Workspace
app.post('/api/servers/create', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { name, isPrivate, accessCode } = req.body;

    const newServer = await ChatServer.create({
        name: name.trim(),
        owner: req.session.user,
        isPrivate,
        accessCode: isPrivate ? accessCode.trim() : "",
        channels: [{ name: 'lounge', isReadOnly: false }] // Starts with 1 basic channel
    });

    // Automatically join the creator to their own server
    await User.updateOne({ username: req.session.user }, { $addToSet: { servers: newServer._id.toString() } });
    res.json(newServer);
});

// Join Server via Access Code
app.post('/api/servers/join-code', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { code } = req.body;

    const srv = await ChatServer.findOne({ accessCode: code.trim() });
    if (!srv) return res.json({ success: false, message: "Invalid access code pattern." });

    await User.updateOne({ username: req.session.user }, { $addToSet: { servers: srv._id.toString() } });
    res.json({ success: true, server: srv });
});

// Direct Join via Discover Page Click
app.post('/api/servers/join-discover', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { serverId } = req.body;
    await User.updateOne({ username: req.session.user }, { $addToSet: { servers: serverId } });
    res.json({ success: true });
});

// Add Custom Room Channel
app.post('/api/channels/create', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { serverId, roomName, isReadOnly } = req.body;

    const srv = await ChatServer.findById(serverId);
    if (srv.owner !== req.session.user) return res.status(403).json({ error: "Only admins can add rooms." });

    const cleanRoomName = roomName.trim().toLowerCase().replace(/\s+/g, '-');
    await ChatServer.findByIdAndUpdate(serverId, { 
        $push: { channels: { name: cleanRoomName, isReadOnly } } 
    });
    res.json({ success: true });
});

// Configure AutoMod Settings
app.post('/api/servers/automod', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { serverId, words } = req.body;

    const srv = await ChatServer.findById(serverId);
    if (srv.owner !== req.session.user) return res.status(403).json({ error: "Unauthorized structural adjustments." });

    srv.bannedWords = words.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    await srv.save();
    res.json({ success: true, bannedWords: srv.bannedWords });
});

// Fetch Message Logs
app.get('/api/messages/:channelId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    res.json(await Message.find({ channelId: req.params.channelId }).sort({ timestamp: 1 }).limit(50));
});

// Profile Management Endpoints
app.post('/api/profile/pfp', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findOneAndUpdate({ username: req.session.user }, { pfp: req.body.pfp }, { new: true });
    res.json({ success: true, pfp: user.pfp });
});

app.get('/api/user/pfp/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    res.json({ pfp: user ? user.pfp : "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel" });
});


// 4. REAL-TIME SOCKET CONNECTION INTEGRATION
io.on('connection', (socket) => {
    socket.on('join_channel', (channelId) => { socket.join(channelId); });

    socket.on('send_chat_message', async (data) => {
        const { serverId, channelId, channelName, username, text } = data;
        const lowerText = text.toLowerCase();

        // Security check: Is channel Read-Only? If so, verify if sender is the server owner
        const currentServer = await ChatServer.findById(serverId);
        const targetChannel = currentServer.channels.find(c => c.name === channelName);
        
        if (targetChannel && targetChannel.isReadOnly && currentServer.owner !== username) {
            return socket.emit('mod_action', { type: 'error', text: "Transmission denied. This room is a Read-Only Notice Board!" });
        }

        // Fetch user mod data ledger for this server
        const sender = await User.findOne({ username });
        let record = sender.modRecords.get(serverId) || { warnings: 0, muteUntil: null, permaMuted: false };

        // Check Perma-Mute status
        if (record.permaMuted) {
            return socket.emit('mod_action', { type: 'error', text: "Transmission blocked. You are permanently muted on this server node." });
        }

        // Check Temp-Mute duration timeout
        if (record.muteUntil && new Date() < new Date(record.muteUntil)) {
            const timeLeft = Math.ceil((new Date(record.muteUntil) - new Date()) / 1000 / 60);
            return socket.emit('mod_action', { type: 'error', text: `Transmission blocked. Temp-Muted! Core release in: ${timeLeft} mins.` });
        }

        // Run AutoMod word scan
        const wordTriggered = currentServer.bannedWords.some(w => lowerText.includes(w));
        if (wordTriggered) {
            record.warnings += 1;

            if (record.warnings > 10) {
                // Strike 11: Permanent Mute
                record.permaMuted = true;
                sender.modRecords.set(serverId, record);
                await sender.save();

                io.to(channelId).emit('receive_chat_message', {
                    channelId, username: "⚠️ NOXKEL-BOT",
                    text: `💀 PERMANENT LOCKOUT: @${username} triggered an AutoMod rule for the 11th time. Account is permanently muted here.`,
                    timestamp: new Date()
                });
                socket.emit('mod_action', { type: 'perma_mute' });
                return;
            } else {
                // Strikes 1-10: 10 Minute Temporary Mute
                const lockTime = new Date();
                lockTime.setMinutes(lockTime.getMinutes() + 10);
                record.muteUntil = lockTime;
                
                sender.modRecords.set(serverId, record);
                await sender.save();

                io.to(channelId).emit('receive_chat_message', {
                    channelId, username: "⚠️ NOXKEL-BOT",
                    text: `🚨 AUTO-MOD INFRACTION: @${username} triggered a banned phrase! Strike [${record.warnings}/10]. Temp-muted from transmission lines for 10 minutes.`,
                    timestamp: new Date()
                });
                socket.emit('mod_action', { type: 'temp_mute', minutes: 10 });
                return;
            }
        }

        // Save and transmit verified safe string packages
        const savedMsg = await Message.create({ channelId, username, text });
        io.to(channelId).emit('receive_chat_message', { ...savedMsg._doc, pfp: sender.pfp });
    });
