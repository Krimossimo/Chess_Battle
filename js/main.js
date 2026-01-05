// js/main.js
import { piecesInfo, initialBoardSetup } from './data.js';
import { isMoveSafe, isSquareAttacked, findKing } from './rules.js';
import { initAuthListener, logout } from './auth.js'; 
import { initSocialSystem } from './social.js';
// NOUVEAU : Imports Firestore pour update la partie
import { db, doc, updateDoc, onSnapshot } from './firebase.js';

const boardElement = document.getElementById('chessBoard');
const promoModal = document.getElementById('promotionModal');
const difficultyModal = document.getElementById('difficultyModal');

// HUD
const timerWhiteEl = document.getElementById('timerWhite');
const timerBlackEl = document.getElementById('timerBlack');
const graveyardWhite = document.getElementById('graveyardWhite');
const graveyardBlack = document.getElementById('graveyardBlack');

// BOUTIQUE
const btnShop = document.getElementById('btnShop');
const shopScreen = document.getElementById('shopScreen');
const backFromShop = document.getElementById('backFromShop');
const shopPointsDisplay = document.getElementById('shopPointsDisplay');

// ETAT DU JEU
let selectedSquare = null;
let currentTurn = 'white';
let promotionCallback = null;
let isVsAI = false;
let aiLevel = 'easy';
let currentUserPoints = 0;

// MULTIJOUEUR EN LIGNE (NOUVEAU)
let isOnline = false;
let onlineGameId = null;
let myColor = 'white'; // 'white' ou 'black'
let gameUnsubscribe = null; // Pour couper la connexion quand fini

// TIME
let timeWhite = 600;
let timeBlack = 600;
let timerInterval = null;
let gameActive = false;

// --- INITIALISATION ---
initAuthListener((userData) => {
    updateProfileUI(userData);
    currentUserPoints = userData.points;
    initSocialSystem(userData);
});

// --- FONCTION POUR LANCER LE JEU EN LIGNE (Exportée pour social.js) ---
export function startOnlineGame(gameId, color) {
    console.log(`Lancement partie en ligne ! ID: ${gameId}, Je suis: ${color}`);
    
    isOnline = true;
    onlineGameId = gameId;
    myColor = color;
    isVsAI = false; // Pas d'IA

    // Setup interface
    createBoard();
    
    // Si je suis Noir, je retourne le plateau pour voir mes pièces en bas
    if (myColor === 'black') {
        boardElement.classList.add('rotated'); // Ajoute .rotated dans CSS (voir étape 3)
        // On fera pivoter les pièces individuellement en CSS aussi
    } else {
        boardElement.classList.remove('rotated');
    }

    startTimers(10); // 10 min par défaut
    currentTurn = 'white';
    
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    
    // On écoute les mouvements de l'adversaire
    listenToRealTimeGame();
}

// --- ECOUTER LA BASE DE DONNÉES (Le coeur du temps réel) ---
function listenToRealTimeGame() {
    if (gameUnsubscribe) gameUnsubscribe(); // On nettoie l'ancienne écoute

    gameUnsubscribe = onSnapshot(doc(db, "games", onlineGameId), (docSnap) => {
        const gameData = docSnap.data();
        if (!gameData) return;

        // Si c'est un nouveau coup que je n'ai pas encore joué
        if (gameData.lastMove) {
            const { from, to, turn, promotion } = gameData.lastMove;
            
            // Si c'est à moi de jouer maintenant, ça veut dire que l'autre vient de jouer
            // On vérifie si le coup a déjà été joué visuellement pour éviter les boucles
            if (currentTurn !== turn) {
                console.log("Coup reçu de l'adversaire :", from, to);
                
                // On trouve les cases HTML
                const fromSquare = document.querySelector(`.square[data-row="${from.row}"][data-col="${from.col}"]`);
                const toSquare = document.querySelector(`.square[data-row="${to.row}"][data-col="${to.col}"]`);

                // On exécute le coup VISUELLEMENT (sans le renvoyer à la BDD)
                executeMoveLocal(fromSquare, toSquare, promotion);
            }
        }
    });
}

