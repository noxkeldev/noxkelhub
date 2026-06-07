// Define the User Schema and Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    inventory: { type: Array, default: [] }
});
const User = mongoose.model('User', userSchema);
const express = require('express');
const mongoose = require('mongoose'); // You NEED this
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();

// CONNECT TO YOUR MONGODB
mongoose.connect('mongodb+srv://sweetcafw:BLACKPINK%40LISA@cluster0.oxbhatm.mongodb.net/?appName=Cluster0');

// DEFINE THE USER MODEL (The database needs to know what a "User" is)
const User = mongoose.model('User', { 
    username: String, 
    password: { type: String, required: true },
    inventory: { type: Array, default: [] } // This holds the stuff you gift
});
app.use(express.json());
app.use(express.static('public'));

app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false
}));

const users = []; // Temporary user storage

app.post('/admin-command', async (req, res) => {
    const { command } = req.body; // e.g., "/give Player1 Sword"
    
    // Check if it's YOU using the command
    if (req.session.user !== sweetcafw) return res.status(403).send("Nice try!");

    const parts = command.split(' '); // ["/give", "Player1", "Sword"]
    
    if (parts[0] === '/give') {
        const target = parts[1]; // "Player1"
        const item = parts[2];   // "Sword"
        
        // AUTOMATED: Update the database directly
        await User.updateOne({ username: target }, { $push: { inventory: item } });
        console.log(`Gave ${item} to ${target}`);
        res.json({ success: true });
    }
});
app.listen(3000, () => console.log('Server running on port 3000'));
