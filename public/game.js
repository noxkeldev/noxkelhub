// --- MAP DESIGN CONFIGURATION ---
const TILE_TYPES = {
    '.': { indexX: 0,  indexY: 0,  solid: false }, 
    'R': { indexX: 13, indexY: 28, solid: false }, 
    'W': { indexX: 24, indexY: 0,  solid: true  }, 
    'O': { indexX: 24, indexY: 10, solid: true  }, 
    'B': { indexX: 24, indexY: 14, solid: true  }, 
    'T': { indexX: 24, indexY: 18, solid: true  }  
};

const mapLayout = [
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "W S ............RRRR........................RRRR...........W",
    "W...............RRRR........................RRRR...........W",
    "W....TTTTTT.....RRRR.......OOOOOOOO.........RRRR....TTTT...W",
    "W....T....T.....RRRR.......O......O.........RRRR....T..T...W",
    "W....TTTTTT.....RRRR.......OOOOOOOO.........RRRR....TTTT...W",
    "W...............RRRR........................RRRR...........W",
    "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
    "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
    "W...............RRRR........................RRRR...........W",
    "W...............RRRR........................RRRR...........W",
    "W....OOOOOO.....RRRR........................RRRR...........W",
    "W....O....O.....RRRR........TTTTTTTT........RRRR...........W",
    "W....OOOOOO.....RRRR........T......T........RRRR...........W",
    "W...............RRRR........TTTTTTTT........RRRR...........W",
    "W...............RRRR........................RRRR...........W",
    "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
    "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
    "W...............RRRR........................RRRR...........W",
    "W...............RRRR........................RRRR...........W",
    "W......TTTT.....RRRR........................RRRR...........W",
    "W......T..T.....RRRR........................RRRR...........W",
    "W......TTTT.....RRRR........................RRRR...........W",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
];

let spawnX = 80;
let spawnY = 80;
let phaserEngineInstance = null; 

// ROBLOX-STYLE SESSION RETENTION CORE
window.onload = function() {
    const sessionActive = localStorage.getItem("noxkel_logged_in");
    
    if (sessionActive === "true") {
        document.getElementById('auth-box').style.display = 'none';
        document.getElementById('game-hub').style.display = 'flex';
        tickPlayerCount();
    } else {
        document.getElementById('auth-box').style.display = 'block';
    }
};

function logoutSession() {
    localStorage.removeItem("noxkel_logged_in");
    document.getElementById('game-hub').style.display = 'none';
    document.getElementById('auth-box').style.display = 'block';
}

function tickPlayerCount() {
    let base = 1482;
    let change = Math.floor(Math.random() * 24) - 12;
    let total = base + change;
    if(document.getElementById("live-counter")) {
        document.getElementById("live-counter").innerText = `⚡ NET ONLINE INFRASTRUCTURE: ${total}`;
        document.getElementById("hub-pop").innerText = total;
    }
}
setInterval(tickPlayerCount, 2500);

// API CREDENTIAL HANDLER
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
        localStorage.setItem("noxkel_logged_in", "true");
        
        document.getElementById('auth-box').style.display = 'none';
        document.getElementById('game-hub').style.display = 'flex';
        tickPlayerCount();
    } else {
        alert("Authentication Network Error!");
    }
}

function launchGame() {
    document.getElementById('game-hub').style.display = 'none';
    document.getElementById('game-ui').style.display = 'flex';
    
    if (!phaserEngineInstance) {
        initGameEngine();
    }
}

function initGameEngine() {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 450,
        parent: 'phaser-game',
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false }
        },
        scene: { preload, create, update }
    };
    phaserEngineInstance = new Phaser.Game(config);
}

// FIXED PRELOAD ASSET PATH ROUTING
function preload() {
    // Corrected target directions targeting your case-sensitive MAPS directory structure
    this.load.image('player', 'MAPS/player.png');
    this.load.spritesheet('tileset', 'MAPS/tileset.png', { frameWidth: 16, frameHeight: 16 });
    
    // Note: WEAPONS/ path assets are pinned here mentally to build our firearms systems later!
}

function create() {
    this.solids = this.physics.add.staticGroup();
    this.ground = this.add.group();

    const fixedTilesPerRow = 32; 

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
            
            let frameID = (tileConfig.indexY * fixedTilesPerRow) + tileConfig.indexX;

            if (tileConfig.solid) {
                let block = this.solids.create(x, y, 'tileset', frameID).setOrigin(0,0);
                block.body.setSize(16, 16);
                block.refreshBody();
            } else {
                this.ground.create(x, y, 'tileset', frameID).setOrigin(0,0);
            }
        }
    }

    this.player = this.physics.add.sprite(spawnX, spawnY, 'player').setScale(0.8);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.physics.add.collider(this.player, this.solids);

    this.physics.world.setBounds(0, 0, 960, 384);
    this.cameras.main.setBounds(0, 0, 960, 384);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

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
}