function updateProfileUI(user) {
    // ... (Ton code existant) ...
    const profilePanel = document.querySelector('.profile-panel');
    const flags = { 'fr': '🇫🇷', 'be': '🇧🇪', 'ca': '🇨🇦', 'ch': '🇨🇭', 'dz': '🇩🇿', 'ma': '🇲🇦' };
    const flag = flags[user.country] || '🌍';

    profilePanel.innerHTML = `
        <span class="panel-title">${user.pseudo.toUpperCase()} ${flag}</span>
        <span class="panel-subtitle">RANG : ${user.rank}</span>
        <button id="btnLogout" style="margin-top:5px; padding: 5px; font-size:10px; cursor:pointer; background:#c0392b; color:white; border:none; border-radius:3px;">Déconnexion</button>
    `;
    document.querySelector('.points-panel span').innerHTML = `<i class="fas fa-shield-alt"></i> ${user.points} PTS`;
    const gamePseudo = document.getElementById('playerPseudoDisplay');
    if(gamePseudo) gamePseudo.innerText = user.pseudo.toUpperCase();
    document.getElementById('btnLogout').addEventListener('click', logout);
}

// ... (Gardes tes fonctions Timer ici : startTimers, startTurnTimer, updateTimerDisplay, endGame...)
function startTimers(minutes) {
    clearInterval(timerInterval);
    timeWhite = minutes * 60;
    timeBlack = minutes * 60;
    updateTimerDisplay();
    gameActive = true;
    if (currentTurn === 'white') startTurnTimer();
}
function startTurnTimer() {
    if (!gameActive) return;
    clearInterval(timerInterval);
    if (currentTurn === 'white') { timerWhiteEl.classList.add('active'); timerBlackEl.classList.remove('active'); } 
    else { timerBlackEl.classList.add('active'); timerWhiteEl.classList.remove('active'); }

    timerInterval = setInterval(() => {
        if (currentTurn === 'white') { timeWhite--; if(timeWhite<=0) endGame('black'); } 
        else { timeBlack--; if(timeBlack<=0) endGame('white'); }
        updateTimerDisplay();
    }, 1000);
}
function updateTimerDisplay() { timerWhiteEl.innerText = formatTime(timeWhite); timerBlackEl.innerText = formatTime(timeBlack); }
function formatTime(s) { const m=Math.floor(s/60).toString().padStart(2,'0'); const sec=(s%60).toString().padStart(2,'0'); return `${m}:${sec}`; }
function endGame(winner) { gameActive=false; clearInterval(timerInterval); alert(`Gagnant : ${winner}`); }
function addToGraveyard(pieceElement) { /* Ton code cimetière existant */ 
    const deadPiece = document.createElement('div');
    deadPiece.classList.add('dead-piece');
    deadPiece.dataset.team = pieceElement.dataset.team;
    let content = pieceElement.getAttribute('data-content');
    if (pieceElement.dataset.type === 'pawn') content = '♟';
    deadPiece.innerText = content;
    if (pieceElement.dataset.team === 'black') graveyardWhite.appendChild(deadPiece);
    else graveyardBlack.appendChild(deadPiece);
}
function clearMoveHints() { document.querySelectorAll('.square').forEach(s => s.classList.remove('hint', 'capture-hint', 'selected')); }
function showMoveHints(startSquare, pieceType, pieceTeam) { /* Ton code existant */ 
    const allSquares = document.querySelectorAll('.square');
    allSquares.forEach(targetSquare => {
        if (isMoveSafe(startSquare, targetSquare, pieceType, pieceTeam)) {
            const targetPiece = targetSquare.querySelector('.piece');
            if (targetPiece) targetSquare.classList.add('capture-hint');
            else targetSquare.classList.add('hint');
        }
    });
}
function updateCard(pieceType) { /* Ton code existant */ 
    const info = Object.values(piecesInfo).find(p => p.type === pieceType);
    if (!info) return;
    document.getElementById('cardTitle').innerText = info.name;
    document.getElementById('cardDesc').innerText = info.desc;
    document.getElementById('cardAvatar').innerText = (pieceType==='pawn')?'♟':info.symbol; // Simplifié
}
function checkGameStatus() { /* Ton code existant */ 
    const kingSquare = findKing(currentTurn);
    if(kingSquare && isSquareAttacked(kingSquare, currentTurn==='white'?'black':'white')) kingSquare.classList.add('king-in-check');
}

