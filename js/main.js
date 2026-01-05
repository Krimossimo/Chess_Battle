// js/main.js
import { piecesInfo, initialBoardSetup } from './data.js';
import { isMoveSafe, isSquareAttacked, findKing } from './rules.js';
import { initAuthListener, logout } from './auth.js'; 
import { initSocialSystem } from './social.js';
import { db, doc, updateDoc, onSnapshot } from './firebase.js';

const boardElement = document.getElementById('chessBoard');
const promoModal = document.getElementById('promotionModal');
const difficultyModal = document.getElementById('difficultyModal');
const drawModal = document.getElementById('drawModal'); // NOUVEAU

// HUD
const timerWhiteEl = document.getElementById('timerWhite');
const timerBlackEl = document.getElementById('timerBlack');
const graveyardWhite = document.getElementById('graveyardWhite');
const graveyardBlack = document.getElementById('graveyardBlack');
const gameControls = document.getElementById('gameControls'); // NOUVEAU

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

// MULTIJOUEUR
let isOnline = false;
let onlineGameId = null;
let myColor = 'white';
let gameUnsubscribe = null;

// TIME
let timeWhite = 600;
let timeBlack = 600;
let timerInterval = null;
let gameActive = false;

// --- INIT ---
initAuthListener((userData) => {
    updateProfileUI(userData);
    currentUserPoints = userData.points;
    initSocialSystem(userData);
});

// --- LANCEMENT JEU EN LIGNE ---
export function startOnlineGame(gameId, color) {
    console.log(`Lancement partie Online. ID: ${gameId}, Couleur: ${color}`);
    isOnline = true;
    onlineGameId = gameId;
    myColor = color;
    isVsAI = false;

    createBoard();
    if (myColor === 'black') boardElement.classList.add('rotated');
    else boardElement.classList.remove('rotated');

    startTimers(10);
    currentTurn = 'white';
    
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    gameControls.classList.remove('hidden'); // Afficher les boutons Abandon/Nulle
    
    listenToRealTimeGame();
}

// --- ECOUTE TEMPS RÉEL (COUPS + ABANDON + NULLE) ---
function listenToRealTimeGame() {
    if (gameUnsubscribe) gameUnsubscribe();

    gameUnsubscribe = onSnapshot(doc(db, "games", onlineGameId), (docSnap) => {
        const gameData = docSnap.data();
        if (!gameData) return;

        // 1. GESTION FIN DE PARTIE (Abandon, Mat, Nulle)
        if (gameData.status === 'finished') {
            handleGameOver(gameData);
            return;
        }

        // 2. GESTION PROPOSITION NULLE
        if (gameData.drawOffer && gameData.drawOffer !== myColor) {
            // Si c'est l'autre qui propose, on affiche la modale
            drawModal.classList.remove('hidden');
        } else {
            // Sinon on cache (cas où il annule ou on a refusé)
            drawModal.classList.add('hidden');
        }

        // 3. GESTION MOUVEMENT
        if (gameData.lastMove) {
            const { from, to, turn, promotion } = gameData.lastMove;
            if (currentTurn !== turn) {
                const fromSquare = document.querySelector(`.square[data-row="${from.row}"][data-col="${from.col}"]`);
                const toSquare = document.querySelector(`.square[data-row="${to.row}"][data-col="${to.col}"]`);
                executeMoveLocal(fromSquare, toSquare, promotion);
            }
        }
    });
}

// --- GESTION FIN DE PARTIE ---
function handleGameOver(gameData) {
    gameActive = false;
    clearInterval(timerInterval);
    gameControls.classList.add('hidden'); // On cache les boutons
    drawModal.classList.add('hidden');

    let message = "";
    if (gameData.winner === 'draw') {
        message = "🤝 MATCH NUL ! " + (gameData.reason === 'agreement' ? "(Accord mutuel)" : "");
    } else if (gameData.winner === myColor) {
        message = "🏆 VICTOIRE ! " + (gameData.reason === 'resignation' ? "(Adversaire a abandonné)" : "");
        // Ici tu pourras ajouter des points plus tard
    } else {
        message = "💀 DÉFAITE... " + (gameData.reason === 'resignation' ? "(Vous avez abandonné)" : "");
    }
    
    alert(message);
    // On pourrait rediriger au menu après un délai
}

