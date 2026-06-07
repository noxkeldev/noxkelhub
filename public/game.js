// Keep your existing auth function
async function sendAuth(type) {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const res = await fetch('/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, username, password })
    });

    const data = await res.json();
    if (data.success) {
        document.getElementById('auth-box').style.display = 'none';
        document.getElementById('game-ui').style.display = 'block';
        initGame(); // Only start the game engine AFTER successful login
    } else {
        alert("Failed to authenticate!");
    }
}

// Initialize Phaser only when login is successful
function initGame() {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'phaser-game',
        physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
        scene: { preload: preload, create: create, update: update }
    };
    new Phaser.Game(config);
}

function preload() {
    this.load.image('player', 'assets/player.png');
}

function create() {
    this.player = this.physics.add.sprite(400, 300, 'player');
    this.cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    // Movement logic
    const speed = 200;
    this.player.setVelocity(0);
    if (this.cursors.left.isDown) this.player.setVelocityX(-speed);
    if (this.cursors.right.isDown) this.player.setVelocityX(speed);
    if (this.cursors.up.isDown) this.player.setVelocityY(-speed);
    if (this.cursors.down.isDown) this.player.setVelocityY(speed);
}

// Keep your admin command listener
window.addEventListener('keydown', async (e) => {
    if (e.key === '/') {
        const cmd = prompt("Enter Admin Command:");
        if (cmd) {
            const res = await fetch('/admin-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
            });
            const data = await res.json();
            alert(data.success ? "Command Executed!" : "Failed!");
        }
    }
});