function switchTurn() {
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    clearMoveHints();
    document.getElementById('cardTitle').innerText = (currentTurn === 'white') ? "Tour des Blancs" : "Tour des Noirs";
    checkGameStatus();
    startTurnTimer();
    // Pas d'IA en mode online
    if (!isOnline && currentTurn === 'black' && isVsAI) playAI();
}

// --- LOGIQUE DE MOUVEMENT (MODIFIÉE POUR ONLINE) ---

// Fonction appelée quand le joueur LÂCHE la pièce
async function tryMove(startSquare, targetSquare) {
    const piece = startSquare.querySelector('.piece');
    if (!piece) return;

    // 1. Vérif Online : Est-ce mon tour et ma couleur ?
    if (isOnline) {
        if (currentTurn !== myColor) { console.log("Pas ton tour !"); return; }
        if (piece.dataset.team !== myColor) { console.log("Pas ta pièce !"); return; }
    }

    // 2. Vérif Règles
    if (!isMoveSafe(startSquare, targetSquare, piece.dataset.type, piece.dataset.team)) return;

    // 3. Gestion Promotion (C'est compliqué en asynchrone, on simplifie)
    let promotionType = null;
    if (piece.dataset.type === 'pawn') {
        const endRow = +targetSquare.dataset.row;
        if ((piece.dataset.team === 'white' && endRow === 0) || (piece.dataset.team === 'black' && endRow === 7)) {
            // Pour l'exemple online, on force Reine automatiquement pour éviter de bloquer la DB
            // (Tu pourras améliorer ça plus tard avec une modale asynchrone)
            promotionType = 'queen';
        }
    }

    // 4. SI ONLINE : On envoie à Firebase (on ne bouge PAS localement tout de suite)
    if (isOnline) {
        await sendMoveToFirebase(startSquare, targetSquare, promotionType);
    } else {
        // SI LOCAL : On bouge direct
        executeMoveLocal(startSquare, targetSquare, promotionType);
    }
}

// Envoyer le coup à la BDD
async function sendMoveToFirebase(startSquare, targetSquare, promotionType) {
    try {
        const nextTurn = currentTurn === 'white' ? 'black' : 'white';
        
        await updateDoc(doc(db, "games", onlineGameId), {
            lastMove: {
                from: { row: startSquare.dataset.row, col: startSquare.dataset.col },
                to: { row: targetSquare.dataset.row, col: targetSquare.dataset.col },
                player: myColor,
                promotion: promotionType,
                turn: nextTurn // On dit à la BDD que le tour a changé
            },
            turn: nextTurn
        });
        // On ne fait rien ici, c'est le listener onSnapshot qui va recevoir le changement et bouger la pièce
    } catch (e) {
        console.error("Erreur envoi coup:", e);
    }
}

// Exécuter le coup VISUELLEMENT (Appelé par local ou par le listener Firebase)
function executeMoveLocal(startSquare, targetSquare, forcedPromotionType = null) {
    const piece = startSquare.querySelector('.piece');
    if (!piece) return; // Sécurité

    // Capture
    const captured = targetSquare.querySelector('.piece');
    if (captured) {
        addToGraveyard(captured);
        captured.remove();
    }
    
    // Déplacement DOM
    targetSquare.appendChild(piece);
    piece.dataset.moved = "true";

    // Promotion
    if (forcedPromotionType) {
        piece.dataset.type = forcedPromotionType;
        piece.setAttribute('data-content', '♛'); // Visuel Reine
    } else if (piece.dataset.type === 'pawn') {
        // Logique promotion locale classique (si pas online)
        const endRow = +targetSquare.dataset.row;
        if (!isOnline && ((piece.dataset.team==='white' && endRow===0) || (piece.dataset.team==='black' && endRow===7))) {
            handlePromotion(piece, targetSquare); // Ta fonction modale existante
            return; // handlePromotion fera le switchTurn
        }
    }

    selectedSquare = null;
    switchTurn(); // Change le tour localement
}