// --- LOGIQUE ABANDON & NULLE ---

// 1. ABANDONNER
document.getElementById('btnResign')?.addEventListener('click', async () => {
    if (!isOnline || !gameActive) return;
    if (confirm("Êtes-vous sûr de vouloir abandonner ? Cela comptera comme une défaite.")) {
        const winnerColor = (myColor === 'white') ? 'black' : 'white';
        await updateDoc(doc(db, "games", onlineGameId), {
            status: 'finished',
            winner: winnerColor,
            reason: 'resignation'
        });
    }
});

// 2. PROPOSER NULLE
document.getElementById('btnDraw')?.addEventListener('click', async () => {
    if (!isOnline || !gameActive) return;
    if (confirm("Proposer le match nul à l'adversaire ?")) {
        await updateDoc(doc(db, "games", onlineGameId), {
            drawOffer: myColor
        });
        alert("Proposition envoyée ! Attente de la réponse...");
    }
});

// 3. REPONDRE A LA NULLE (Modale)
document.getElementById('btnAcceptDraw')?.addEventListener('click', async () => {
    // Accepter -> Fin de partie
    await updateDoc(doc(db, "games", onlineGameId), {
        status: 'finished',
        winner: 'draw',
        reason: 'agreement',
        drawOffer: null
    });
    drawModal.classList.add('hidden');
});

document.getElementById('btnDeclineDraw')?.addEventListener('click', async () => {
    // Refuser -> On efface l'offre dans la BDD
    await updateDoc(doc(db, "games", onlineGameId), {
        drawOffer: null
    });
    drawModal.classList.add('hidden');
});


// --- LE RESTE DU JEU (MOTEUR) ---

