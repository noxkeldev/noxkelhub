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
// 1. SCHEMAS MATRIX (ALIGNED & LOCKED)
// ==========================================
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pfp: { type: String, default: "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel" },
    servers: { type: Array, default: [] },
    modRecords: { type: Map, of: Object, default: {} },
    pronouns: { type: String, default: "Not Specified" },
    age: { type: Number, default: null },
    bio: { type: String, default: "No bio written yet." },
    datingPartner: { type: String, default: "" },
    friends: { type: Array, default: [] },          
    friendRequests: { type: Array, default: [] }    
}));

const ChatServer = mongoose.models.ChatServer || mongoose.model('ChatServer', new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: String, required: true },
    admins: { type: Array, default: [] }, 
    isPrivate: { type: Boolean, default: false },
    accessCode: { type: String, default: "" },
    bannedWords: { type: Array, default: [] },
    // Explicitly assigning schema types to arrays to enforce internal subdocument _id persistence
    channels: [{
        name: { type: String, required: true },
        isReadOnly: { type: Boolean, default: false }
    }],
    abadabaActive: { type: Boolean, default: false },
    originalNamesBackup: { type: Map, of: String, default: {} } 
}));

const Message = mongoose.models.Message || mongoose.model('Message', new mongoose.Schema({
    serverId: { type: String, required: true, default: "global" }, // Enforced server isolation block
    channelId: { type: String, required: true }, 
    username: { type: String, required: true },
    text: { type: String, required: true },
    imageUrl: { type: String, default: "" },      
    isEdited: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// SESSION ENGINE STORAGE PROTOCOLS
// ==========================================
app.use(session({ 
    secret: 'super-secret-key', 
    resave: true,                
    saveUninitialized: true,     
    cookie: { maxAge: 24 * 60 * 60 * 1000 } 
}));

// ==========================================
// 2. BACKEND ROUTING API CORE
// ==========================================

app.get('/api/auth/check', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ loggedIn: true, username: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

app.post('/auth', async (req, res) => {
    const { type, username, password } = req.body;
    if (type === 'signup') {
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.create({ username, password: hashedPassword });
            req.session.user = username;
            req.session.save(); 
            res.json({ success: true, isNewUser: true });
        } catch (err) { res.json({ success: false, message: "Username taken!" }); }
    } else {
        const user = await User.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = username;
            req.session.save(); 
            res.json({ success: true, isNewUser: false });
        } else { res.json({ success: false, message: "Invalid credentials" }); }
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.post('/api/user/settings', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { pronouns, age, bio } = req.body;
    await User.findOneAndUpdate(
        { username: req.session.user },
        { pronouns, age: age ? parseInt(age) : null, bio }
    );
    res.json({ success: true });
});

app.get('/api/user/profile/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "User missing" });
    
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
        datingPartner: user.datingPartner,
        friends: user.friends || [],
        friendRequests: user.friendRequests || [], 
        pendingRequests: user.friendRequests || [],
        servers: user.servers || [] 
    });
});

app.get('/api/discover/servers', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const publicServers = await ChatServer.find({ isPrivate: false });
    res.json(publicServers);
});

app.delete('/api/servers/:serverId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const srv = await ChatServer.findById(req.params.serverId);
    if (!srv || srv.owner !== req.session.user) return res.status(403).json({ error: "Owner clearance only." });
    
    await ChatServer.findByIdAndDelete(req.params.serverId);
    res.json({ success: true });
});

