const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect('mongodb+srv://sweetcafw:BLACKPINK%40LISA@cluster0.oxbhatm.mongodb.net/?appName=Cluster0');

// DATABASE SCHEMAS DEFINITION
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pfp: { type: String, default: "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel" },
    servers: { type: Array, default: [] },
    modRecords: { type: Map, of: Object, default: {} }
});
const User = mongoose.model('User', userSchema);

const serverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: String, required: true },
    isPrivate: { type: Boolean, default: false },
    accessCode: { type: String, default: "" },
    bannedWords: { type: Array, default: [] },
    channels: [{ name: { type: String, required: true }, isReadOnly: { type: Boolean, default: false } }]
});
const ChatServer = mongoose.model('ChatServer', serverSchema);

const messageSchema = new mongoose.Schema({
    channelId: { type: String, required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'super-secret-key', resave: false, saveUninitialized: false }));

// Link externalized endpoints router file
const apiRoutes = require('./route');
app.use('/', apiRoutes);

// REAL-TIME WEBSOCKET MODERATION LOGIC
io.on('connection', (socket) => {
    socket.on('join_channel', (channelId) => { socket.join(channelId); });

    socket.on('send_chat_message', async (data) => {
        const { serverId, channelId, channelName, username, text } = data;
        const lowerText = text.toLowerCase();

        const currentServer = await ChatServer.findById(serverId);
        const targetChannel = currentServer.channels.find(c => c.name === channelName);
        
        if (targetChannel && targetChannel.isReadOnly && currentServer.owner !== username) {
            return socket.emit('mod_action', { type: 'error', text: "Transmission denied. This room is a Notice Board!" });
        }

        const sender = await User.findOne({ username });
        let record = sender.modRecords.get(serverId) || { warnings: 0, muteUntil: null, permaMuted: false };

        if (record.permaMuted) {
            return socket.emit('mod_action', { type: 'error', text: "Transmission blocked. You are permanently muted here." });
        }

        if (record.muteUntil && new Date() < new Date(record.muteUntil)) {
            const timeLeft = Math.ceil((new Date(record.muteUntil) - new Date()) / 1000 / 60);
            return socket.emit('mod_action', { type: 'error', text: `Transmission blocked. Muted for: ${timeLeft} mins.` });
        }

        const wordTriggered = currentServer.bannedWords.some(w => lowerText.includes(w));
        if (wordTriggered) {
            record.warnings += 1;

            if (record.warnings > 10) {
                record.permaMuted = true;
                sender.modRecords.set(serverId, record);
                await sender.save();

                io.to(channelId).emit('receive_chat_message', {
                    channelId, username: "⚠️ NOXKEL-BOT",
                    text: `💀 PERMANENT LOCKOUT: @${username} triggered AutoMod for the 11th time. Muted permanently.`,
                    timestamp: new Date()
                });
                return socket.emit('mod_action', { type: 'perma_mute' });
            } else {
                const lockTime = new Date();
                lockTime.setMinutes(lockTime.getMinutes() + 10);
                record.muteUntil = lockTime;
                
                sender.modRecords.set(serverId, record);
                await sender.save();

                io.to(channelId).emit('receive_chat_message', {
                    channelId, username: "⚠️ NOXKEL-BOT",
                    text: `🚨 AUTOMOD: @${username} broke a rule! Strike [${record.warnings}/10]. Muted 10m.`,
                    timestamp: new Date()
                });
                return socket.emit('mod_action', { type: 'temp_mute', minutes: 10 });
            }
        }

        const savedMsg = await Message.create({ channelId, username, text });
        io.to(channelId).emit('receive_chat_message', { ...savedMsg._doc, pfp: sender.pfp });
    });
});

server.listen(3000, () => console.log('Noxkel Engine listening on 3000'));