function updateProfileUI(user) { /* Ton code existant */ 
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

function startTimers(minutes) {
    clearInterval(timerInterval);
    timeWhite = minutes * 60; timeBlack = minutes * 60;
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
function endGame(winner) { gameActive=false; clearInterval(timerInterval); alert(`Temps écoulé ! Victoire : ${winner}`); }

function executeMoveLocal(startSquare, targetSquare, forcedPromotionType = null) {
    const piece = startSquare.querySelector('.piece');
    if (!piece) return;
    const captured = targetSquare.querySelector('.piece');
    if (captured) {
        // Cimetière
        const deadPiece = document.createElement('div');
        deadPiece.classList.add('dead-piece');
        deadPiece.dataset.team = captured.dataset.team;
        let content = captured.getAttribute('data-content');
        if (captured.dataset.type === 'pawn') content = '♟';
        deadPiece.innerText = content;
        if (captured.dataset.team === 'black') graveyardWhite.appendChild(deadPiece);
        else graveyardBlack.appendChild(deadPiece);
        captured.remove();
    }
    targetSquare.appendChild(piece);
    piece.dataset.moved = "true";

    if (forcedPromotionType) {
        piece.dataset.type = forcedPromotionType; piece.setAttribute('data-content', '♛');
    } else if (piece.dataset.type === 'pawn') {
        const endRow = +targetSquare.dataset.row;
        if (!isOnline && ((piece.dataset.team==='white' && endRow===0) || (piece.dataset.team==='black' && endRow===7))) {
            handlePromotion(piece, targetSquare); return;
        }
    }
    selectedSquare = null; switchTurn();
}

function switchTurn() {
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    clearMoveHints();
    document.getElementById('cardTitle').innerText = (currentTurn === 'white') ? "Tour des Blancs" : "Tour des Noirs";
    checkGameStatus();
    startTurnTimer();
    if (!isOnline && currentTurn === 'black' && isVsAI) playAI();
}

async function tryMove(startSquare, targetSquare) {
    const piece = startSquare.querySelector('.piece');
    if (!piece) return;
    if (isOnline) {
        if (currentTurn !== myColor) return;
        if (piece.dataset.team !== myColor) return;
    }
    if (!isMoveSafe(startSquare, targetSquare, piece.dataset.type, piece.dataset.team)) return;
    
    let promotionType = null;
    if (piece.dataset.type === 'pawn') {
        const endRow = +targetSquare.dataset.row;
        if ((piece.dataset.team === 'white' && endRow === 0) || (piece.dataset.team === 'black' && endRow === 7)) {
            promotionType = 'queen'; // Auto-Queen en ligne pour simplifier
        }
    }

    if (isOnline) {
        const nextTurn = currentTurn === 'white' ? 'black' : 'white';
        try {
            await updateDoc(doc(db, "games", onlineGameId), {
                lastMove: { from: { row: startSquare.dataset.row, col: startSquare.dataset.col }, to: { row: targetSquare.dataset.row, col: targetSquare.dataset.col }, player: myColor, promotion: promotionType, turn: nextTurn },
                turn: nextTurn
            });
        } catch(e) { console.error(e); }
    } else {
        executeMoveLocal(startSquare, targetSquare, promotionType);
    }
}

// ... EVENTS DRAG DROP CLIC (Identiques à avant) ...
function setupPieceEvents(piece, square) {
    piece.setAttribute('draggable', true);
    piece.addEventListener('dragstart', e => {
        if (isOnline) { if (currentTurn !== myColor || piece.dataset.team !== myColor) { e.preventDefault(); return; } }
        else { if (isVsAI && piece.dataset.team === 'black') { e.preventDefault(); return; } if (piece.dataset.team !== currentTurn) { e.preventDefault(); return; } }
        selectedSquare = square; setTimeout(() => piece.classList.add('dragging'), 0); clearMoveHints(); showMoveHints(square, piece.dataset.type, piece.dataset.team);
    });
    piece.addEventListener('dragend', () => { piece.classList.remove('dragging'); clearMoveHints(); });
    piece.addEventListener('dragover', e => e.preventDefault());
    piece.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); const targetSquare = piece.parentElement; if (selectedSquare && targetSquare) tryMove(selectedSquare, targetSquare); });
}
function handleSquareEvents(square) {
    square.addEventListener('dragover', e => e.preventDefault());
    square.addEventListener('drop', e => { e.preventDefault(); const target = e.target.closest('.square'); if (selectedSquare && target) tryMove(selectedSquare, target); });
    square.addEventListener('click', (e) => {
        const clickedSquare = e.target.closest('.square'); if (!clickedSquare) return;
        const piece = clickedSquare.querySelector('.piece');
        if (isOnline && currentTurn !== myColor && !selectedSquare) return;
        if (selectedSquare && selectedSquare !== clickedSquare) {
            tryMove(selectedSquare, clickedSquare);
            if (piece && piece.dataset.team === currentTurn) {
                 if (isOnline && piece.dataset.team !== myColor) return;
                 clearMoveHints(); selectedSquare = clickedSquare; clickedSquare.classList.add('selected'); showMoveHints(clickedSquare, piece.dataset.type, piece.dataset.team);
            }
        } else if (piece && piece.dataset.team === currentTurn) {
             if (isOnline && piece.dataset.team !== myColor) return;
             clearMoveHints(); selectedSquare = clickedSquare; clickedSquare.classList.add('selected'); showMoveHints(clickedSquare, piece.dataset.type, piece.dataset.team);
        }
    });
}

