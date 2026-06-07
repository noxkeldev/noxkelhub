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

app.post('/auth', async (req, res) => {
    const { type, username, password } = req.body;
    
    if (type === 'signup') {
        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({ username, password: hashedPassword });
        res.json({ success: true, message: "Account created!" });
    } else {
        const user = users.find(u => u.username === username);
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = username;
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false });
        }
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
