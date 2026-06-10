const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const router = express.Router();

const User = mongoose.model('User');
const ChatServer = mongoose.model('ChatServer');
const Message = mongoose.model('Message');

// Auth System
router.post('/auth', async (req, res) => {
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

// Force-Join Global Server Route
router.post('/api/servers/join-global', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
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
router.get('/api/servers/my', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findOne({ username: req.session.user });
    const servers = await ChatServer.find({ _id: { $in: user.servers } });
    res.json(servers);
});

// Get Public Discover Servers
router.get('/api/servers/discover', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    res.json(await ChatServer.find({ isPrivate: false }));
});

// Create Server Workspace
router.post('/api/servers/create', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { name, isPrivate, accessCode } = req.body;
    const newServer = await ChatServer.create({
        name: name.trim(),
        owner: req.session.user,
        isPrivate,
        accessCode: isPrivate ? accessCode.trim() : "",
        channels: [{ name: 'lounge', isReadOnly: false }]
    });
    await User.updateOne({ username: req.session.user }, { $addToSet: { servers: newServer._id.toString() } });
    res.json(newServer);
});

// Join Server via Access Code
router.post('/api/servers/join-code', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { code } = req.body;
    const srv = await ChatServer.findOne({ accessCode: code.trim() });
    if (!srv) return res.json({ success: false, message: "Invalid access code pattern." });
    await User.updateOne({ username: req.session.user }, { $addToSet: { servers: srv._id.toString() } });
    res.json({ success: true, server: srv });
});

// Add Custom Room Channel
router.post('/api/channels/create', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { serverId, roomName, isReadOnly } = req.body;
    const srv = await ChatServer.findById(serverId);
    if (srv.owner !== req.session.user) return res.status(403).json({ error: "Only admins can add rooms." });
    const cleanRoomName = roomName.trim().toLowerCase().replace(/\s+/g, '-');
    await ChatServer.findByIdAndUpdate(serverId, { $push: { channels: { name: cleanRoomName, isReadOnly } } });
    res.json({ success: true });
});

// Configure AutoMod Settings
router.post('/api/servers/automod', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { serverId, words } = req.body;
    const srv = await ChatServer.findById(serverId);
    if (srv.owner !== req.session.user) return res.status(403).json({ error: "Unauthorized adjustments." });
    srv.bannedWords = words.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    await srv.save();
    res.json({ success: true, bannedWords: srv.bannedWords });
});

// Fetch Message Logs
router.get('/api/messages/:channelId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    res.json(await Message.find({ channelId: req.params.channelId }).sort({ timestamp: 1 }).limit(50));
});

// Profile Management Endpoints
router.post('/api/profile/pfp', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findOneAndUpdate({ username: req.session.user }, { pfp: req.body.pfp }, { new: true });
    res.json({ success: true, pfp: user.pfp });
});

router.get('/api/user/pfp/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    res.json({ pfp: user ? user.pfp : "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel" });
});

module.exports = router;