import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, set, onValue, get, update, runTransaction } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-4hZ84MzNLlsfBmXX53QXeqj74QDZsFw",
  authDomain: "parchis-92290.firebaseapp.com",
  databaseURL: "https://parchis-92290-default-rtdb.firebaseio.com",
  projectId: "parchis-92290",
  storageBucket: "parchis-92290.firebasestorage.app",
  messagingSenderId: "656595089260",
  appId: "1:656595089260:web:63570ee01fecb3df03e549"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 0. LOBBY AND LOGIN STATE
// Fetch entire user payload instead of just name
let currentUser = JSON.parse(localStorage.getItem('parchis_auth_user')) || null;
let currentPlayerName = currentUser ? currentUser.displayName : "";
let currentUserId = currentUser ? currentUser.customId : null;
let currentRoomId = null;
let myColor = null;
let gameRef = null;
let isPlaying = false;

// Remove the local simulation button since we are online now
document.getElementById('btn-add-local').style.display = 'none';

// DOM Elements
const screenLogin = document.getElementById('screen-login');
const screenLobby = document.getElementById('screen-lobby');
const screenWaiting = document.getElementById('screen-waiting-room');
const screenGame = document.getElementById('screen-game');

// Auth DOM
const loginContainer = document.getElementById('login-container');
const registerContainer = document.getElementById('register-container');
const authSpinner = document.getElementById('auth-spinner');

const btnGoRegister = document.getElementById('btn-go-register');
const btnGoLogin = document.getElementById('btn-go-login');

btnGoRegister.addEventListener('click', () => {
    loginContainer.style.display = 'none';
    registerContainer.style.display = 'block';
});
btnGoLogin.addEventListener('click', () => {
    registerContainer.style.display = 'none';
    loginContainer.style.display = 'block';
});

// Forms
const inputLoginEmail = document.getElementById('input-login-email');
const inputLoginPassword = document.getElementById('input-login-password');
const btnEmailLogin = document.getElementById('btn-email-login');

const inputRegName = document.getElementById('input-register-name');
const inputRegEmail = document.getElementById('input-register-email');
const inputRegPassword = document.getElementById('input-register-password');
const btnEmailRegister = document.getElementById('btn-email-register');

const btnGoogleLogin = document.getElementById('btn-google-login');
const btnGoogleRegister = document.getElementById('btn-google-register');

const inputRegPasswordConfirm = document.getElementById('input-register-password-confirm');
const btnForgotPassword = document.getElementById('btn-forgot-password');
const btnSwitchAccount = document.getElementById('btn-switch-account');

// URL Parsing for invites
const urlParams = new URLSearchParams(window.location.search);
const inviteRoom = urlParams.get('r');
const invitePwd = urlParams.get('p');

function checkInitialRouting() {
    if (inviteRoom) {
        currentRoomId = inviteRoom;
        enterWaitingRoom(currentRoomId, false, invitePwd ? atob(invitePwd) : null);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        showLobby();
    }
}

// Active Session Listener (Always replaces manual check for security)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // We have a Firebase user, now check if we have their database details
        let userRef = ref(db, 'users/' + user.uid);
        get(userRef).then(snapshot => {
            if (snapshot.exists()) {
                saveLocalAndProceed(snapshot.val());
            } else {
                // User is new but signed in (e.g. Google logic)
                handleAuthSuccess(user);
            }
        });
    } else {
        // No user, ensure login screen is visible
        screenLobby.classList.add('hidden');
        screenLogin.classList.remove('hidden');
    }
});

function showSpinner(show) {
    authSpinner.style.display = show ? 'block' : 'none';
}

