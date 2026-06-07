// 1. TOP: Always import everything first
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();

// 2. MIDDLE: Connect to DB
mongoose.connect('mongodb+srv://sweetcafw:BLACKPINK%40LISA@cluster0.oxbhatm.mongodb.net/?appName=Cluster0');

// 3. MIDDLE: Define Schema & Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    inventory: { type: Array, default: [] }
});
const User = mongoose.model('User', userSchema);

// 4. BOTTOM: Setup app and routes
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false
}));

// 5. NEW: Authentication Route (Handles Login & Signup)
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
            req.session.user = username; // This logs you in
            res.json({ success: true });
        } else {
            res.json({ success: false, message: "Invalid credentials" });
        }
    }
});

// 6. Admin Command Route
app.post('/admin-command', async (req, res) => {
    const { command } = req.body;
    
    if (req.session.user !== 'sweetcafw') {
        return res.status(403).json({ success: false, message: "Nice try!" });
    }

    const parts = command.split(' ');
    if (parts[0] === '/give') {
        await User.updateOne({ username: parts[1] }, { $push: { inventory: parts[2] } });
        res.json({ success: true });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
