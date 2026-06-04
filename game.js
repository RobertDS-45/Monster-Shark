// Game variables
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const missedElement = document.getElementById('missed');
const gameOverElement = document.getElementById('gameOver');

// Game state
let score = 0;
let missed = 0;
const maxMissed = 100;
let isGameOver = false;
let isPaused = false;
let running = true;
let loopActive = false;
let audioPrimed = false;

// Game objects
const player = {
    x: 255,
    y: 310,
    width: 90,
    height: 90,
    speed: 12
};

const fish = {
    x: Math.random() * (canvas.width - 40),
    y: Math.random() * (canvas.height - 200),
    width: 40,
    height: 40,
    speed: 8
};

// Load images
const playerImg = new Image();
const fishImg = new Image();
const backgroundImg = new Image();

playerImg.src = 'assets/shark.png';
fishImg.src = 'assets/fish.png';
backgroundImg.src = 'assets/background.png';

// Sound effects (using Web Audio API)
let audioContext;
let catchSound, gameoverSound;
let musicGain;
let musicTicker = null;
let musicPlaying = false;
let musicDesired = false;
let musicWasPlayingBeforePause = false;

// Initialize audio context
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Create catch sound (beep)
    catchSound = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    };
    
    // Create game over sound (lower beep)
    gameoverSound = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    };
}

const musicPattern = [
    { freq: 330, dur: 0.32 },
    { freq: 392, dur: 0.32 },
    { freq: 440, dur: 0.32 },
    { freq: 392, dur: 0.32 },
    { freq: 330, dur: 0.32 },
    { freq: 294, dur: 0.32 },
    { freq: 262, dur: 0.32 },
    { freq: 330, dur: 0.32 },
    { freq: 330, dur: 0.32 },
    { freq: 392, dur: 0.32 },
    { freq: 440, dur: 0.32 },
    { freq: 392, dur: 0.32 },
    { freq: 330, dur: 0.32 },
    { freq: 294, dur: 0.32 },
    { freq: 262, dur: 0.32 },
    { freq: 294, dur: 0.32 }
];
let musicStep = 0;

function initMusic() {
    initAudio();
    if (!musicGain) {
        musicGain = audioContext.createGain();
        musicGain.gain.value = 0.18;
        musicGain.connect(audioContext.destination);
    }
}

function createMusicTone(frequency, duration = 0.35) {
    const main = audioContext.createOscillator();
    const mainGain = audioContext.createGain();
    main.type = 'triangle';
    main.frequency.value = frequency;
    mainGain.gain.value = 0.14;
    main.connect(mainGain);
    mainGain.connect(musicGain);
    main.start(audioContext.currentTime);
    main.stop(audioContext.currentTime + duration);

    const harmony = audioContext.createOscillator();
    const harmonyGain = audioContext.createGain();
    harmony.type = 'sine';
    harmony.frequency.value = frequency * 0.5;
    harmonyGain.gain.value = 0.08;
    harmony.connect(harmonyGain);
    harmonyGain.connect(musicGain);
    harmony.start(audioContext.currentTime);
    harmony.stop(audioContext.currentTime + duration);
}

function playMusicStep() {
    if (!audioContext) return;
    const note = musicPattern[musicStep % musicPattern.length];
    createMusicTone(note.freq, note.dur);
    musicStep += 1;
}

function primeAudio() {
    if (audioPrimed) return;
    initAudio();
    initMusic();
    audioPrimed = true;
}

function startMusic() {
    primeAudio();
    if (musicTicker) return;
    musicDesired = true;
    playMusicStep();
    musicTicker = setInterval(playMusicStep, 420);
    musicPlaying = true;
    updateMusicButtons();
}

function pauseMusic() {
    if (musicTicker) {
        clearInterval(musicTicker);
        musicTicker = null;
    }
    musicPlaying = false;
    updateMusicButtons();
}

function stopMusic() {
    if (musicTicker) {
        clearInterval(musicTicker);
        musicTicker = null;
    }
    musicPlaying = false;
    musicDesired = false;
    musicStep = 0;
    updateMusicButtons();
}

function updateMusicButtons() {
    const toggleMusicBtn = document.getElementById('toggleMusic');
    if (toggleMusicBtn) {
        toggleMusicBtn.textContent = musicPlaying ? 'Pause Music' : 'Play Music';
    }
}

// Input handling
const keys = {};
const mobileControls = {
    left: false,
    right: false,
    up: false,
    down: false
};

const mobileControlsElement = document.getElementById('mobileControls');
const toggleMusicBtn = document.getElementById('toggleMusic');
const stopMusicBtn = document.getElementById('stopMusic');
const pauseGameBtn = document.getElementById('pauseGame');
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

function setupMobileControls() {
    if (!mobileControlsElement) {
        return;
    }

    // Only attach touch handlers on real touch devices.
    if (!isTouchDevice) {
        // Let CSS keep the controls hidden on desktop; no inline styles.
        return;
    }

    const buttons = mobileControlsElement.querySelectorAll('.control-btn');

    buttons.forEach((button) => {
        const direction = button.dataset.dir;

        const setControl = (value) => {
            mobileControls[direction] = value;
        };

        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            setControl(true);
        });

        button.addEventListener('pointerup', () => setControl(false));
        button.addEventListener('pointercancel', () => setControl(false));
        button.addEventListener('pointerleave', () => setControl(false));
    });
}

const baseWidth = 600;
const baseHeight = 400;
const aspectRatio = baseWidth / baseHeight;

function resizeGameCanvas() {
    const maxWidth = Math.min(window.innerWidth - 40, 760);
    const maxHeight = window.innerHeight - 160;
    let width = maxWidth;
    let height = Math.round(width / aspectRatio);

    if (height > maxHeight) {
        height = maxHeight;
        width = Math.round(height * aspectRatio);
    }

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
}