// ... (Garde handlePromotion, setupPieceEvents, handleSquareEvents, createBoard, playAI...)

function handlePromotion(pawn, square) { /* Ton code existant */ 
    promoModal.classList.remove('hidden');
    promotionCallback = (type) => {
        pawn.dataset.type = type;
        // ... symboles ...
        let symbol = '♛';
        if(type==='rook') symbol='♜'; if(type==='bishop') symbol='♝'; if(type==='knight') symbol='♞';
        pawn.setAttribute('data-content', symbol);
        promoModal.classList.add('hidden');
        switchTurn();
    };
}
document.querySelectorAll('.promo-option').forEach(opt => { opt.addEventListener('click', () => { if(promotionCallback) promotionCallback(opt.dataset.type); }); });

function setupPieceEvents(piece, square) {
    piece.setAttribute('draggable', true);
    piece.addEventListener('dragstart', e => {
        // En ligne : je ne peux draguer que mes pièces à mon tour
        if (isOnline) {
            if (currentTurn !== myColor) { e.preventDefault(); return; }
            if (piece.dataset.team !== myColor) { e.preventDefault(); return; }
        } else {
             if (isVsAI && piece.dataset.team === 'black') { e.preventDefault(); return; }
             if (piece.dataset.team !== currentTurn) { e.preventDefault(); return; }
        }

        selectedSquare = square;
        setTimeout(() => piece.classList.add('dragging'), 0);
        clearMoveHints();
        showMoveHints(square, piece.dataset.type, piece.dataset.team);
    });
    piece.addEventListener('dragend', () => { piece.classList.remove('dragging'); clearMoveHints(); });
    piece.addEventListener('dragover', e => e.preventDefault());
    piece.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        const targetSquare = piece.parentElement;
        if (selectedSquare && targetSquare) tryMove(selectedSquare, targetSquare); // <--- CHANGÉ executeMove -> tryMove
    });
}

function handleSquareEvents(square) {
    square.addEventListener('dragover', e => e.preventDefault());
    square.addEventListener('drop', e => {
        e.preventDefault();
        const target = e.target.closest('.square'); 
        if (selectedSquare && target) tryMove(selectedSquare, target); // <--- CHANGÉ executeMove -> tryMove
    });
    square.addEventListener('click', (e) => {
        // Clic simple : même logique
        const clickedSquare = e.target.closest('.square');
        if (!clickedSquare) return;
        const piece = clickedSquare.querySelector('.piece');

        // Validation du tour au clic
        if (isOnline) {
            if (currentTurn !== myColor && !selectedSquare) return; 
        }

        if (selectedSquare && selectedSquare !== clickedSquare) {
            // TENTATIVE DE MOUVEMENT
            tryMove(selectedSquare, clickedSquare);
            
            // Si tryMove n'a rien fait (ex: clic sur une autre pièce à moi), on change la sélection
            if (piece && piece.dataset.team === currentTurn) {
                 if (isOnline && piece.dataset.team !== myColor) return; // Sécu
                 clearMoveHints(); selectedSquare = clickedSquare; clickedSquare.classList.add('selected');
                 showMoveHints(clickedSquare, piece.dataset.type, piece.dataset.team);
            }
        } else if (piece && piece.dataset.team === currentTurn) {
             if (isOnline && piece.dataset.team !== myColor) return;
             clearMoveHints(); selectedSquare = clickedSquare; clickedSquare.classList.add('selected');
             showMoveHints(clickedSquare, piece.dataset.type, piece.dataset.team);
        }
    });
}

