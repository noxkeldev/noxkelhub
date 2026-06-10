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

// 1. SCHEMAS
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pfp: { type: String, default: "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel" },
    servers: { type: Array, default: [] },
    modRecords: { type: Map, of: Object, default: {} }
}));

const ChatServer = mongoose.models.ChatServer || mongoose.model('ChatServer', new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: String, required: true },
    isPrivate: { type: Boolean, default: false },
    accessCode: { type: String, default: "" },
    bannedWords: { type: Array, default: [] },
    channels: [{ name: { type: String, required: true }, isReadOnly: { type: Boolean, default: false } }]
}));

const Message = mongoose.models.Message || mongoose.model('Message', new mongoose.Schema({
    channelId: { type: String, required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'super-secret-key', resave: false, saveUninitialized: false }));

// 2. API ENDPOINTS
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
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
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
        // FIXED RESPONSE PACKET RULE
        res.status(200).json(newServer);
    } catch (err) {
        res.status(500).json({ error: "Creation stream intercept crash." });
    }
});

app.post('/api/servers/join-code', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const srv = await ChatServer.findOne({ accessCode: req.body.code.trim() });
    if (!srv) return res.json({ success: false, message: "Invalid access code pattern." });
    await User.updateOne({ username: req.session.user }, { $addToSet: { servers: srv._id.toString() } });
    res.json({ success: true, server: srv });
});

app.post('/api/channels/create', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { serverId, roomName, isReadOnly } = req.body;
    const srv = await ChatServer.findById(serverId);
    if (srv.owner !== req.session.user) return res.status(403).json({ error: "Admin lock." });
    const cleanRoomName = roomName.trim().toLowerCase().replace(/\s+/g, '-');
    await ChatServer.findByIdAndUpdate(serverId, { $push: { channels: { name: cleanRoomName, isReadOnly } } });
    res.json({ success: true });
});

app.post('/api/servers/automod', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { serverId, words } = req.body;
    const srv = await ChatServer.findById(serverId);
    if (srv.owner !== req.session.user) return res.status(403).json({ error: "Admin lock." });
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

// 3. WEBSOCKET CONTROLLER
io.on('connection', (socket) => {
    socket.on('join_channel', (channelId) => { socket.join(channelId); });

    socket.on('send_chat_message', async (data) => {
        const { serverId, channelId, channelName, username, text } = data;
        const currentServer = await ChatServer.findById(serverId);
        if (!currentServer) return;

        const targetChannel = currentServer.channels.find(c => c.name === channelName);
        if (targetChannel && targetChannel.isReadOnly && currentServer.owner !== username) {
            return socket.emit('mod_action', { type: 'error', text: "Denied. This room is notice-only!" });
        }

        const sender = await User.findOne({ username });
        if (!sender) return;

        let record = sender.modRecords.get(serverId) || { warnings: 0, muteUntil: null, permaMuted: false };
        if (record.permaMuted) return socket.emit('mod_action', { type: 'error', text: "Permanently muted here." });
        if (record.muteUntil && new Date() < new Date(record.muteUntil)) {
            const left = Math.ceil((new Date(record.muteUntil) - new Date()) / 1000 / 60);
            return socket.emit('mod_action', { type: 'error', text: `Muted! Try again in ${left}m.` });
        }

        if (currentServer.bannedWords.some(w => text.toLowerCase().includes(w))) {
            record.warnings += 1;
            if (record.warnings > 10) {
                record.permaMuted = true;
                sender.modRecords.set(serverId, record);
                await sender.save();
                io.to(channelId).emit('receive_chat_message', { channelId, username: "⚠️ AUTOMOD", text: `💀 @${username} hit strike 11. Perma-muted.` });
                return socket.emit('mod_action', { type: 'perma_mute' });
            } else {
                const lock = new Date(); lock.setMinutes(lock.getMinutes() + 10);
                record.muteUntil = lock;
                sender.modRecords.set(serverId, record);
                await sender.save();
                io.to(channelId).emit('receive_chat_message', { channelId, username: "⚠️ AUTOMOD", text: `🚨 @${username} broke a rule! Strike [${record.warnings}/10]. Muted 10m.` });
                return socket.emit('mod_action', { type: 'temp_mute', minutes: 10 });
            }
        }

        const savedMsg = await Message.create({ channelId, username, text });
        io.to(channelId).emit('receive_chat_message', { ...savedMsg._doc, pfp: sender.pfp });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Engine live on ${PORT}`));