// ... CREATION PLATEAU + START (Identiques) ...
function createBoard() {
    boardElement.innerHTML = ''; graveyardWhite.innerHTML = ''; graveyardBlack.innerHTML = '';
    const files = ['a','b','c','d','e','f','g','h'];
    for (let i = 0; i < 64; i++) {
        const square = document.createElement('div'); square.classList.add('square');
        const row = Math.floor(i / 8); const col = i % 8; square.dataset.row = row; square.dataset.col = col;
        square.classList.add((row + col) % 2 === 0 ? 'white-square' : 'black-square');
        if (col === 0) { const rL = document.createElement('span'); rL.classList.add('coord','rank'); rL.innerText = 8-row; square.appendChild(rL); }
        if (row === 7) { const fL = document.createElement('span'); fL.classList.add('coord','file'); fL.innerText = files[col]; square.appendChild(fL); }
        const symbol = initialBoardSetup[i];
        if (symbol !== '') {
            const pieceData = piecesInfo[symbol];
            if (pieceData) {
                const piece = document.createElement('span'); piece.classList.add('piece'); piece.dataset.type = pieceData.type; piece.dataset.team = pieceData.team; piece.dataset.moved = "false"; piece.setAttribute('data-content', symbol);
                setupPieceEvents(piece, square); square.appendChild(piece);
            }
        }
        handleSquareEvents(square); boardElement.appendChild(square);
    }
}
function startGame(mode, diff) {
    createBoard(); isOnline = false; isVsAI = (mode==='ai'); aiLevel = diff; boardElement.classList.remove('rotated');
    startTimers(mode==='ai'?10: (diff==='3min'?3:10)); currentTurn = 'white';
    document.getElementById('menuScreen').classList.add('hidden'); difficultyModal.classList.add('hidden'); document.getElementById('gameScreen').classList.remove('hidden');
    gameControls.classList.add('hidden'); // Pas de boutons en local pour l'instant
}
function backToMenu() {
    gameActive = false; clearInterval(timerInterval); if(gameUnsubscribe) gameUnsubscribe();
    document.getElementById('gameScreen').classList.add('hidden'); document.getElementById('menuScreen').classList.remove('hidden');
}

// Events boutons Menu
document.getElementById('btn10min')?.addEventListener('click', () => startGame('pvp', 10));
document.getElementById('btn3min')?.addEventListener('click', () => startGame('pvp', '3min'));
document.getElementById('btnAI')?.addEventListener('click', () => difficultyModal.classList.remove('hidden'));
document.querySelectorAll('.ai-option').forEach(btn => btn.addEventListener('click', () => startGame('ai', btn.dataset.level)));
document.getElementById('backToMenu')?.addEventListener('click', backToMenu);

// BOUTIQUE
if (btnShop) { btnShop.addEventListener('click', () => { document.getElementById('menuScreen').classList.add('hidden'); shopScreen.classList.remove('hidden'); shopPointsDisplay.innerHTML = `<i class="fas fa-shield-alt"></i> ${currentUserPoints} PTS`; }); }
if (backFromShop) { backFromShop.addEventListener('click', () => { shopScreen.classList.add('hidden'); document.getElementById('menuScreen').classList.remove('hidden'); }); }
document.querySelectorAll('.shop-card').forEach(card => { card.addEventListener('click', () => { const t = card.querySelector('h3').innerText; card.querySelector('h3').innerText = "Bientôt !"; setTimeout(() => { card.querySelector('h3').innerText = t; }, 1000); }); });

// IA Helper
function playAI() { const moves = getAllLegalMoves('black'); if (moves.length === 0) return; let sm = moves[Math.floor(Math.random() * moves.length)]; if (sm) setTimeout(() => executeMoveLocal(sm.from, sm.to), 500); }
function getAllLegalMoves(team) { const moves = []; document.querySelectorAll('.square').forEach(ss => { const p = ss.querySelector('.piece'); if (p && p.dataset.team === team) { document.querySelectorAll('.square').forEach(ts => { if (isMoveSafe(ss, ts, p.dataset.type, team)) moves.push({ from: ss, to: ts }); }); } }); return moves; }
function checkGameStatus() { const k = findKing(currentTurn); if(k && isSquareAttacked(k, currentTurn==='white'?'black':'white')) k.classList.add('king-in-check'); }
function clearMoveHints() { document.querySelectorAll('.square').forEach(s => s.classList.remove('hint', 'capture-hint', 'selected')); }
function showMoveHints(ss, pt, pm) { document.querySelectorAll('.square').forEach(ts => { if (isMoveSafe(ss, ts, pt, pm)) { if (ts.querySelector('.piece')) ts.classList.add('capture-hint'); else ts.classList.add('hint'); } }); }
function handlePromotion(p,s) { promoModal.classList.remove('hidden'); promotionCallback = (t) => { p.dataset.type = t; let sy='♛'; if(t==='rook') sy='♜'; if(t==='bishop') sy='♝'; if(t==='knight') sy='♞'; p.setAttribute('data-content', sy); promoModal.classList.add('hidden'); switchTurn(); }; }
document.querySelectorAll('.promo-option').forEach(o => o.addEventListener('click', () => { if(promotionCallback) promotionCallback(o.dataset.type); }));