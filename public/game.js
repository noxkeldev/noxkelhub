// --- 1. THE DICTIONARY (Assign symbols to rows/columns on your sheet) ---
// indexX = column number (starting at 0 from left)
// indexY = row number (starting at 0 from top)
const TILE_TYPES = {
    '.': { name: 'grass',        indexX: 0,  indexY: 0,  solid: false },
    'R': { name: 'road_pavement',indexX: 6,  indexY: 0,  solid: false },
    'W': { name: 'red_wall',     indexX: 12, indexY: 0,  solid: true  },
    'O': { name: 'orange_wall',  indexX: 12, indexY: 5,  solid: true  },
    'B': { name: 'brown_wall',   indexX: 12, indexY: 7,  solid: true  },
    'T': { name: 'green_tree',   indexX: 12, indexY: 9,  solid: true  },
    't': { name: 'orange_tree',  indexX: 12, indexY: 13, solid: true  },
    'C': { name: 'red_car',      indexX: 11, indexY: 18, solid: true  }
};

// --- 2. YOUR VISUAL TOWN MAP ---
// Now you can mix and match all the different colors!
const mapLayout = [
    "WWWWWWWWWWWWWWWW",
    "W..............W",
    "W..T...O...t...W",
    "W..R...O.......W",
    "W..R...BBBB....W",
    "W..R........C..W",
    "WWWWWWWWWWWWWWWW"
];

// --- 3. PHASER ENGINE CONFIG ---
function initGame() {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'phaser-game',
        physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
        scene: { preload, create, update }
    };
    new Phaser.Game(config);
}

function preload() {
    this.load.image('player', 'assets/player.png');
    
    // IMPORTANT: Check if your tiles are 16x16 or 32x32. 
    // Change these numbers to match the pixel size of one square!
    this.load.spritesheet('tileset', 'assets/tileset.png', { 
        frameWidth: 32, 
        frameHeight: 32 
    });
}

function create() {
    this.player = this.physics.add.sprite(100, 100, 'player');
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // Groups for layout handling
    this.solids = this.physics.add.staticGroup();
    this.ground = this.add.group();

    // Calculate how many tiles are in one row of the image file
    // Phaser needs this to convert our X/Y coordinates into a single ID number
    const texture = this.textures.get('tileset');
    const imageWidth = texture.getSourceImage().width;
    const tilesPerRow = Math.floor(imageWidth / 32); // Change 32 if frame size is different

    for (let row = 0; row < mapLayout.length; row++) {
        for (let col = 0; col < mapLayout[row].length; col++) {
            let char = mapLayout[row][col];
            let tileConfig = TILE_TYPES[char];

            if (tileConfig) {
                let x = col * 32;
                let y = row * 32;

                // Math trick: Convert column and row of the image into a single frame ID
                let frameID = (tileConfig.indexY * tilesPerRow) + tileConfig.indexX;

                if (tileConfig.solid) {
                    let obj = this.solids.create(x, y, 'tileset', frameID);
                    obj.refreshBody();
                } else {
                    this.ground.create(x, y, 'tileset', frameID);
                }
            }
        }
    }
    
    this.physics.add.collider(this.player, this.solids);
}

function update() {
    const speed = 200;
    this.player.setVelocity(0);
    if (this.cursors.left.isDown) this.player.setVelocityX(-speed);
    if (this.cursors.right.isDown) this.player.setVelocityX(speed);
    if (this.cursors.up.isDown) this.player.setVelocityY(-speed);
    if (this.cursors.down.isDown) this.player.setVelocityY(speed);
}
