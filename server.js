// 1. TOP: Always import everything first
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();

// 2. MIDDLE: Connect to DB
mongoose.connect('mongodb+srv://sweetcafw:BLACKPINK%40LISA@cluster0.oxbhatm.mongodb.net/?appName=Cluster0');

// 3. MIDDLE: Define Schema & Model (After mongoose is loaded)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    inventory: { type: Array, default: [] }
});
const User = mongoose.model('User', userSchema);

// 4. BOTTOM: Setup app and routes
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false
}));

app.post('/admin-command', async (req, res) => {
    const { command } = req.body;
    
    // Fixed: 'sweetcafw' is now in quotes!
    if (req.session.user !== 'sweetcafw') {
        return res.status(403).send("Nice try!");
    }

    const parts = command.split(' ');
    
    if (parts[0] === '/give') {
        const target = parts[1];
        const item = parts[2];
        
        await User.updateOne({ username: target }, { $push: { inventory: item } });
        console.log(`Gave ${item} to ${target}`);
        res.json({ success: true });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