btnEmailRegister.addEventListener('click', async () => {
    let name = inputRegName.value.trim();
    let email = inputRegEmail.value.trim();
    let password = inputRegPassword.value;
    let confirm = inputRegPasswordConfirm.value;
    
    if(!name || !email || !password || !confirm) {
        alert("Por favor, completa todos los campos.");
        return;
    }

    if (password !== confirm) {
        alert("Erro: Las contraseñas no coinciden. Por favor, verifica.");
        return;
    }
    
    showSpinner(true);
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        let user = userCred.user;
        await updateProfile(user, { displayName: name }); // Guardar nombre oficialmente en la base de datos de Auth
        handleAuthSuccess(user);
    } catch (error) {
        showSpinner(false);
        if (error.code === 'auth/operation-not-allowed') {
            alert("Error: Debes ir a Firebase Console -> Authentication -> Sign-in Method y HABILITAR 'Correo electrónico/Contraseña'.");
        } else if (error.code === 'auth/weak-password') {
            alert("Error: La contraseña debe tener al menos 6 caracteres.");
        } else if (error.code === 'auth/email-already-in-use') {
            alert("Error: Este correo ya tiene una cuenta. Presiona en 'Inicia Sesión'.");
        } else {
            alert("Error al registrarse: " + error.message);
        }
    }
});

btnEmailLogin.addEventListener('click', async () => {
    let email = inputLoginEmail.value.trim();
    let password = inputLoginPassword.value;
    
    if(!email || !password) {
        alert("Ingresa tu correo y contraseña.");
        return;
    }
    
    showSpinner(true);
    try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        handleAuthSuccess(userCred.user);
    } catch (error) {
        showSpinner(false);
        alert("Error de inicio de sesión: " + error.message);
    }
});

const handleGoogle = async () => {
    showSpinner(true);
    try {
        const result = await signInWithPopup(auth, provider);
        handleAuthSuccess(result.user);
    } catch (error) {
        showSpinner(false);
        if (error.code === 'auth/unauthorized-domain' || error.message.includes('origin')) {
            alert("Aviso de Google: No puedes usar la cuenta de Google abriendo el archivo directamente. Por favor usa 'Crear Cuenta' con correo o levanta un servidor Localhost.");
        } else {
            alert("Error con Google Auth: " + error.message);
        }
    }
};

btnGoogleLogin.addEventListener('click', handleGoogle);
btnGoogleRegister.addEventListener('click', handleGoogle);

btnForgotPassword.addEventListener('click', async () => {
    let email = inputLoginEmail.value.trim();
    if (!email) {
        alert("Por favor, escribe tu correo electrónico primero en el campo de arriba para enviarte el enlace de recuperación.");
        return;
    }
    
    try {
        await sendPasswordResetEmail(auth, email);
        alert("¡Enlace enviado! Revisa tu bandeja de entrada (y la carpeta de spam) para restablecer tu contraseña.");
    } catch (error) {
        alert("Error al enviar correo de recuperación: " + error.message);
    }
});

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
    } else {
        input.type = "password";
    }
}
window.togglePasswordVisibility = togglePasswordVisibility; // Make it global for HTML onclick

function handleAuthSuccess(user) {
    let userRef = ref(db, 'users/' + user.uid);
    get(userRef).then(snapshot => {
        if (snapshot.exists()) {
            let data = snapshot.val();
            saveLocalAndProceed(data);
        } else {
            let counterRef = ref(db, 'global/userCounter');
            runTransaction(counterRef, (currentValue) => {
                if (currentValue === null) return 1001; 
                return currentValue + 1;
            }).then(({ committed, snapshot: counterSnapshot }) => {
                if (committed) {
                    let newId = counterSnapshot.val();
                    let shortName = user.displayName ? user.displayName.split(' ')[0] : "Jugador"; // Primer nombre
                    let fullDisplay = `${shortName} #${newId}`;
                    
                    let newUserObj = {
                        uid: user.uid,
                        rawName: user.displayName || shortName,
                        customId: newId,
                        displayName: fullDisplay
                    };
                    
                    set(userRef, newUserObj);
                    saveLocalAndProceed(newUserObj);
                }
            }).catch(err => {
                console.error("Database Error:", err);
                // Fallback para IDs si falla la BD
                let fallbackId = Math.floor(Math.random() * 9000) + 1000;
                let shortName = user.displayName ? user.displayName.split(' ')[0] : "Jugador";
                let newUserObj = { uid: user.uid, rawName: user.displayName || shortName, customId: fallbackId, displayName: `${shortName} #${fallbackId}` };
                saveLocalAndProceed(newUserObj);
            });
        }
    }).catch(err => {
        console.error("Fetch User Error:", err);
        // Fallback total
        let fallbackId = Math.floor(Math.random() * 9000) + 1000;
        let shortName = user.displayName ? user.displayName.split(' ')[0] : "Jugador";
        let newUserObj = { uid: user.uid, rawName: user.displayName || shortName, customId: fallbackId, displayName: `${shortName} #${fallbackId}` };
        saveLocalAndProceed(newUserObj);
    });
}