window.addEventListener('resize', resizeGameCanvas);
resizeGameCanvas();

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (isGameOver && e.key.toLowerCase() === 'r') {
        resetGame();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

if (toggleMusicBtn) {
    toggleMusicBtn.addEventListener('click', () => {
        if (musicPlaying) {
            musicDesired = false;
            pauseMusic();
        } else {
            musicDesired = true;
            startMusic();
        }
    });
}

if (stopMusicBtn) {
    stopMusicBtn.addEventListener('click', stopMusic);
}

if (pauseGameBtn) {
    pauseGameBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseGameBtn.textContent = isPaused ? 'Resume Game' : 'Pause Game';

        if (isPaused) {
            musicWasPlayingBeforePause = musicPlaying;
            if (musicPlaying) {
                pauseMusic();
            }
        } else {
            if (!isGameOver && musicWasPlayingBeforePause && musicDesired) {
                startMusic();
            }
            musicWasPlayingBeforePause = false;
            ensureLoop();
        }
    });
}

updateMusicButtons();
setupMobileControls();


function resetGame() {
    score = 0;
    missed = 0;
    isGameOver = false;
    isPaused = false;
    player.x = 255;
    player.y = 310;
    fish.x = Math.random() * (canvas.width - 40);
    fish.y = Math.random() * (canvas.height - 200);
    gameOverElement.style.display = 'none';
    pauseGameBtn.textContent = 'Pause Game';
    updateUI();
    ensureLoop();
}

function updatePlayer() {
    if ((keys['ArrowLeft'] || mobileControls.left) && player.x > 0) {
        player.x -= player.speed;
    }
    if ((keys['ArrowRight'] || mobileControls.right) && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
    if ((keys['ArrowUp'] || mobileControls.up) && player.y > 0) {
        player.y -= player.speed;
    }
    if ((keys['ArrowDown'] || mobileControls.down) && player.y < canvas.height - player.height) {
        player.y += player.speed;
    }
}

function updateFish() {
    fish.x += fish.speed;
    if (fish.x > canvas.width) {
        fish.x = 0;
        fish.y = Math.random() * (canvas.height - fish.height);
        missed++;
        updateUI();
    }
}

function checkCollision() {
    // Define mouth area (left side of shark)
    const mouthWidth = player.width / 6;
    const mouthHeight = player.height / 5;
    const mouthX = player.x - 2;
    const mouthY = player.y + player.height / 2 - 10;
    
    // Check if fish center is in mouth area
    if (fish.x + fish.width / 2 > mouthX && 
        fish.x + fish.width / 2 < mouthX + mouthWidth &&
        fish.y + fish.height / 2 > mouthY && 
        fish.y + fish.height / 2 < mouthY + mouthHeight) {
        
        score++;
        fish.x = 0;
        fish.y = Math.random() * (canvas.height - fish.height);
        catchSound();
        updateUI();
    }
}

function updateUI() {
    scoreElement.textContent = score;
    missedElement.textContent = `${missed} / ${maxMissed}`;
    
    if (missed >= maxMissed && !isGameOver) {
        isGameOver = true;
        gameoverSound();
        gameOverElement.style.display = 'block';
    }
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
    
    // Draw player (shark)
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
    
    // Draw fish
    ctx.drawImage(fishImg, fish.x, fish.y, fish.width, fish.height);
}

function gameLoop() {
    if (!running) return;

    if (isPaused || isGameOver) {
        draw();
        loopActive = false;
        return;
    }

    updatePlayer();
    updateFish();
    checkCollision();
    draw();
    loopActive = true;
    requestAnimationFrame(gameLoop);
}

function ensureLoop() {
    if (!loopActive && running && !isPaused && !isGameOver) {
        loopActive = true;
        requestAnimationFrame(gameLoop);
    }
}

// Start game when images are loaded
let imagesLoaded = 0;
const totalImages = 3;

function imageLoaded() {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
        initAudio();
        gameLoop();
    }
}

playerImg.onload = imageLoaded;
fishImg.onload = imageLoaded;
backgroundImg.onload = imageLoaded;

// Handle image loading errors
playerImg.onerror = () => {
    console.log('Player image failed to load, using placeholder');
    // Create a simple shark shape as fallback
    playerImg.width = 90;
    playerImg.height = 90;
    const canvas = document.createElement('canvas');
    canvas.width = 90;
    canvas.height = 90;
    const ctx = canvas.createContext('2d');
    
    // Draw simple shark shape
    ctx.fillStyle = '#2F4F4F';
    ctx.fillRect(0, 0, 90, 90);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(10, 20, 20, 10); // eye
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(5, 40, 30, 10); // mouth
    
    playerImg.src = canvas.toDataURL();
    imageLoaded();
};

fishImg.onerror = () => {
    console.log('Fish image failed to load, using placeholder');
    // Create a simple fish shape as fallback
    fishImg.width = 40;
    fishImg.height = 40;
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.createContext('2d');
    
    // Draw simple fish shape
    ctx.fillStyle = '#FFA500';
    ctx.fillRect(0, 0, 40, 40);
    ctx.fillStyle = '#000000';
    ctx.fillRect(5, 10, 5, 5); // eye
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(30, 15, 10, 10); // tail
    
    fishImg.src = canvas.toDataURL();
    imageLoaded();
};

backgroundImg.onerror = () => {
    console.log('Background image failed to load, using gradient');
    // Create a gradient background as fallback
    backgroundImg.width = canvas.width;
    backgroundImg.height = canvas.height;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.width;
    canvas.height = canvas.height;
    const ctx = canvas.createContext('2d');
    
    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98FB98');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    backgroundImg.src = canvas.toDataURL();
    imageLoaded();
};
