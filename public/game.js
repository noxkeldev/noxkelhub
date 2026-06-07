// --- 1. THE CITY DICTIONARY (Grid spacing coordinates) ---
const TILE_TYPES = {
    '.': { name: 'grass_plains',  indexX: 0,  indexY: 0,  solid: false }, // Plains for building
    'R': { name: 'asphalt_road',  indexX: 6,  indexY: 0,  solid: false }, 
    'W': { name: 'city_wall',     indexX: 12, indexY: 0,  solid: true  }, // Pre-built city walls
    'O': { name: 'office_orange', indexX: 12, indexY: 5,  solid: true  }, 
    'B': { name: 'bunker_wall',   indexX: 12, indexY: 7,  solid: true  }, // Used for player structures
    'T': { name: 'city_tree',     indexX: 12, indexY: 9,  solid: true  }
};

// --- 2. THE GIANT CITY MAP (16 rows x 40 columns) ---
// S = Player Spawn Point (Safest spot, no building allowed here)
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
    "W............._RRRR_..................W",
    "W...[PLAINS]....RRRR......[PLAINS].....W",
    "W...............RRRR...................W",
    "W................RRRR...................W",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
];

// --- 3. CORE GLOBAL SETTINGS ---
let spawnX = 100;
let spawnY = 100;

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
        initGame();
    } else {
        alert("Failed to authenticate!");
    }
}

function initGame() {
    const config = {
        type: Phaser.AUTO,
        width: 1280, // Made it wider to view your massive city map better
        height: 720,
        parent: 'phaser-game',
        physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
        scene: { preload, create, update }
    };
    new Phaser.Game(config);
}

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.spritesheet('tileset', 'assets/tileset.png', { frameWidth: 32, frameHeight: 32 });
}

function create() {
    // Groups for different map elements
    this.solids = this.physics.add.staticGroup();
    this.ground = this.add.group();
    this.playerBunkers = this.physics.add.staticGroup(); // Tracks player built walls

    const texture = this.textures.get('tileset');
    const imageWidth = texture.getSourceImage().width;
    const tilesPerRow = Math.floor(imageWidth / 32);

    // Render the Giant Map
    for (let row = 0; row < mapLayout.length; row++) {
        for (let col = 0; col < mapLayout[row].length; col++) {
            let char = mapLayout[row][col];
            
            // Set dynamic spawn position dynamically based on 'S' placement
            if (char === 'S') {
                spawnX = col * 32;
                spawnY = row * 32;
                char = '.'; // Treat ground underneath spawn as grass
            }

            let tileConfig = TILE_TYPES[char] || TILE_TYPES['.']; 
            let x = col * 32;
            let y = row * 32;
            let frameID = (tileConfig.indexY * tilesPerRow) + tileConfig.indexX;

            if (tileConfig.solid) {
                let obj = this.solids.create(x, y, 'tileset', frameID);
                obj.refreshBody();
            } else {
                this.ground.create(x, y, 'tileset', frameID);
            }
        }
    }

    // Spawn the player at the safety layout coordinate
    this.player = this.physics.add.sprite(spawnX, spawnY, 'player');
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // Set up world colliders
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.playerBunkers);

    // --- BUNKER BUILDING MECHANIC ---
    // Press 'B' key to drop a brown bunker block right where your character stands
    this.buildKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    
    // Setup manual stuck button bypass logic linked to your system UI
    window.teleportToSpawn = () => {
        this.player.setPosition(spawnX, spawnY);
    };
}

function update() {
    const speed = 250;
    this.player.setVelocity(0);
    
    if (this.cursors.left.isDown) this.player.setVelocityX(-speed);
    if (this.cursors.right.isDown) this.player.setVelocityX(speed);
    if (this.cursors.up.isDown) this.player.setVelocityY(-speed);
    if (this.cursors.down.isDown) this.player.setVelocityY(speed);

    // Drop bunker block checking
    if (Phaser.Input.Keyboard.JustDown(this.buildKey)) {
        // Snap the coordinates perfectly to the grid layout system
        let gridX = Math.floor(this.player.x / 32) * 32;
        let gridY = Math.floor(this.player.y / 32) * 32;

        // Calculate bunker sheet index position profile
        const texture = this.textures.get('tileset');
        const tilesPerRow = Math.floor(texture.getSourceImage().width / 32);
        let bunkerFrameID = (TILE_TYPES['B'].indexY * tilesPerRow) + TILE_TYPES['B'].indexX;

        // Create the damageable bunker item block
        let bunkerWall = this.playerBunkers.create(gridX, gridY, 'tileset', bunkerFrameID);
        bunkerWall.refreshBody();
        
        // Define building structure asset baseline health configuration details
        bunkerWall.health = 100;
        bunkerWall.healthBar = this.add.graphics();
        drawHealthBar(bunkerWall.healthBar, gridX - 16, gridY - 24, bunkerWall.health);

        // SYSTEM TEST CODE: Simulates damage when clicking on a player built wall directly 
        bunkerWall.setInteractive();
        bunkerWall.on('pointerdown', () => {
            bunkerWall.health -= 25; // Take damage per strike
            if (bunkerWall.health <= 0) {
                bunkerWall.healthBar.destroy();
                bunkerWall.destroy();
            } else {
                drawHealthBar(bunkerWall.healthBar, gridX - 16, gridY - 24, bunkerWall.health);
            }
        });
    }
}

// Utility drawing handler configuration layout settings profile details mapping
function drawHealthBar(graphics, x, y, health) {
    graphics.clear();
    graphics.fillStyle(0xff0000); // Red background
    graphics.fillRect(x, y, 32, 5);
    graphics.fillStyle(0x00ff00); // Green current health tracking display
    graphics.fillRect(x, y, (health / 100) * 32, 5);
}