// 🔥 RESTORED FUNCTIONALITY: PER-SERVER ROOM SECTOR TERMINATION ROUTE
app.delete('/api/channels/:serverId/:channelName', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    
    try {
        const srv = await ChatServer.findById(req.params.serverId);
        if (!srv) return res.status(404).json({ success: false, message: "Target workspace metadata empty." });
        
        if (srv.owner !== req.session.user) {
            return res.status(403).json({ error: "ACCESS DENIED: Engineering clearance error. Owner permissions only." });
        }

        await ChatServer.findByIdAndUpdate(req.params.serverId, {
            $pull: { channels: { name: req.params.channelName.toLowerCase() } }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal room cleanup array cycle crash." });
    }
});

app.post('/api/channels/create', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { serverId, channelName, isReadOnly } = req.body;

    try {
        const srv = await ChatServer.findById(serverId);
        if (!srv) return res.status(404).json({ success: false, message: "Server not found." });

        if (srv.owner !== req.session.user) {
            return res.status(403).json({ success: false, message: "ACCESS DENIED: Engineering clearance error." });
        }

        const channelExists = srv.channels.some(c => c.name === channelName.toLowerCase());
        if (channelExists) return res.status(400).json({ success: false, message: "Target space fingerprint already established." });

        await ChatServer.findByIdAndUpdate(serverId, {
            $addToSet: { channels: { name: channelName.toLowerCase(), isReadOnly: !!isReadOnly } }
        });

        res.json({ success: true, message: "Channel successfully injected." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal creation cluster crash." });
    }
});

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
    io.emit('incoming_date_packet', { sender: req.session.user, target: targetUser });
    res.json({ success: true });
});

app.post('/api/social/cancel-date', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { targetUser } = req.body;
    try {
        await User.updateOne({ username: targetUser }, { $pull: { friendRequests: req.session.user } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: "Internal structural rollback error." });
    }
});

app.post('/api/social/accept-date', async (req, res) => {
    const { targetUser } = req.body;
    await User.updateOne({ username: req.session.user }, { datingPartner: targetUser });
    await User.updateOne({ username: targetUser }, { datingPartner: req.session.user });
    res.json({ success: true });
});

app.post('/api/servers/join-global', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        let globalSrv = await ChatServer.findOne({ name: 'Global Network' });
        if (!globalSrv) {
            globalSrv = await ChatServer.create({
                name: 'Global Network', owner: 'sweetcafw', isPrivate: false,
                channels: [{ name: 'general', isReadOnly: false }, { name: 'announcements', isReadOnly: true }]
            });
        } else if (globalSrv.owner !== 'sweetcafw') {
            globalSrv.owner = 'sweetcafw';
            await globalSrv.save();
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

app.get('/api/messages/:serverId/:channelId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    res.json(await Message.find({ serverId: req.params.serverId, channelId: req.params.channelId }).sort({ timestamp: 1 }).limit(50));
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
// 3. SOCKET TRANSMISSION MOTOR (UPDATED)
// ==========================================
io.on('connection', (socket) => {
    
    socket.on('join_channel', (roomUniqueSignature) => { 
        const currentRooms = Array.from(socket.rooms);
        currentRooms.forEach(rm => {
            if (rm !== socket.id) socket.leave(rm);
        });
        socket.join(roomUniqueSignature); 
    });

    socket.on('send_chat_message', async (data) => {
        let { serverId, channelId, channelName, username, text, imageUrl } = data;
        const currentServer = await ChatServer.findById(serverId);
        
        if (currentServer) {
            if (currentServer.abadabaActive && username !== "⚠️ AUTOMOD" && username !== "📢 SYSTEM ANNOUNCEMENT") {
                username = "abadaba";
            }

            const isOwner = currentServer.owner === data.username;
            const isAdmin = currentServer.admins.includes(data.username) || isOwner;

            const targetChannel = currentServer.channels.find(c => c.name === channelName);
            if (targetChannel && targetChannel.isReadOnly && !isAdmin) {
                return socket.emit('mod_action', { type: 'error', text: "Notice-only room restriction." });
            }

            if (!isAdmin && currentServer.bannedWords.some(w => text.toLowerCase().includes(w))) {
                return socket.emit('mod_action', { type: 'temp_mute', minutes: 10 });
            }
        }

        const senderInfo = await User.findOne({ username: data.username });
        const activePfp = senderInfo ? senderInfo.pfp : "https://api.dicebear.com/7.x/bottts/svg?seed=Noxkel";

        const savedMsg = await Message.create({ serverId, channelId, username, text, imageUrl });
        
        io.to(channelId).emit('receive_chat_message', { 
            ...savedMsg._doc, 
            pfp: activePfp 
        });
    });

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
