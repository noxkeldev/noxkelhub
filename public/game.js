// --- MULTI GAME PLATFORM STORAGE SYSTEM ---
const NOXKEL_GAMES = {
    town: {
        title: "Town RPG: Zone Arena",
        desc: "Drop directly into a high-stakes, real-time tactical city combat zone. Scavenge asphalt grid layouts, build heavy brown-brick bunker fortifications dynamically to hold line positions, and control high-density item zones.",
        version: "v0.4.2",
        basePop: 1204,
        mapColor: 0x1a233a
    },
    backrooms: {
        title: "The Backrooms: Levels",
        desc: "An immersive psychological horror escape sandbox. Wander down infinite yellow monochromatic corridors, maintain architectural sanity values, and outrun shadow anomalies hidden inside non-Euclidean structural lines.",
        version: "v1.0.0-Beta",
        basePop: 842,
        mapColor: 0x3a351a
    },
    blox: {
        title: "NoxBlox Infinite Grid",
        desc: "A massive multi-tier high-velocity open arena sandbox experience. Climb competitive server leaderboards, craft massive custom geometry configurations with friends, and unlock high-tier specialized tool kits.",
        version: "v3.1.9",
        basePop: 4119,
        mapColor: 0x1a3a22
    }
};

let currentGameKey = "town";

// Live fluctuating player calculation script matrix
function updateLiveSystemMetrics() {
    let globalTotal = 0;
    for (let key in NOXKEL_GAMES) {
        let fluctuation = Math.floor((Math.random() * 20) - 10);
        let liveCount = Math.max(10, NOXKEL_GAMES[key].basePop + fluctuation);
        globalTotal += liveCount;
        
        let tabPopElement = document.getElementById(`pop-${key}`);
        if(tabPopElement) tabPopElement.innerText = `${liveCount.toLocaleString()} Active`;
        
        if (key === currentGameKey) {
            let statActiveElement = document.getElementById("stat-active");
            if(statActiveElement) statActiveElement.innerText = liveCount.toLocaleString();
        }
    }
    let globalCounterElement = document.getElementById("global-counter");
    if(globalCounterElement) globalCounterElement.innerText = `🌐 NOXKEL SYSTEM TOTAL: ${globalTotal.toLocaleString()} ONLINE PLAYERS`;
}
setInterval(updateLiveSystemMetrics, 2500);

// Switch highlighted item profiling details inside the panel
function switchGame(gameKey) {
    currentGameKey = gameKey;
    const gameData = NOXKEL_GAMES[gameKey];
    
    document.querySelectorAll('.game-tab-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${gameKey}`).classList.add('active');
    
    document.getElementById("display-banner-title").innerText = gameData.title;
    document.getElementById("display-title").innerText = gameData.title;
    document.getElementById("display-desc").innerText = gameData.desc;
    document.getElementById("stat-version").innerText = gameData.version;
    document.getElementById("stat-active").innerText = gameData.basePop;
}

// RESTORE SECURITY AUTH SYSTEM HANDLER
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
        document.getElementById('game-hub').style.display = 'grid';
        updateLiveSystemMetrics();
    } else {
        alert("Failed to authenticate!");
    }
}

function pressJoinButton() {
    document.getElementById('game-hub').style.display = 'none';
    document.getElementById('game-ui').style.display = 'flex';
    document.getElementById('active-game-header').innerText = NOXKEL_GAMES[currentGameKey].title;
    initGame();
}

// --- ENGINE INITIALIZATION CORE ---
function initGame() {
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
    new Phaser.Game(config);
}

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.spritesheet('tileset', 'assets/tileset.png', { frameWidth: 16, frameHeight: 16 });
}

function create() {
    this.solids = this.physics.add.staticGroup();
    this.ground = this.add.group();
    
    // THE GREEN MATRIX KILLER: Draw a clean background based on the selected game
    let currentThemeColor = NOXKEL_GAMES[currentGameKey].mapColor;
    let bgGrid = this.add.graphics();
    bgGrid.fillStyle(currentThemeColor, 1);
    bgGrid.fillRect(0, 0, 800, 450);
    
    // Draw fine structural floor indicator lines
    bgGrid.lineStyle(1, 0xffffff, 0.04);
    for (let x = 0; x < 800; x += 16) { bgGrid.lineBetween(x, 0, x, 450); }
    for (let y = 0; y < 450; y += 16) { bgGrid.lineBetween(0, y, 800, y); }

    // Parse assets layer data safely onto the background grid canvas
    const texture = this.textures.get('tileset');
    const tilesPerRow = Math.floor(texture.getSourceImage().width / 16); 

    // Custom asset placement using actual indexes from your tileset sheet
    // Placed trees (Index Y: 18, X: 24) on the grid safely
    let propPositions = [
        {x: 160, y: 80}, {x: 240, y: 120}, {x: 400, y: 64}, {x: 600, y: 200}
    ];

    let treeFrameID = (18 * tilesPerRow) + 24;
    propPositions.forEach(pos => {
        let element = this.solids.create(pos.x, pos.y, 'tileset', treeFrameID).setOrigin(0,0);
        element.body.setSize(16,16);
        element.refreshBody();
    });

    this.player = this.physics.add.sprite(100, 100, 'player').setScale(0.8);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.physics.add.collider(this.player, this.solids);

    window.teleportToSpawn = () => { this.player.setPosition(100, 100); };
}

function update() {
    const speed = 160;
    this.player.setVelocity(0);
    
    if (this.cursors.left.isDown) this.player.setVelocityX(-speed);
    if (this.cursors.right.isDown) this.player.setVelocityX(speed);
    if (this.cursors.up.isDown) this.player.setVelocityY(-speed);
    if (this.cursors.down.isDown) this.player.setVelocityY(speed);
}