function createBoard() { /* Ton code existant */ 
    boardElement.innerHTML = ''; graveyardWhite.innerHTML = ''; graveyardBlack.innerHTML = '';
    const files = ['a','b','c','d','e','f','g','h'];
    for (let i = 0; i < 64; i++) {
        const square = document.createElement('div');
        square.classList.add('square');
        const row = Math.floor(i / 8); const col = i % 8;
        square.dataset.row = row; square.dataset.col = col;
        square.classList.add((row + col) % 2 === 0 ? 'white-square' : 'black-square');
        if (col === 0) { const rL = document.createElement('span'); rL.classList.add('coord','rank'); rL.innerText = 8-row; square.appendChild(rL); }
        if (row === 7) { const fL = document.createElement('span'); fL.classList.add('coord','file'); fL.innerText = files[col]; square.appendChild(fL); }

        const symbol = initialBoardSetup[i];
        if (symbol !== '') {
            const pieceData = piecesInfo[symbol];
            if (pieceData) {
                const piece = document.createElement('span');
                piece.classList.add('piece');
                piece.dataset.type = pieceData.type;
                piece.dataset.team = pieceData.team;
                piece.dataset.moved = "false";
                piece.setAttribute('data-content', symbol);
                setupPieceEvents(piece, square);
                square.appendChild(piece);
            }
        }
        handleSquareEvents(square);
        boardElement.appendChild(square);
    }
}

function startGame(mode, diff) { /* Modifié pour reset online */
    createBoard();
    isOnline = false; // Reset online
    isVsAI = (mode==='ai'); aiLevel = diff;
    boardElement.classList.remove('rotated'); // Reset rotation
    startTimers(mode==='ai'?10: (diff==='3min'?3:10));
    currentTurn = 'white';
    document.getElementById('menuScreen').classList.add('hidden');
    difficultyModal.classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
}
function backToMenu() { /* existant */
    gameActive = false; clearInterval(timerInterval);
    if(gameUnsubscribe) gameUnsubscribe(); // Stop écoute DB
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('menuScreen').classList.remove('hidden');
}

// EVENTS MENU
document.getElementById('btn10min')?.addEventListener('click', () => startGame('pvp', 10));
document.getElementById('btn3min')?.addEventListener('click', () => startGame('pvp', '3min'));
document.getElementById('btnAI')?.addEventListener('click', () => difficultyModal.classList.remove('hidden'));
document.querySelectorAll('.ai-option').forEach(btn => btn.addEventListener('click', () => startGame('ai', btn.dataset.level)));
document.getElementById('backToMenu')?.addEventListener('click', backToMenu);

// BOUTIQUE
if (btnShop) { btnShop.addEventListener('click', () => { document.getElementById('menuScreen').classList.add('hidden'); shopScreen.classList.remove('hidden'); shopPointsDisplay.innerHTML = `<i class="fas fa-shield-alt"></i> ${currentUserPoints} PTS`; }); }
if (backFromShop) { backFromShop.addEventListener('click', () => { shopScreen.classList.add('hidden'); document.getElementById('menuScreen').classList.remove('hidden'); }); }
document.querySelectorAll('.shop-card').forEach(card => { card.addEventListener('click', () => { const t = card.querySelector('h3').innerText; card.querySelector('h3').innerText = "Bientôt !"; setTimeout(() => { card.querySelector('h3').innerText = t; }, 1000); }); });

// IA PLAY (Pas besoin en online)
function playAI() { /* Code IA existant */ 
    const moves = getAllLegalMoves('black'); if (moves.length === 0) return;
    let selectedMove = moves[Math.floor(Math.random() * moves.length)];
    if (selectedMove) setTimeout(() => executeMoveLocal(selectedMove.from, selectedMove.to), 500); // <-- utilise executeMoveLocal
}
// Ajoute getAllLegalMoves ici si manquant...
function getAllLegalMoves(team) { /* Ton code existant */ 
    const moves = [];
    document.querySelectorAll('.square').forEach(sourceSquare => {
        const piece = sourceSquare.querySelector('.piece');
        if (piece && piece.dataset.team === team) {
            document.querySelectorAll('.square').forEach(targetSquare => {
                if (isMoveSafe(sourceSquare, targetSquare, piece.dataset.type, team)) {
                    moves.push({ from: sourceSquare, to: targetSquare });
                }
            });
        }
    });
    return moves;
}