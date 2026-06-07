const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();

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
    if (req.session.user !== 'YOUR_ADMIN_NAME') return res.status(403).send("Nice try!");

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