function saveLocalAndProceed(userDataObj) {
    currentUser = userDataObj;
    currentPlayerName = userDataObj.displayName;
    currentUserId = userDataObj.customId;
    localStorage.setItem('parchis_auth_user', JSON.stringify(userDataObj));
    
    screenLogin.classList.add('hidden');
    checkInitialRouting();
}

function resetLoginUI() {
    showSpinner(false);
}

document.getElementById('btn-logout').addEventListener('click', () => {
    auth.signOut();
    localStorage.removeItem('parchis_auth_user');
    currentUser = null;
    currentPlayerName = "";
    currentUserId = null;
    resetLoginUI();
    screenLobby.classList.add('hidden');
    screenLogin.classList.remove('hidden');
});

btnSwitchAccount.addEventListener('click', () => {
    auth.signOut();
    localStorage.removeItem('parchis_auth_user');
    currentUser = null;
    currentPlayerName = "";
    currentUserId = null;
    resetLoginUI();
    screenLobby.classList.add('hidden');
    screenLogin.classList.remove('hidden');
});

function showLobby() {
    screenLobby.classList.remove('hidden');
    document.getElementById('welcome-text').innerText = `Hola, ${currentPlayerName}`;
}

function generateRoomId() {
    return 'SALA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

document.getElementById('btn-create-room').addEventListener('click', async () => {
    let pwd = document.getElementById('input-createPassword').value;
    currentRoomId = generateRoomId();
    myColor = 'red';
    
    // Create room in Firebase
    gameRef = ref(db, 'rooms/' + currentRoomId);
    await set(gameRef, {
        status: 'waiting',
        password: pwd,
        players: [{ name: currentPlayerName, color: 'red' }],
        activePlayers: ['red'],
        gameState: [],
        turnIndex: 0,
        diceValue: null,
        diceRolled: false,
        consecutiveSixes: 0,
        lastMovedPawnId: null,
        diceTrigger: 0
    });

    enterWaitingRoom(currentRoomId, true, pwd);
});

document.getElementById('btn-join-room').addEventListener('click', () => {
    let roomId = document.getElementById('input-joinRoomId').value.trim().toUpperCase();
    let pwd = document.getElementById('input-joinPassword').value;
    
    if (roomId.length === 0) {
        alert('Ingresa el ID de la sala');
        return;
    }
    
    currentRoomId = roomId;
    enterWaitingRoom(currentRoomId, false, pwd);
});

let roomPlayers = []; 
const ALL_COLORS = ['red', 'green', 'yellow', 'blue'];

function enterWaitingRoom(roomId, isHost, password) {
    screenLobby.classList.add('hidden');
    screenWaiting.classList.remove('hidden');
    document.getElementById('waiting-room-title').innerText = `Sala: ${roomId}`;
    
    // Generate Invite Link
    let inviteUrl = window.location.origin + window.location.pathname + '?r=' + roomId;
    if (password && password.trim() !== '') {
        inviteUrl += '&p=' + btoa(password);
    }
    document.getElementById('input-invite-link').value = inviteUrl;
    
    gameRef = ref(db, 'rooms/' + roomId);

    if (!isHost) {
        get(gameRef).then(snapshot => {
            if (snapshot.exists()) {
                let data = snapshot.val();
                if (data.status !== 'waiting') {
                    alert('La sala ya arrancó.');
                    window.location.reload();
                    return;
                }
                
                let currentPlayers = data.players || [];
                let alreadyIn = currentPlayers.find(p => p.name === currentPlayerName);
                
                if (alreadyIn) {
                    myColor = alreadyIn.color;
                } else if (currentPlayers.length < 4) {
                    myColor = ALL_COLORS[currentPlayers.length];
                    currentPlayers.push({ name: currentPlayerName, color: myColor });
                    
                    let ap = data.activePlayers || [];
                    ap.push(myColor);
                    
                    update(gameRef, { players: currentPlayers, activePlayers: ap });
                } else {
                    alert('Sala llena');
                    return;
                }
                listenToRoom();
            } else {
                alert('La sala no existe.');
                window.location.reload();
            }
        });
    } else {
        listenToRoom();
    }
}

document.getElementById('btn-copy-link').addEventListener('click', () => {
    let input = document.getElementById('input-invite-link');
    input.select();
    input.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(input.value).then(() => {
        let btn = document.getElementById('btn-copy-link');
        let oldText = btn.innerText;
        btn.innerText = "¡Copiado!";
        setTimeout(() => { btn.innerText = oldText; }, 2000);
    });
});

function updateWaitingRoomUI(playersList) {
    let btnStart = document.getElementById('btn-start-match');
    btnStart.disabled = playersList.length < 2;

    // Solo el Host (Red) puede iniciar la partida
    if (myColor !== 'red') {
        btnStart.style.display = 'none';
    } else {
        btnStart.style.display = 'block';
    }

    ALL_COLORS.forEach((color, idx) => {
        let slotEl = document.getElementById(`slot-${color}`);
        let nameEl = slotEl.querySelector('.slot-name');
        
        let p = playersList.find(pl => pl.color === color);
        if (p) {
            slotEl.classList.add('occupied');
            nameEl.innerText = p.name === currentPlayerName ? `${p.name} (Tú)` : p.name;
        } else {
            slotEl.classList.remove('occupied');
            nameEl.innerText = `Esperando...`;
        }
    });
}

document.getElementById('btn-start-match').addEventListener('click', () => {
    if (myColor === 'red') { // Only host can start
        let startState = [];
        roomPlayers.forEach(color => {
            for (let i=0; i<PIECES_PER_PLAYER; i++) {
                startState.push({
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
        
        update(gameRef, {
            status: 'playing',
            gameState: startState
        });
    }
});

// --- FIREBASE SYNC ENGINE ---
let localDiceTrigger = 0;
let chatMessagesRendered = 0; 
let turnRolledSix = false;

function listenToRoom() {
    onValue(gameRef, (snapshot) => {
        let data = snapshot.val();
        if (!data) return;
        
        if (data.status === 'waiting') {
            roomPlayers = data.activePlayers || [];
            updateWaitingRoomUI(data.players || []);
        } 
        else if (data.status === 'playing') {
            if (!isPlaying) {
                isPlaying = true;
                screenWaiting.classList.add('hidden');
                screenGame.classList.remove('hidden');
                document.getElementById('current-room-badge').innerText = `Sala: ${currentRoomId} (${myColor.toUpperCase()})`;
                PLAYERS = data.activePlayers || [];
                drawBoardCells();
                localDiceTrigger = data.diceTrigger || 0;
            }
            
            gameState = data.gameState || [];
            turnIndex = data.turnIndex;
            diceValues = data.diceValues || [];
            diceRolled = data.diceRolled;
            consecutiveDoubles = data.consecutiveDoubles || 0;
            turnRolledDoubles = data.turnRolledDoubles || false;
            lastMovedPawnId = data.lastMovedPawnId || null;
            PLAYERS = data.activePlayers || [];
            
            if (data.diceTrigger && data.diceTrigger !== localDiceTrigger) {
                localDiceTrigger = data.diceTrigger;
                playDiceAnimation(data.initialDice);
            }
            
            // Render Chat
            if (data.chat) {
                renderChat(data.chat);
            }
            
            updateUI();
            renderPawns();
        }
    });
}

function renderChat(chatObj) {
    let chatBox = document.getElementById('chat-messages');
    let msgs = Object.values(chatObj).sort((a,b) => a.timestamp - b.timestamp);
    
    if (msgs.length > chatMessagesRendered) {
        chatBox.innerHTML = '';
        msgs.forEach(msg => {
            let div = document.createElement('div');
            let isMine = msg.name === currentPlayerName;
            div.className = `chat-msg ${isMine ? 'mine' : ''}`;
            
            let author = document.createElement('div');
            author.className = 'author';
            author.innerText = msg.name;
            
            let text = document.createElement('div');
            text.innerText = msg.text;
            
            div.appendChild(author);
            div.appendChild(text);
            chatBox.appendChild(div);
        });
        chatMessagesRendered = msgs.length;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

document.getElementById('btn-send-chat').addEventListener('click', sendChatMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
    let input = document.getElementById('chat-input');
    let text = input.value.trim();
    if (!text) return;
    
    let msgId = Date.now().toString();
    update(ref(db, `rooms/${currentRoomId}/chat/${msgId}`), {
        name: currentPlayerName,
        text: text,
        timestamp: Date.now()
    });
    
    input.value = '';
}

// 1. BOARD MAPPING
const BOARD_SIZE = 19;
const pathCoords = [];

for (let r = 1; r <= 8; r++) pathCoords.push([r, 11]);
for (let c = 12; c <= 19; c++) pathCoords.push([9, c]);
pathCoords.push([10, 19]);
for (let c = 19; c >= 12; c--) pathCoords.push([11, c]);
for (let r = 12; r <= 19; r++) pathCoords.push([r, 11]);
pathCoords.push([19, 10]);
for (let r = 19; r >= 12; r--) pathCoords.push([r, 9]);
for (let c = 8; c >= 1; c--) pathCoords.push([11, c]);
pathCoords.push([10, 1]);
for (let c = 1; c <= 8; c++) pathCoords.push([9, c]);
for (let r = 8; r >= 1; r--) pathCoords.push([r, 9]);
pathCoords.push([1, 10]);

const stairsCoords = { 'green': [], 'yellow': [], 'blue': [], 'red': [] };
for(let c=2; c<=8; c++) stairsCoords['red'].push([10, c]);
for(let r=2; r<=8; r++) stairsCoords['green'].push([r, 10]);
for(let c=18; c>=12; c--) stairsCoords['yellow'].push([10, c]);
for(let r=18; r>=12; r--) stairsCoords['blue'].push([r, 10]);

const START_INDEX = { 'green': 4, 'yellow': 21, 'blue': 38, 'red': 55 };
const ENTRANCE_INDEX = { 'green': 67, 'yellow': 16, 'blue': 33, 'red': 50 }; 

const homeSpots = {
    'red': [[3,3], [3,6], [6,3], [6,6]], 
    'green': [[3,14], [3,17], [6,14], [6,17]], 
    'yellow': [[14,14], [14,17], [17,14], [17,17]], 
    'blue': [[14,3], [14,6], [17,3], [17,6]] 
};

const PIECES_PER_PLAYER = 4;
let PLAYERS = ['red', 'green', 'yellow', 'blue']; 

let consecutiveDoubles = 0;
let lastMovedPawnId = null;

const SAFE_SQUARES = [4, 11, 16, 21, 28, 33, 38, 45, 50, 55, 62, 67];

let turnIndex = 0;
let diceValues = [];
let diceRolled = false;
let turnRolledDoubles = false;

let gameState = [];

const boardEl = document.getElementById('board');
const pawntopiaEl = document.getElementById('pawntopia');

function drawBoardCells() {
    boardEl.innerHTML = '';
    
    for (let r = 1; r <= BOARD_SIZE; r++) {
        for (let c = 1; c <= BOARD_SIZE; c++) {
            let div = document.createElement('div');
            div.className = 'cell';
            
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
            else if (r >= 9 && r <= 11 && c >= 9 && c <= 11) {
                if (r === 9 && c === 9) {
                    div.classList.add('center');
                    div.style.gridColumn = "9 / 12";
                    div.style.gridRow = "9 / 12";
                    boardEl.appendChild(div);
                }
            } 
            else {
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
                    
                    if (!stairAdded) {
                        div.style.visibility = 'hidden';
                        boardEl.appendChild(div);
                    }
                }
            }
        }
    }

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

function renderPawns() {
    if (!pawntopiaEl) return;
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
        pawnEl.className = `pawn ${pawn.color}`;
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

        let occ = occupancy[`${r},${c}`];
        if (occ && occ.length > 1 && !pawn.isHome) {
            let idx = occ.findIndex(o => o.id === pawn.id);
            let offsetX = idx % 2 === 0 ? -12 : 12;
            let offsetY = idx < 2 ? -12 : 12;
            
            if (idx === 0) {
                offsetX = -10; offsetY = -10;
            } else if (idx === 1) {
                offsetX = 10; offsetY = 10;
            }
            pawnEl.style.transform = `translate(${offsetX}%, ${offsetY}%) scale(0.6)`;
        }

        if (diceRolled && pawn.color === PLAYERS[turnIndex] && pawn.color === myColor) {
            let validMoves = getSelectablePawns(myColor, diceValues);
            let moveObj = validMoves.find(m => m.pawn.id === pawn.id);
            if (moveObj) {
                pawnEl.classList.add('selectable');
                pawnEl.onclick = () => handlePawnClick(pawn, moveObj.uses);
            }
        }

        pawntopiaEl.appendChild(pawnEl);
    });
}

function getValidUses(pawn, dVals) {
    let uses = [];
    
    dVals.forEach((val, idx) => {
        if (isValidMove(pawn, val)) uses.push({ val: val, ids: [idx] });
    });
    
    if (dVals.length === 2) {
        let sum = dVals[0] + dVals[1];
        if (isValidMove(pawn, sum)) uses.push({ val: sum, ids: [0, 1] });
        
        if (pawn.isHome && sum === 5) {
            let pawnsOnStart = gameState.filter(p => !p.isHome && p.stairIndex === null && p.pathIndex === START_INDEX[pawn.color]);
            if (pawnsOnStart.length < 2) uses.push({ val: 5, ids: [0, 1] });
        }
    }
    
    return uses;
}

function getSelectablePawns(color, dVals) {
    let moves = [];
    
    gameState.filter(p => p.color === color).forEach(p => {
        let uses = getValidUses(p, dVals);
        if (uses.length > 0) {
            moves.push({ pawn: p, uses: uses });
        }
    });
    
    let has5 = false;
    let homeMoves = [];
    moves.forEach(m => {
        let use5 = m.uses.find(u => u.val === 5 && m.pawn.isHome);
        if (use5) {
            has5 = true;
            homeMoves.push({ pawn: m.pawn, uses: [use5] }); 
        }
    });
    
    if (has5) {
        return homeMoves;
    }
    
    let has6or7 = dVals.includes(6) || dVals.includes(7);
    let myPathPawns = gameState.filter(p => p.color === color && !p.isHome && p.stairIndex === null);
    let bridgeIdxs = [];
    myPathPawns.forEach(p1 => {
        let count = myPathPawns.filter(p2 => p2.pathIndex === p1.pathIndex).length;
        if (count >= 2 && !bridgeIdxs.includes(p1.pathIndex)) bridgeIdxs.push(p1.pathIndex);
    });
    
    if (has6or7 && bridgeIdxs.length > 0) {
        let bridgeMoves = moves.filter(m => bridgeIdxs.includes(m.pawn.pathIndex));
        if (bridgeMoves.length > 0) {
            return bridgeMoves;
        }
    }
    
    return moves;
}

document.getElementById('btn-roll').addEventListener('click', () => {
    if (diceRolled) return;
    
    if (PLAYERS[turnIndex] !== myColor) {
        alert("¡Aún no es tu turno!");
        return;
    }
    
    let d1 = Math.floor(Math.random() * 6) + 1;
    let d2 = Math.floor(Math.random() * 6) + 1;
    let newTrigger = Date.now();
    
    update(gameRef, {
        initialDice: [d1, d2],
        diceTrigger: newTrigger
    });
});

function playDiceAnimation(valArr) {
    const dice1 = document.getElementById('dice1');
    const dice2 = document.getElementById('dice2');
    const overlay = document.getElementById('dice-overlay');
    
    overlay.classList.add('visible');
    dice1.classList.add('rolling');
    dice2.classList.add('rolling');
    
    setTimeout(() => {
        dice1.classList.remove('rolling');
        dice2.classList.remove('rolling');
        let applyFace = (dEl, val) => {
            let rotX=0, rotY=0;
            if(val===1) { rotX=0; rotY=0; }
            if(val===2) { rotX=0; rotY=-90; }
            if(val===3) { rotX=0; rotY=-180; }
            if(val===4) { rotX=0; rotY=90; }
            if(val===5) { rotX=-90; rotY=0; }
            if(val===6) { rotX=90; rotY=0; }
            dEl.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        };
        applyFace(dice1, valArr[0]);
        applyFace(dice2, valArr[1]);

        setTimeout(() => {
            overlay.classList.remove('visible');
        }, 1000);

        if (PLAYERS[turnIndex] === myColor) {
            let actualValues = [...valArr];
            
            // Regla del 7 si todas salieron
            let myPawnsInHome = gameState.filter(p => p.color === myColor && p.isHome);
            if (myPawnsInHome.length === 0) {
                if (actualValues[0] === 6) actualValues[0] = 7;
                if (actualValues[1] === 6) actualValues[1] = 7;
            }
            
            // Castigo 3er doble
            if (actualValues[0] === actualValues[1]) {
                consecutiveDoubles++;
            } else {
                consecutiveDoubles = 0;
            }
            
            if (consecutiveDoubles === 3) {
                document.getElementById('status-message').innerText = `¡Tres dobles seguidos! Ficha castigada a casa.`;
                let lastPawn = gameState.find(p => p.id === lastMovedPawnId);
                if (lastPawn && lastPawn.color === myColor && lastPawn.stairIndex === null && !lastPawn.isHome && !lastPawn.isMeta) {
                    lastPawn.isHome = true;
                    lastPawn.pathIndex = null;
                }
                setTimeout(() => {
                    update(gameRef, {
                        diceRolled: false,
                        diceValues: [],
                        turnIndex: (turnIndex + 1) % PLAYERS.length,
                        consecutiveDoubles: 0,
                        turnRolledDoubles: false,
                        gameState: gameState 
                    });
                }, 2000);
                return; 
            }
            
            let possibleMoves = getSelectablePawns(myColor, actualValues);
            
            if (possibleMoves.length === 0) {
                document.getElementById('status-message').innerText = `Sin movimientos válidos. Turno perdido.`;
                setTimeout(() => {
                    let nextIdx = (turnIndex + 1) % PLAYERS.length;
                    if (actualValues[0] === actualValues[1]) nextIdx = turnIndex; 
                    
                    update(gameRef, {
                        diceRolled: false,
                        diceValues: [],
                        turnIndex: nextIdx,
                        consecutiveDoubles: consecutiveDoubles,
                        turnRolledDoubles: false
                    });
                }, 2000);
            } else {
                update(gameRef, {
                    diceValues: actualValues,
                    diceRolled: true,
                    consecutiveDoubles: consecutiveDoubles,
                    turnRolledDoubles: (actualValues[0] === actualValues[1])
                });
            }
        }
    }, 800);
}

function isValidMove(pawn, steps) {
    if (pawn.isMeta) return false;
    
    if (pawn.stairIndex !== null) {
        if (pawn.stairIndex + steps > 7) return false; 
    }

    if (pawn.isHome) {
        if (steps !== 5) return false;
        
        let pawnsOnStart = gameState.filter(p => !p.isHome && p.stairIndex === null && p.pathIndex === START_INDEX[pawn.color]);
        if (pawnsOnStart.length >= 2) return false; 
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
                let pawnsAhead = gameState.filter(p => !p.isHome && p.stairIndex === null && p.pathIndex === nextIdx);
                if (pawnsAhead.length >= 2 && i < steps - 1) return false; 
                currentIdx = nextIdx;
            }
        } else {
            sIdx++;
        }
    }
    
    if (sIdx !== null) {
        if (sIdx > 7) return false; 
    } else {
        let pawnsOnFinal = gameState.filter(p => !p.isHome && p.stairIndex === null && p.pathIndex === currentIdx);
        if (pawnsOnFinal.length >= 2) return false; 
    }
    
    return true; 
}

function handlePawnClick(pawn, uses) {
    if (!diceRolled || pawn.color !== myColor) return;
    if (PLAYERS[turnIndex] !== myColor) return; 
    
    let distinctVals = [...new Set(uses.map(u => u.val))].sort((a,b)=>b-a);
    let chosenUse = null;
    
    if (distinctVals.length === 1) {
        chosenUse = uses.find(u => u.val === distinctVals[0]);
    } else {
        let msg = `Opciones de pasos: ${distinctVals.join(' o ')}. \nEscribe el número exacto que deseas usar:`;
        let answer = prompt(msg);
        let parsed = parseInt(answer);
        if (distinctVals.includes(parsed)) {
            chosenUse = uses.find(u => u.val === parsed);
        } else {
            alert("No seleccionaste una opción válida.");
            return;
        }
    }

    lastMovedPawnId = pawn.id; 
    
    let consumedIds = chosenUse.ids;
    let remainingDice = [];
    diceValues.forEach((v, i) => {
        if (!consumedIds.includes(i)) remainingDice.push(v);
    });

    if (pawn.isHome) {
        pawn.isHome = false;
        pawn.pathIndex = START_INDEX[pawn.color];
        checkCaptureOrMove(pawn, remainingDice);
    } else {
        let currentIdx = pawn.pathIndex;
        let sIdx = pawn.stairIndex;
        
        for (let i = 0; i < chosenUse.val; i++) {
            if (sIdx === null) {
                if (currentIdx === ENTRANCE_INDEX[pawn.color]) sIdx = 0;
                else currentIdx = (currentIdx + 1) % 68;
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

        checkCaptureOrMove(pawn, remainingDice);
    }
}

function checkCaptureOrMove(movingPawn, remainingDice) {
    let bonusMove = null;
    
    if (!movingPawn.isMeta && movingPawn.pathIndex !== null) {
        let sameSquare = gameState.filter(p => !p.isHome && p.stairIndex === null && p.pathIndex === movingPawn.pathIndex && p.id !== movingPawn.id);
        
        if (!SAFE_SQUARES.includes(movingPawn.pathIndex) && sameSquare.length > 0) {
            let opponents = sameSquare.filter(p => p.color !== movingPawn.color);
            if (opponents.length > 0) {
                opponents.forEach(target => {
                    target.isHome = true;
                    target.pathIndex = null;
                    target.stairIndex = null;
                });
                bonusMove = 20; 
            }
        }
    }

    if (movingPawn.isMeta) {
        bonusMove = 10;
    }

    if (bonusMove) {
        remainingDice.push(bonusMove);
    }

    finalizeMove(remainingDice, movingPawn.id);
}

function finalizeMove(remainingDice, mpId) {
    let myPawns = gameState.filter(p => p.color === myColor);
    if (myPawns.every(p => p.isMeta)) {
        showWinModal(myColor);
    }

    if (remainingDice.length > 0) {
        let possible = getSelectablePawns(myColor, remainingDice);
        if (possible.length > 0) {
            update(gameRef, {
                diceValues: remainingDice,
                diceRolled: true,
                gameState: gameState,
                lastMovedPawnId: mpId
            });
            return;
        }
    }

    let nextIdx = turnIndex;
    if (!turnRolledDoubles) {
        nextIdx = (turnIndex + 1) % PLAYERS.length;
    }
    
    update(gameRef, {
        gameState: gameState,
        diceRolled: false,
        diceValues: [],
        turnIndex: nextIdx,
        lastMovedPawnId: mpId,
        turnRolledDoubles: false
    });
}


function updateUI() {
    let cp = PLAYERS[turnIndex];
    if (cp) {
        let statusStr = cp === myColor ? `¡Tu Turno!` : `Turno del ${cp.toUpperCase()}`;
        if (diceRolled) statusStr = `¡Usa los pasos: ${diceValues.join(' y ')}!`;
        
        document.getElementById('status-message').innerText = statusStr;
        let dot = document.getElementById('active-color-dot');
        if(dot) dot.className = `active-color-dot bg-${cp}`;
    }
    
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
    if(btn) {
        if(cp === myColor && !diceRolled) {
            btn.style.boxShadow = `0 4px 15px var(--clr-${cp})`;
            btn.disabled = false;
        } else {
            btn.style.boxShadow = `none`;
            btn.disabled = true;
        }
    }
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
    // For online games, resetting might require all players' consent, or just host can restart
    if (myColor === 'red') {
         // Host restarts
         let startState = [];
        PLAYERS.forEach(color => {
            for (let i=0; i<PIECES_PER_PLAYER; i++) {
                startState.push({ id: `${color}-${i}`, color: color, pieceIdx: i, isHome: true, isMeta: false, pathIndex: null, stairIndex: null });
            }
        });
        update(gameRef, {
            gameState: startState,
            turnIndex: 0,
            diceRolled: false,
            lastMovedPawnId: null,
            consecutiveSixes: 0
        });
    } else {
        alert("Solo el Anfitrión (Rojo) puede reiniciar la partida.");
    }
});
