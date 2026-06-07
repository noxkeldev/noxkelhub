// --- 1. TILE DICTIONARY MAPS ---
const TILE_TYPES = {
    '.': { indexX: 0,  indexY: 0,  solid: false }, 
    'R': { indexX: 13, indexY: 28, solid: false }, 
    'W': { indexX: 24, indexY: 0,  solid: true  }, 
    'O': { indexX: 24, indexY: 10, solid: true  }, 
    'B': { indexX: 24, indexY: 14, solid: true  }, 
    'T': { indexX: 24, indexY: 18, solid: true  }  
};

const mapLayout = [
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "W S ............RRRR...................W",
    "W...............RRRR...................W",
    "W....TTTTTT.....RRRR.......OOOOOOOO....W",
    "W....T....T.....RRRR.......O......O....W",
    "W....TTTTTT.....RRRR.......OOOOOOOO....W",
    "W...............RRRR...................W",
    "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
    "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
    "W...............RRRR...................W",
    "W...............RRRR...................W",
    "W...............RRRR...................W",
    "W...............RRRR...................W",
    "W................RRRR...................W",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
];

let spawnX = 50;
let spawnY = 50;

// Step 1: Login succeeds -> Reveal the platform UI Hub
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
        document.getElementById('game-hub').style.display = 'block';
    } else {
        alert("Failed to authenticate!");
    }
}

// Step 2: Click Play -> Hide the hub and start Phaser engine
function pressJoinButton() {
    document.getElementById('game-hub').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    initGame();
}

function initGame() {
    const config = {
        type: Phaser.AUTO,
        width: 800,  
        height: 450, 
        parent: 'phaser-game',
        physics: { 
            default: 'arcade', 
            arcade: { 
                gravity: { y: 0 },
                debug: false // Assures the annoying green boxes are turned OFF
            } 
        },
        scene: { preload, create, update }
    };
    new Phaser.Game(config);
}

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.spritesheet('tileset', 'assets/tileset.png', { frameWidth: 16, frameHeight: 16 });
}

function create() {
    this.solids = this.physics.add.staticGroup();
    this.ground = this.add.group();
    this.playerBunkers = this.physics.add.staticGroup();

    const texture = this.textures.get('tileset');
    const imageWidth = texture.getSourceImage().width;
    const tilesPerRow = Math.floor(imageWidth / 16); 

    for (let row = 0; row < mapLayout.length; row++) {
        for (let col = 0; col < mapLayout[row].length; col++) {
            let char = mapLayout[row][col];
            
            if (char === 'S') {
                spawnX = col * 16;
                spawnY = row * 16;
                char = '.';
            }

            let tileConfig = TILE_TYPES[char] || TILE_TYPES['.']; 
            let x = col * 16;
            let y = row * 16;
            let frameID = (tileConfig.indexY * tilesPerRow) + tileConfig.indexX;

            if (tileConfig.solid) {
                let obj = this.solids.create(x, y, 'tileset', frameID).setOrigin(0,0);
                obj.body.setSize(16, 16); 
                obj.refreshBody();
            } else {
                this.ground.create(x, y, 'tileset', frameID).setOrigin(0,0);
            }
        }
    }

    this.player = this.physics.add.sprite(spawnX, spawnY, 'player').setScale(0.8);
    this.cursors = this.input.keyboard.createCursorKeys();
    
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.playerBunkers);

    this.buildKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    
    window.teleportToSpawn = () => {
        this.player.setPosition(spawnX, spawnY);
    };
}

function update() {
    const speed = 150;
    this.player.setVelocity(0);
    
    if (this.cursors.left.isDown) this.player.setVelocityX(-speed);
    if (this.cursors.right.isDown) this.player.setVelocityX(speed);
    if (this.cursors.up.isDown) this.player.setVelocityY(-speed);
    if (this.cursors.down.isDown) this.player.setVelocityY(speed);

    if (Phaser.Input.Keyboard.JustDown(this.buildKey)) {
        let gridX = Math.floor(this.player.x / 16) * 16;
        let gridY = Math.floor(this.player.y / 16) * 16;

        const texture = this.textures.get('tileset');
        const tilesPerRow = Math.floor(texture.getSourceImage().width / 16);
        let bunkerFrameID = (TILE_TYPES['B'].indexY * tilesPerRow) + TILE_TYPES['B'].indexX;

        let bunkerWall = this.playerBunkers.create(gridX, gridY, 'tileset', bunkerFrameID).setOrigin(0,0);
        bunkerWall.body.setSize(16, 16);
        bunkerWall.refreshBody();
        
        bunkerWall.health = 100;
        bunkerWall.healthBar = this.add.graphics();
        drawHealthBar(bunkerWall.healthBar, gridX, gridY - 8, bunkerWall.health);

        bunkerWall.setInteractive();
        bunkerWall.on('pointerdown', () => {
            bunkerWall.health -= 25;
            if (bunkerWall.health <= 0) {
                bunkerWall.healthBar.destroy();
                bunkerWall.destroy();
            } else {
                drawHealthBar(bunkerWall.healthBar, gridX, gridY - 8, bunkerWall.health);
            }
        });
    }
}

function drawHealthBar(graphics, x, y, health) {
    graphics.clear();
    graphics.fillStyle(0xff0000);
    graphics.fillRect(x, y, 16, 3);
    graphics.fillStyle(0x00ff00);
    graphics.fillRect(x, y, (health / 100) * 16, 3);
}

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
