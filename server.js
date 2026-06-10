// 1. TOP: Imports (Added HTTP and Socket.io)
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app); // Wrap Express app in HTTP server
const io = new Server(server);         // Connect Socket.io to HTTP server

// 2. MIDDLE: Connect to DB
mongoose.connect('mongodb+srv://sweetcafw:BLACKPINK%40LISA@cluster0.oxbhatm.mongodb.net/?appName=Cluster0');

// 3. MIDDLE: Define Schemas & Models (Upgraded for Discord Structure)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// New Schema to store chat history
const messageSchema = new mongoose.Schema({
    channelId: { type: String, required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// New Schema to keep track of servers and group chats
const serverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: String, required: true },
    channels: { type: Array, default: ['general', 'gaming'] } // Default channels inside server
});
const ChatServer = mongoose.model('ChatServer', serverSchema);

// 4. BOTTOM: Setup app and routes
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false
}));

// 5. Authentication Route (Handles Login & Signup)
app.post('/auth', async (req, res) => {
    const { type, username, password } = req.body;

    if (type === 'signup') {
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.create({ username, password: hashedPassword });
            res.json({ success: true });
        } catch (err) {
            res.json({ success: false, message: "Username taken!" });
        }
    } else {
        const user = await User.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = username; // Logs you in
            res.json({ success: true, username });
        } else {
            res.json({ success: false, message: "Invalid credentials" });
        }
    }
});

// 6. Discord API Routes: Get & Create Servers / Load Messages
app.get('/api/servers', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const servers = await ChatServer.find({});
    res.json(servers);
});

app.post('/api/servers', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { name } = req.body;
    const newServer = await ChatServer.create({ name, owner: req.session.user });
    res.json(newServer);
});

app.get('/api/messages/:channelId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    // Fetch last 50 messages from history for this channel
    const messages = await Message.find({ channelId: req.params.channelId }).sort({ timestamp: 1 }).limit(50);
    res.json(messages);
});

// Admin Command Route (Modified for chat clearing instead of inventory)
app.post('/admin-command', async (req, res) => {
    const { command } = req.body;
    if (req.session.user !== 'sweetcafw') {
        return res.status(403).json({ success: false, message: "Nice try!" });
    }

    const parts = command.split(' ');
    if (parts[0] === '/clearchannel') {
        await Message.deleteMany({ channelId: parts[1] });
        io.to(parts[1]).emit('channel_cleared'); // Tell everyone in the room to clear screens
        res.json({ success: true });
    }
});

// 7. REAL-TIME PLATFORM INFRASTRUCTURE (Socket.io)
io.on('connection', (socket) => {
    console.log('User connected to chat grid:', socket.id);

    // When a user selects a channel/GC, put them into a socket room
    socket.on('join_channel', async (channelId) => {
        socket.join(channelId);
        console.log(`User mapped onto channel room: ${channelId}`);
    });

    // Handle a live incoming message sent by a user
    socket.on('send_chat_message', async (data) => {
        const { channelId, username, text } = data;

        // Save it permanently to MongoDB history
        const savedMessage = await Message.create({ channelId, username, text });

        // Instantly transmit the message package to everyone actively sitting in that channel
        io.to(channelId).emit('receive_chat_message', savedMessage);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected from chat grid');
    });
});

// CRITICAL ADJUSTMENT: Must listen via server, not app!
server.listen(3000, () => console.log('Discord Core Server running on port 3000'));
