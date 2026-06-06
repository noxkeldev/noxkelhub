const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve the game files from the public folder to the browser
app.use(express.static(path.join(__dirname, 'public')));

// Store all active players online
let players = {};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create a new player profile when someone logs in
    players[socket.id] = {
        x: Math.random() * 600 + 100,
        y: Math.random() * 400 + 100,
        id: socket.id,
        color: `hsl(${Math.random() * 360}, 100%, 60%)`, // Peak neon colors
        name: "Explorer_" + Math.floor(Math.random() * 900 + 100)
    };

    // Send the current list of players to the newly connected player
    socket.emit('currentPlayers', players);

    // Tell all other players that a new explorer has entered the world
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Listen for movement updates from players
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            // Broadcast the updated position to everyone else
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Handle a player disconnecting
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Start the server online
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});
