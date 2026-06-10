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
app.post('/api/servers/join-global', async (req, res) => {
    if (!req.session.user) return res.status
