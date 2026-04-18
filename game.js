// --- PARCHIS GAME LOGIC ---

// 0. LOBBY AND LOGIN STATE
let currentPlayerName = localStorage.getItem('parchis_name') || "";
let currentRoomId = null;

// DOM Elements
const screenLogin = document.getElementById('screen-login');
const screenLobby = document.getElementById('screen-lobby');
const screenWaiting = document.getElementById('screen-waiting-room');
const screenGame = document.getElementById('screen-game');

const inputName = document.getElementById('input-playerName');
const btnLogin = document.getElementById('btn-login');

// Check Initial State
if (currentPlayerName) {
    showLobby();
} else {
    screenLogin.classList.remove('hidden');
}

// Login Logic
inputName.addEventListener('input', (e) => {
    btnLogin.disabled = e.target.value.trim().length === 0;
});

btnLogin.addEventListener('click', () => {
    let name = inputName.value.trim();
    if (name) {
        currentPlayerName = name;
        localStorage.setItem('parchis_name', name);
        screenLogin.classList.add('hidden');
        showLobby();
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('parchis_name');
    currentPlayerName = "";
    inputName.value = "";
    btnLogin.disabled = true;
    screenLobby.classList.add('hidden');
    screenLogin.classList.remove('hidden');
});

// Lobby Logic
function showLobby() {
    screenLobby.classList.remove('hidden');
    document.getElementById('welcome-text').innerText = `Hola, ${currentPlayerName}`;
}

function generateRoomId() {
    return 'SALA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

document.getElementById('btn-create-room').addEventListener('click', () => {
    let pwd = document.getElementById('input-createPassword').value;
    currentRoomId = generateRoomId();
    enterWaitingRoom(currentRoomId, true);
});

document.getElementById('btn-join-room').addEventListener('click', () => {
    let roomId = document.getElementById('input-joinRoomId').value.trim().toUpperCase();
    let pwd = document.getElementById('input-joinPassword').value;
    
    if (roomId.length === 0) {
        alert('Ingresa el ID de la sala');
        return;
    }
    
    // Aquí es donde iría la lógica de verificación por contraseña usando Firebase.
    // Como es visual por ahora, simplemente aceptamos y entramos como locales.
    currentRoomId = roomId;
    enterWaitingRoom(currentRoomId, false);
});

let roomPlayers = []; // e.g. ['red', 'green']
const ALL_COLORS = ['red', 'green', 'yellow', 'blue'];

function enterWaitingRoom(roomId, isHost) {
    screenLobby.classList.add('hidden');
    screenWaiting.classList.remove('hidden');
    document.getElementById('waiting-room-title').innerText = `Sala: ${roomId}`;
    
    // Add Host to first slot
    roomPlayers = ['red']; 
    updateWaitingRoomUI();
}

function updateWaitingRoomUI() {
    ALL_COLORS.forEach((color, idx) => {
        let slotEl = document.getElementById(`slot-${color}`);
        let nameEl = slotEl.querySelector('.slot-name');
        
        if (idx < roomPlayers.length) {
            slotEl.classList.add('occupied');
            if (idx === 0) nameEl.innerText = `${currentPlayerName} (Tú)`;
            else nameEl.innerText = `Amigo ${idx + 1} (Local)`;
        } else {
            slotEl.classList.remove('occupied');
            nameEl.innerText = `Esperando...`;
        }
    });
    
    let btnStart = document.getElementById('btn-start-match');
    btnStart.disabled = roomPlayers.length < 2;
    
    let btnAdd = document.getElementById('btn-add-local');
    btnAdd.disabled = roomPlayers.length >= 4;
}

document.getElementById('btn-add-local').addEventListener('click', () => {
    if (roomPlayers.length < 4) {
        roomPlayers.push(ALL_COLORS[roomPlayers.length]);
        updateWaitingRoomUI();
    }
});

document.getElementById('btn-start-match').addEventListener('click', () => {
    screenWaiting.classList.add('hidden');
    screenGame.classList.remove('hidden');
    document.getElementById('current-room-badge').innerText = `Sala: ${currentRoomId}`;
    initGame(roomPlayers);
});

// 1. BOARD MAPPING
const BOARD_SIZE = 19;
const pathCoords = [];

// Generate the 68 perimeter tiles exactly as planned (Clockwise around)
// Top arm right side
for (let r = 1; r <= 8; r++) pathCoords.push([r, 11]);
// Right arm top side
for (let c = 12; c <= 19; c++) pathCoords.push([9, c]);
// Right arm tip
pathCoords.push([10, 19]);
// Right arm bottom side
for (let c = 19; c >= 12; c--) pathCoords.push([11, c]);
// Bottom arm right side
for (let r = 12; r <= 19; r++) pathCoords.push([r, 11]);
// Bottom arm tip
pathCoords.push([19, 10]);
// Bottom arm left side
for (let r = 19; r >= 12; r--) pathCoords.push([r, 9]);
// Left arm bottom side
for (let c = 8; c >= 1; c--) pathCoords.push([11, c]);
// Left arm tip
pathCoords.push([10, 1]);
// Left arm top side
for (let c = 1; c <= 8; c++) pathCoords.push([9, c]);
// Top arm left side
for (let r = 8; r >= 1; r--) pathCoords.push([r, 9]);
// Top arm tip
pathCoords.push([1, 10]);

// Stairs Map (7 tiles each path into the center)
const stairsCoords = {
    'green': [], // Green is Top Right Home? Wait, Green used to be Top Right in my CSS. Let's make it consistent!
    'yellow': [],
    'blue': [],
    'red': []
};
// RED HOME = Top Left. Path = Left Arm, stairs on Left Arm (Rows 10, Cols 2-8).
for(let c=2; c<=8; c++) stairsCoords['red'].push([10, c]);
// GREEN HOME = Top Right. Path = Top Arm, stairs on Top Arm (Rows 2-8, Col 10).
for(let r=2; r<=8; r++) stairsCoords['green'].push([r, 10]);
// YELLOW HOME = Bottom Right. Path = Right Arm, stairs on Right Arm (Row 10, Cols 18-12).
for(let c=18; c>=12; c--) stairsCoords['yellow'].push([10, c]);
// BLUE HOME = Bottom Left. Path = Bottom Arm, stairs on Bottom Arm (Rows 18-12, Col 10).
for(let r=18; r>=12; r--) stairsCoords['blue'].push([r, 10]);

const START_INDEX = { 'green': 4, 'yellow': 21, 'blue': 38, 'red': 55 };
const ENTRANCE_INDEX = { 'green': 67, 'yellow': 16, 'blue': 33, 'red': 50 }; 

const homeSpots = {
    'red': [[3,3], [3,6], [6,3], [6,6]],      // Top-Left
    'green': [[3,14], [3,17], [6,14], [6,17]], // Top-Right
    'yellow': [[14,14], [14,17], [17,14], [17,17]], // Bottom-Right
    'blue': [[14,3], [14,6], [17,3], [17,6]] // Bottom-Left
};

const PIECES_PER_PLAYER = 4;
let PLAYERS = ['red', 'green', 'yellow', 'blue']; // Default, gets overwritten by initGame

let consecutiveSixes = 0;
let lastMovedPawnId = null;

// Safe squares: start squares, pre-starts and T-intersections
const SAFE_SQUARES = [4, 11, 16, 21, 28, 33, 38, 45, 50, 55, 62, 67];

let turnIndex = 0;
let diceValue = null;
let diceRolled = false;
let extraTurn = false;

let gameState = [];

const boardEl = document.getElementById('board');
const pawntopiaEl = document.getElementById('pawntopia');

function drawBoardCells() {
    boardEl.innerHTML = '';
    
    // Draw cells map
    for (let r = 1; r <= BOARD_SIZE; r++) {
        for (let c = 1; c <= BOARD_SIZE; c++) {
            let div = document.createElement('div');
            div.className = 'cell';
            
            // Homes area
            if (r <= 8 && c <= 8) { 
                if(r===1 && c===1) {
                    div.classList.add('home-red');
                    div.style.gridColumn = '1 / 9';
                    div.style.gridRow = '1 / 9';
                    boardEl.appendChild(div);
                }
            }
            else if (r <= 8 && c >= 12) { 
                if(r===1 && c===12) {
                    div.classList.add('home-green');
                    div.style.gridColumn = '12 / 20';
                    div.style.gridRow = '1 / 9';
                    boardEl.appendChild(div);
                }
            }
            else if (r >= 12 && c >= 12) { 
                if(r===12 && c===12) {
                    div.classList.add('home-yellow');
                    div.style.gridColumn = '12 / 20';
                    div.style.gridRow = '12 / 20';
                    boardEl.appendChild(div);
                }
            }
            else if (r >= 12 && c <= 8) { 
                if(r===12 && c===1) {
                    div.classList.add('home-blue');
                    div.style.gridColumn = '1 / 9';
                    div.style.gridRow = '12 / 20';
                    boardEl.appendChild(div);
                }
            }
            // Center Area
            else if (r >= 9 && r <= 11 && c >= 9 && c <= 11) {
                if (r === 9 && c === 9) {
                    div.classList.add('center');
                    div.style.gridColumn = "9 / 12";
                    div.style.gridRow = "9 / 12";
                    boardEl.appendChild(div);
                }
            } 
            else {
                // Must be Path or Stairs
                div.style.gridRow = r;
                div.style.gridColumn = c;
                
                let pathIdx = pathCoords.findIndex(pos => pos[0] === r && pos[1] === c);
                if (pathIdx !== -1) {
                    div.setAttribute('data-id', pathIdx);
                    if (SAFE_SQUARES.includes(pathIdx)) div.classList.add('safe');
                    
                    if (pathIdx === START_INDEX['red']) div.classList.add('start-red');
                    if (pathIdx === START_INDEX['green']) div.classList.add('start-green');
                    if (pathIdx === START_INDEX['yellow']) div.classList.add('start-yellow');
                    if (pathIdx === START_INDEX['blue']) div.classList.add('start-blue');
                    boardEl.appendChild(div);
                } else {
                    let stairAdded = false;
                    Object.keys(stairsCoords).forEach(color => {
                        let stepIdx = stairsCoords[color].findIndex(pos => pos[0]===r && pos[1]===c);
                        if (stepIdx !== -1) {
                            div.classList.add(`path-${color}`);
                            div.classList.add('stairway');
                            boardEl.appendChild(div);
                            stairAdded = true;
                        }
                    });
                    
                    // Failsafe for any empty spots (though mathematically shouldn't exist in our cross)
                    if (!stairAdded) {
                        div.style.visibility = 'hidden';
                        boardEl.appendChild(div);
                    }
                }
            }
        }
    }

    // Append inner dots for Homes
    createHome('red');
    createHome('green');
    createHome('yellow');
    createHome('blue');
}

function createHome(color) {
    let homeDiv = boardEl.querySelector(`.home-${color}`);
    if(!homeDiv) return;
    let inner = document.createElement('div');
    inner.className = 'home-inner';
    for(let i=0; i<4; i++){
        let spot = document.createElement('div');
        spot.className = 'home-spot';
        inner.appendChild(spot);
    }
    homeDiv.appendChild(inner);
}

function initGame(activePlayers) {
    PLAYERS = activePlayers || ['red', 'green', 'yellow', 'blue'];
    drawBoardCells();
    gameState = [];
    PLAYERS.forEach(color => {
        for (let i=0; i<PIECES_PER_PLAYER; i++) {
            gameState.push({
                id: `${color}-${i}`,
                color: color,
                pieceIdx: i,
                isHome: true,
                isMeta: false,
                pathIndex: null, 
                stairIndex: null
            });
        }
    });
    renderPawns();
    updateUI();
}

function renderPawns() {
    pawntopiaEl.innerHTML = '';
    
    let occupancy = {}; 

    gameState.forEach(pawn => {
        if (!pawn.isMeta) {
            let r, c;
            if (pawn.isHome) {
                let spot = homeSpots[pawn.color][pawn.pieceIdx];
                r = spot[0]; c = spot[1];
            } else if (pawn.stairIndex !== null) {
                let spot = stairsCoords[pawn.color][pawn.stairIndex];
                r = spot[0]; c = spot[1];
            } else {
                let spot = pathCoords[pawn.pathIndex];
                r = spot[0]; c = spot[1];
            }
            
            let key = `${r},${c}`;
            if (!occupancy[key]) occupancy[key] = [];
            occupancy[key].push({ id: pawn.id, isHome: pawn.isHome });
        }
    });

    gameState.forEach(pawn => {
        if (pawn.isMeta) return;

        let pawnEl = document.createElement('div');
        pawnEl.className = `pawn bg-${pawn.color}`;
        pawnEl.id = `pawn-${pawn.id}`;
        
        let r, c;
        if (pawn.isHome) {
            let spot = homeSpots[pawn.color][pawn.pieceIdx];
            r = spot[0]; c = spot[1];
        } else if (pawn.stairIndex !== null) {
            let spot = stairsCoords[pawn.color][pawn.stairIndex];
            r = spot[0]; c = spot[1];
        } else {
            let spot = pathCoords[pawn.pathIndex];
            r = spot[0]; c = spot[1];
        }

        pawnEl.style.gridRow = r;
        pawnEl.style.gridColumn = c;

        // Visual offset if multiple pawns on same square
        let occ = occupancy[`${r},${c}`];
        if (occ.length > 1 && !pawn.isHome) {
            // Find its index among the pawns on this square
            let idx = occ.findIndex(o => o.id === pawn.id);
            // Arrange them in a mini 2x2 grid offset
            let offsetX = idx % 2 === 0 ? -12 : 12;
            let offsetY = idx < 2 ? -12 : 12;
            
            if (idx === 0) {
                offsetX = -10; offsetY = -10;
            } else if (idx === 1) {
                offsetX = 10; offsetY = 10;
            }
        }

        if (diceRolled && pawn.color === PLAYERS[turnIndex]) {
            if (isValidMove(pawn, diceValue)) {
                pawnEl.classList.add('selectable');
                pawnEl.onclick = () => handlePawnClick(pawn);
            }
        }

        pawntopiaEl.appendChild(pawnEl);
    });
}

document.getElementById('btn-roll').addEventListener('click', () => {
    if (diceRolled) return;
    
    // Hide UI cards for non-active players beforehand? Handled in UI
    
    const dice = document.getElementById('dice');
    document.getElementById('dice-container').classList.add('visible');
    dice.classList.add('rolling');
    
    setTimeout(() => {
        dice.classList.remove('rolling');
        diceValue = Math.floor(Math.random() * 6) + 1;
        
        let rotX = 0, rotY = 0;
        if(diceValue===1) { rotX=0; rotY=0; }
        if(diceValue===2) { rotX=0; rotY=-90; }
        if(diceValue===3) { rotX=0; rotY=-180; }
        if(diceValue===4) { rotX=0; rotY=90; }
        if(diceValue===5) { rotX=-90; rotY=0; }
        if(diceValue===6) { rotX=90; rotY=0; }
        
        dice.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(-30px)`;
        diceRolled = true;
        
        if (diceValue === 6) {
            consecutiveSixes++;
        } else {
            consecutiveSixes = 0;
        }
        
        if (consecutiveSixes === 3) {
            document.getElementById('status-message').innerText = `¡Tres seises seguidos! Ficha a casa.`;
            consecutiveSixes = 0;
            let lastPawn = gameState.find(p => p.id === lastMovedPawnId);
            if (lastPawn && !lastPawn.isMeta && lastPawn.stairIndex === null && !lastPawn.isHome) {
                lastPawn.isHome = true;
                lastPawn.pathIndex = null;
                lastPawn.stairIndex = null;
            }
            renderPawns();
            setTimeout(() => {
                extraTurn = false;
                turnIndex = (turnIndex + 1) % PLAYERS.length;
                nextTurn();
            }, 2000);
            return; 
        }
        
        let possibleMoves = gameState.filter(p => p.color === PLAYERS[turnIndex] && isValidMove(p, diceValue));
        
        if (possibleMoves.length === 0) {
            document.getElementById('status-message').innerText = `No se puede mover. Turno de ${PLAYERS[(turnIndex + 1) % PLAYERS.length].toUpperCase()}.`;
            setTimeout(() => {
                extraTurn = false; // Turn skips entirely on impossible move
                turnIndex = (turnIndex + 1) % PLAYERS.length;
                nextTurn();
            }, 2000);
        } else {
            document.getElementById('status-message').innerText = `¡Es ${diceValue}! Selecciona una ficha.`;
            renderPawns();
        }

    }, 800);
});

function isValidMove(pawn, steps) {
    if (pawn.isMeta) return false;
    
    if (pawn.isHome) {
        if (steps !== 5) return false;
        
        let pawnsOnStart = gameState.filter(p => !p.isHome && p.pathIndex === START_INDEX[pawn.color]);
        if (pawnsOnStart.length >= 2) {
            let myPawnsThere = pawnsOnStart.filter(p => p.color === pawn.color);
            if (myPawnsThere.length === 2) return false; // Bloqueado por propias fichas
        }
        return true;
    }
    
    let currentIdx = pawn.pathIndex;
    let sIdx = pawn.stairIndex;
    
    for (let i = 0; i < steps; i++) {
        if (sIdx === null) {
            if (currentIdx === ENTRANCE_INDEX[pawn.color]) {
                sIdx = 0;
            } else {
                let nextIdx = (currentIdx + 1) % 68;
                let pawnsAhead = gameState.filter(p => !p.isHome && p.pathIndex === nextIdx);
                if (pawnsAhead.length >= 2 && i < steps - 1) {
                    return false; // Barrera infranqueable
                }
                currentIdx = nextIdx;
            }
        } else {
            sIdx++;
        }
    }
    
    if (sIdx !== null) {
        if (sIdx === 7) return true; 
        if (sIdx > 7) return false; // Overshoot prevent fatal crash
    } else {
        let pawnsOnFinal = gameState.filter(p => !p.isHome && p.pathIndex === currentIdx);
        if (pawnsOnFinal.length >= 2) return false; // Casilla de caída bloqueada
    }
    
    return true; 
}

function handlePawnClick(pawn) {
    if (!diceRolled || pawn.color !== PLAYERS[turnIndex]) return;
    if (!isValidMove(pawn, diceValue)) return;

    lastMovedPawnId = pawn.id; // Record for 3 sixes rule

    if (pawn.isHome) {
        pawn.isHome = false;
        pawn.pathIndex = START_INDEX[pawn.color];
        checkCaptureOrMove(pawn);
    } else {
        let currentIdx = pawn.pathIndex;
        let sIdx = pawn.stairIndex;
        
        for (let i = 0; i < diceValue; i++) {
            if (sIdx === null) {
                if (currentIdx === ENTRANCE_INDEX[pawn.color]) {
                    sIdx = 0;
                } else {
                    currentIdx = (currentIdx + 1) % 68;
                }
            } else {
                sIdx++;
            }
        }
        
        pawn.pathIndex = sIdx === null ? currentIdx : null;
        pawn.stairIndex = sIdx;
        
        if (sIdx === 7) {
            pawn.isMeta = true;
            pawn.stairIndex = null;
        }

        checkCaptureOrMove(pawn);
    }
}

function checkCaptureOrMove(movingPawn) {
    if (!movingPawn.isMeta && movingPawn.pathIndex !== null) {
        let sameSquare = gameState.filter(p => !p.isHome && p.pathIndex === movingPawn.pathIndex && p.id !== movingPawn.id);
        
        // Destrucción en Salida
        if (movingPawn.pathIndex === START_INDEX[movingPawn.color] && sameSquare.length === 2) {
            let opponent = sameSquare.find(p => p.color !== movingPawn.color);
            if (opponent) {
                opponent.isHome = true;
                opponent.pathIndex = null;
                opponent.stairIndex = null;
                extraTurn = true; 
            }
        }
        // Destrucción normal en casilla vulnerable
        else if (!SAFE_SQUARES.includes(movingPawn.pathIndex)) {
            let opponents = sameSquare.filter(p => p.color !== movingPawn.color);
            opponents.forEach(target => {
                target.isHome = true;
                target.pathIndex = null;
                target.stairIndex = null;
                extraTurn = true;
            });
        }
    }

    if (diceValue === 6) extraTurn = true;
    if (movingPawn.isMeta) extraTurn = true; // Premio extra

    finalizeMove();
}

function finalizeMove() {
    renderPawns();
    
    let myPawns = gameState.filter(p => p.color === PLAYERS[turnIndex]);
    if (myPawns.every(p => p.isMeta)) {
        showWinModal(PLAYERS[turnIndex]);
        return;
    }

    setTimeout(() => {
        if (!extraTurn) turnIndex = (turnIndex + 1) % PLAYERS.length;
        nextTurn();
    }, 600);
}

function nextTurn() {
    diceRolled = false;
    diceValue = null;
    extraTurn = false;
    
    document.getElementById('dice-container').classList.remove('visible');
    
    updateUI();
    renderPawns();
}

function updateUI() {
    let cp = PLAYERS[turnIndex];
    document.getElementById('status-message').innerText = `Turno del ${cp.toUpperCase()}`;
    let dot = document.getElementById('active-color-dot');
    if(dot) dot.className = `active-color-dot bg-${cp}`;
    
    // Update player cards visibility
    ['red', 'green', 'yellow', 'blue'].forEach(color => {
         let card = document.getElementById(`card-${color}`);
         if (card) {
             if (!PLAYERS.includes(color)) {
                 card.style.display = 'none';
                 return;
             }
             card.style.display = 'flex';
             if (color === cp) card.classList.add('active');
             else card.classList.remove('active');
             
             let metaCount = gameState.filter(p => p.color === color && p.isMeta).length;
             document.getElementById(`meta-${color}`).innerText = metaCount;
         }
    });

    let btn = document.getElementById('btn-roll');
    if(btn) btn.style.boxShadow = `0 4px 15px var(--clr-${cp})`;
}

function showWinModal(winnerColor) {
    let overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    let title = document.getElementById('modal-title');
    title.innerText = `¡Victoria del jugador ${winnerColor.toUpperCase()}!`;
    title.style.color = `var(--clr-${winnerColor})`;
}

document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    initGame(PLAYERS);
});

// Remove immediate init, it's called by startGame() now.
// initGame();
