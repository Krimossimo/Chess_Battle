// js/main.js

// ============================================================
// 1. IMPORTS
// ============================================================
import { piecesInfo, initialBoardSetup } from './data.js';
import { isMoveSafe, isSquareAttacked, findKing } from './rules.js';
import { initAuthListener, logout } from './auth.js'; 
import { initSocialSystem } from './social.js';
import { db, doc, updateDoc, onSnapshot, getDoc } from './firebase.js';

// ============================================================
// 2. ÉLÉMENTS DU DOM
// ============================================================
// Ecrans et Modales
const menuScreen = document.getElementById('menuScreen');
const gameScreen = document.getElementById('gameScreen');
const shopScreen = document.getElementById('shopScreen');
const promoModal = document.getElementById('promotionModal');
const difficultyModal = document.getElementById('difficultyModal');
const drawModal = document.getElementById('drawModal');
const victoryModal = document.getElementById('victoryModal');
// Overlay Animation Mat
const ultimateMatOverlay = document.getElementById('ultimateMatOverlay');

// Plateau & Controls
const boardElement = document.getElementById('chessBoard');
const gameControls = document.getElementById('gameControls');
const historyContent = document.querySelector('.history-content');

// HUD (Timers & Cimetières)
const timerWhiteEl = document.getElementById('timerWhite');
const timerBlackEl = document.getElementById('timerBlack');
const graveyardWhite = document.getElementById('graveyardWhite');
const graveyardBlack = document.getElementById('graveyardBlack');
const playerPseudoDisplay = document.getElementById('playerPseudoDisplay');
const opponentNameDisplay = document.querySelector('.opponent-name');

// Boutique
const btnShop = document.getElementById('btnShop');
const backFromShop = document.getElementById('backFromShop');
const shopPointsDisplay = document.getElementById('shopPointsDisplay');

// Son (Optionnel, ne plantera pas si le fichier manque)
const matSound = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'); 
matSound.volume = 0.5;

// ============================================================
// 3. VARIABLES D'ÉTAT
// ============================================================
let selectedSquare = null;
let currentTurn = 'white';
let promotionCallback = null;
let isVsAI = false;
let aiLevel = 'easy';
let currentUserPoints = 0;

// Historique
let moveCount = 1;

// Multijoueur
let isOnline = false;
let onlineGameId = null;
let myColor = 'white';
let gameUnsubscribe = null;

// Timers
let timeWhite = 600;
let timeBlack = 600;
let timerInterval = null;
let gameActive = false;

// ============================================================
// 4. INITIALISATION (AUTH & SOCIAL)
// ============================================================
initAuthListener((userData) => {
    updateProfileUI(userData);
    currentUserPoints = userData.points;
    initSocialSystem(userData);
});

// ============================================================
// 5. LANCEMENT DU JEU EN LIGNE
// ============================================================
export async function startOnlineGame(gameId, color) {
    console.log(`Lancement Online. ID: ${gameId}, Couleur: ${color}`);
    isOnline = true;
    onlineGameId = gameId;
    myColor = color;
    isVsAI = false;
    
    resetGameInterface(); // On nettoie tout avant de commencer

    // Rotation si je suis Noir
    if (myColor === 'black') boardElement.classList.add('rotated');
    else boardElement.classList.remove('rotated');

    // Récupération Nom Adversaire
    opponentNameDisplay.innerText = "CHARGEMENT...";
    try {
        const gameSnap = await getDoc(doc(db, "games", gameId));
        if (gameSnap.exists()) {
            const gData = gameSnap.data();
            const opponentId = (myColor === 'white') ? gData.black : gData.white;
            const userSnap = await getDoc(doc(db, "users", opponentId));
            
            if (userSnap.exists()) opponentNameDisplay.innerText = userSnap.data().pseudo.toUpperCase();
            else opponentNameDisplay.innerText = "ADVERSAIRE";
        }
    } catch (e) { console.error(e); }

    listenToRealTimeGame();
}

// ============================================================
// 6. LANCEMENT JEU LOCAL / IA
// ============================================================
function startGame(mode, diff) {
    isOnline = false;
    isVsAI = (mode === 'ai');
    aiLevel = diff;

    resetGameInterface();
    boardElement.classList.remove('rotated');

    if (isVsAI) {
        let levelName = diff === 'easy' ? 'FACILE' : (diff === 'medium' ? 'MOYEN' : 'DIFFICILE');
        opponentNameDisplay.innerText = `ROBOT (${levelName})`;
    } else {
        opponentNameDisplay.innerText = "JOUEUR 2 (LOCAL)";
    }
}

// Fonction de nettoyage commune (Reset total)
function resetGameInterface() {
    createBoard();
    startTimers(isVsAI ? 10 : 10); // 10 minutes par défaut
    currentTurn = 'white';
    moveCount = 1;
    historyContent.innerHTML = ''; // Vide l'historique visuel
    
    menuScreen.classList.add('hidden');
    difficultyModal.classList.add('hidden');
    victoryModal.classList.add('hidden');
    
    // Reset animation Mat
    if(ultimateMatOverlay) {
        ultimateMatOverlay.classList.remove('active'); 
        ultimateMatOverlay.classList.add('hidden'); 
    }
    document.body.classList.remove('screen-shake');

    gameScreen.classList.remove('hidden');
    gameControls.classList.remove('hidden');
}

// ============================================================
// 7. ÉCOUTE TEMPS RÉEL (FIREBASE)
// ============================================================
function listenToRealTimeGame() {
    if (gameUnsubscribe) gameUnsubscribe();

    gameUnsubscribe = onSnapshot(doc(db, "games", onlineGameId), (docSnap) => {
        const gameData = docSnap.data();
        if (!gameData) return;

        // Fin de partie
        if (gameData.status === 'finished') {
            handleGameOver(gameData);
            return;
        }
        
        // Modale Nulle
        if (gameData.drawOffer && gameData.drawOffer !== myColor) drawModal.classList.remove('hidden');
        else drawModal.classList.add('hidden');

        // Mouvement reçu de l'adversaire
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

// ============================================================
// 8. LOGIQUE DU JEU & DETECTION MAT
// ============================================================

function switchTurn() {
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    clearMoveHints();
    
    // 1. Check simple (couleur rouge sur le roi)
    checkKingStatus(); 

    // 2. CHECKMATE ULTIME
    if (checkForCheckmate(currentTurn)) {
        const winner = currentTurn === 'white' ? 'black' : 'white';
        
        if (isOnline) {
             if (myColor === winner) { 
                 updateDoc(doc(db, "games", onlineGameId), { status:'finished', winner: winner, reason:'checkmate' });
             }
        } else {
            triggerUltimateMatAnimation(winner);
        }
        gameActive = false;
        clearInterval(timerInterval);
        return; 
    }

    startTurnTimer();
    
    // IA
    if (!isOnline && currentTurn === 'black' && isVsAI) {
        playAI();
    }
}

// Vérifie le vrai Mat (Echec + 0 coups)
function checkForCheckmate(team) {
    const kingSq = findKing(team);
    const attacker = team === 'white' ? 'black' : 'white';
    if (!kingSq || !isSquareAttacked(kingSq, attacker)) return false; 

    const legalMoves = getAllLegalMoves(team);
    return legalMoves.length === 0; 
}

// LANCE L'ANIMATION SPECIALE
function triggerUltimateMatAnimation(winnerColor) {
    gameActive = false;
    clearInterval(timerInterval);
    gameControls.classList.add('hidden'); 

    try { matSound.currentTime = 0; matSound.play(); } catch(e) {}

    document.body.classList.add('screen-shake');
    
    if(ultimateMatOverlay) {
        ultimateMatOverlay.classList.remove('hidden');
        setTimeout(() => ultimateMatOverlay.classList.add('active'), 50);
    
        setTimeout(() => {
            document.body.classList.remove('screen-shake');
            ultimateMatOverlay.classList.remove('active');
            ultimateMatOverlay.classList.add('hidden');
            handleGameOver({ winner: winnerColor, reason: 'checkmate' });
        }, 4000); // Durée de l'animation
    } else {
        // Fallback si pas d'overlay
        handleGameOver({ winner: winnerColor, reason: 'checkmate' });
    }
}

// ============================================================
// 9. MOTEUR DE DEPLACEMENT
// ============================================================

function executeMoveLocal(startSquare, targetSquare, forcedPromotionType = null) {
    const piece = startSquare.querySelector('.piece');
    if (!piece) return;

    // Capture
    const captured = targetSquare.querySelector('.piece');
    if (captured) {
        const deadPiece = document.createElement('div');
        deadPiece.className = 'dead-piece';
        const symbol = captured.getAttribute('data-content') || '♟';
        deadPiece.innerText = symbol;
        if (captured.dataset.team === 'black') graveyardWhite.appendChild(deadPiece);
        else graveyardBlack.appendChild(deadPiece);
        captured.remove();
    }
    
    // Déplacement
    targetSquare.appendChild(piece);
    piece.dataset.moved = "true";

    // Promotion
    if (forcedPromotionType) {
        piece.dataset.type = forcedPromotionType;
        piece.setAttribute('data-content', '♛');
    } else if (piece.dataset.type === 'pawn') {
        const endRow = +targetSquare.dataset.row;
        if (!isOnline && ((piece.dataset.team==='white' && endRow===0) || (piece.dataset.team==='black' && endRow===7))) {
            handlePromotion(piece, startSquare, targetSquare);
            return; 
        }
    }

    addMoveToHistory(piece, startSquare, targetSquare);
    selectedSquare = null;
    switchTurn();
}

function addMoveToHistory(piece, from, to) {
    const files = ['a','b','c','d','e','f','g','h'];
    const destCol = files[to.dataset.col];
    const destRow = 8 - to.dataset.row;
    let notation = destCol + destRow;
    
    if(piece.dataset.type === 'knight') notation = 'N' + notation;
    else if(piece.dataset.type !== 'pawn') notation = piece.dataset.type.charAt(0).toUpperCase() + notation;

    if (currentTurn === 'white') {
        const div = document.createElement('div');
        div.className = 'move-row';
        div.innerHTML = `<span>${moveCount}.</span><span>${notation}</span><span></span>`;
        historyContent.appendChild(div);
    } else {
        const rows = historyContent.querySelectorAll('.move-row');
        const lastRow = rows[rows.length - 1];
        if (lastRow) lastRow.lastElementChild.innerText = notation;
        moveCount++;
    }
    const container = document.getElementById('moveHistory');
    if(container) container.scrollTop = container.scrollHeight;
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
            promotionType = 'queen';
        }
    }

    if (isOnline) {
        const nextTurn = currentTurn === 'white' ? 'black' : 'white';
        try {
            await updateDoc(doc(db, "games", onlineGameId), {
                lastMove: {
                    from: { row: startSquare.dataset.row, col: startSquare.dataset.col },
                    to: { row: targetSquare.dataset.row, col: targetSquare.dataset.col },
                    player: myColor,
                    promotion: promotionType,
                    turn: nextTurn
                },
                turn: nextTurn
            });
        } catch(e) { console.error(e); }
    } else {
        executeMoveLocal(startSquare, targetSquare, promotionType);
    }
}

// ============================================================
// 10. GESTION DRAG & DROP (MODE FANTÔME ACTIF)
// ============================================================
function setupPieceEvents(piece, square) {
    piece.setAttribute('draggable', true);
    
    // START DRAG
    piece.addEventListener('dragstart', (e) => {
        if (isOnline) {
            if (currentTurn !== myColor || piece.dataset.team !== myColor) { e.preventDefault(); return; }
        } else {
             if (isVsAI && piece.dataset.team === 'black') { e.preventDefault(); return; }
             if (piece.dataset.team !== currentTurn) { e.preventDefault(); return; }
        }

        selectedSquare = square;
        // ACTIVATION FANTÔME (pour traverser les pièces ennemies)
        boardElement.classList.add('is-dragging'); 
        setTimeout(() => piece.classList.add('dragging'), 0);
        
        clearMoveHints();
        showMoveHints(square, piece.dataset.type, piece.dataset.team);
    });

    // END DRAG
    piece.addEventListener('dragend', () => { 
        boardElement.classList.remove('is-dragging');
        piece.classList.remove('dragging'); 
        clearMoveHints(); 
    });

    // Event de secours pour drop direct
    piece.addEventListener('dragover', (e) => e.preventDefault());
    piece.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation(); 
        const targetSquare = piece.parentElement; 
        if (selectedSquare && targetSquare && selectedSquare !== targetSquare) tryMove(selectedSquare, targetSquare);
    });
}

function handleSquareEvents(square) {
    square.addEventListener('dragover', (e) => e.preventDefault());
    
    // DROP SUR LA CASE
    square.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('.square'); 
        if (selectedSquare && target && selectedSquare !== target) tryMove(selectedSquare, target);
    });

    // CLIC
    square.addEventListener('click', (e) => {
        const clickedSquare = e.target.closest('.square');
        if (!clickedSquare) return;
        const piece = clickedSquare.querySelector('.piece');

        if (isOnline && currentTurn !== myColor && !selectedSquare) return;

        if (selectedSquare && selectedSquare !== clickedSquare) {
            tryMove(selectedSquare, clickedSquare);
            if (piece && piece.dataset.team === currentTurn) {
                 if (isOnline && piece.dataset.team !== myColor) return;
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

// ============================================================
// 11. CRÉATION PLATEAU
// ============================================================
function createBoard() {
    boardElement.innerHTML = '';
    graveyardWhite.innerHTML = ''; 
    graveyardBlack.innerHTML = '';
    
    const files = ['a','b','c','d','e','f','g','h'];
    for (let i = 0; i < 64; i++) {
        const square = document.createElement('div');
        square.classList.add('square');
        const row = Math.floor(i / 8); const col = i % 8;
        square.dataset.row = row; square.dataset.col = col;
        square.classList.add((row + col) % 2 === 0 ? 'white-square' : 'black-square');

        if (col === 0) { const s = document.createElement('span'); s.className='coord rank'; s.innerText = 8-row; square.appendChild(s); }
        if (row === 7) { const s = document.createElement('span'); s.className='coord file'; s.innerText = files[col]; square.appendChild(s); }

        const symbol = initialBoardSetup[i];
        if (symbol) {
            const p = piecesInfo[symbol];
            if(p) {
                const el = document.createElement('span'); 
                el.className='piece';
                el.dataset.type = p.type; el.dataset.team = p.team; el.dataset.moved = "false";
                el.setAttribute('data-content', symbol);
                setupPieceEvents(el, square);
                square.appendChild(el);
            }
        }
        handleSquareEvents(square);
        boardElement.appendChild(square);
    }
}

// ============================================================
// 12. GESTION UI & ACTIONS
// ============================================================
function handleGameOver(gameData) {
    gameActive = false;
    clearInterval(timerInterval);
    
    // Si Mat Online -> Animation
    if (gameData.reason === 'checkmate' && isOnline) {
        triggerUltimateMatAnimation(gameData.winner);
        return;
    }

    victoryModal.classList.remove('hidden');
    const title = document.getElementById('victoryTitle');
    const reason = document.getElementById('victoryReason');

    if (gameData.winner === 'draw') {
        title.innerText = "MATCH NUL"; title.style.color = "#7f8c8d"; reason.innerText = "Égalité parfaite.";
    } 
    else if (gameData.winner === myColor || (!isOnline && gameData.winner)) {
        title.innerText = "VICTOIRE !"; title.style.color = "#27ae60"; reason.innerText = "L'adversaire a été vaincu.";
    } 
    else {
        title.innerText = "DÉFAITE..."; title.style.color = "#c0392b"; reason.innerText = "Dommage !";
    }
}

document.getElementById('btnVictoryOk').addEventListener('click', () => { victoryModal.classList.add('hidden'); backToMenu(); });

document.getElementById('btnResign').addEventListener('click', async () => {
    if(!gameActive) return;
    if(confirm("Abandonner la partie ?")) {
        if(isOnline) {
            const winner = myColor === 'white' ? 'black' : 'white';
            await updateDoc(doc(db, "games", onlineGameId), { status:'finished', winner: winner, reason:'resignation' });
        } else {
            handleGameOver({ winner: currentTurn === 'white' ? 'black' : 'white', reason:'resignation' });
        }
    }
});

document.getElementById('btnDraw').addEventListener('click', async () => {
    if(!isOnline) { alert("Disponible en ligne uniquement."); return; }
    if(confirm("Proposer nulle ?")) {
        await updateDoc(doc(db, "games", onlineGameId), { drawOffer: myColor });
        alert("Envoyé !");
    }
});

// Ecouteur pour le bouton settings de la bannière
document.getElementById('btnSettings')?.addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('hidden');
});

// Ecouteur pour le bouton shop de la bannière
document.getElementById('miniShopBtn')?.addEventListener('click', () => {
    menuScreen.classList.add('hidden');
    shopScreen.classList.remove('hidden');
    document.getElementById('shopPointsDisplay').innerHTML = `<i class="fas fa-shield-alt"></i> ${currentUserPoints} PTS`;
});

document.getElementById('btnAcceptDraw')?.addEventListener('click', async () => {
    await updateDoc(doc(db, "games", onlineGameId), { status: 'finished', winner: 'draw', reason: 'agreement', drawOffer: null });
    drawModal.classList.add('hidden');
});
document.getElementById('btnDeclineDraw')?.addEventListener('click', async () => {
    await updateDoc(doc(db, "games", onlineGameId), { drawOffer: null });
    drawModal.classList.add('hidden');
});

function backToMenu() {
    gameActive = false; clearInterval(timerInterval); 
    if(gameUnsubscribe) gameUnsubscribe();
    gameScreen.classList.add('hidden'); menuScreen.classList.remove('hidden');
}
document.getElementById('backToMenu').addEventListener('click', backToMenu);

document.getElementById('btn10min')?.addEventListener('click', () => startGame('pvp', 10));
document.getElementById('btnAI')?.addEventListener('click', () => difficultyModal.classList.remove('hidden'));
document.querySelectorAll('.ai-option').forEach(btn => btn.addEventListener('click', () => startGame('ai', btn.dataset.level)));

if (btnShop) btnShop.addEventListener('click', () => { menuScreen.classList.add('hidden'); shopScreen.classList.remove('hidden'); shopPointsDisplay.innerHTML = `<i class="fas fa-shield-alt"></i> ${currentUserPoints} PTS`; });
if (backFromShop) backFromShop.addEventListener('click', () => { shopScreen.classList.add('hidden'); menuScreen.classList.remove('hidden'); });
document.querySelectorAll('.shop-card').forEach(card => card.addEventListener('click', () => { const t = card.querySelector('h3').innerText; card.querySelector('h3').innerText = "Bientôt !"; setTimeout(() => { card.querySelector('h3').innerText = t; }, 1000); }));

// ============================================================
// 13. HELPERS
// ============================================================
function startTimers(min) { clearInterval(timerInterval); timeWhite=min*60; timeBlack=min*60; updateTimerDisplay(); gameActive=true; if(currentTurn==='white') startTurnTimer(); }
function startTurnTimer() { if(!gameActive) return; clearInterval(timerInterval); if(currentTurn==='white'){timerWhiteEl.classList.add('active');timerBlackEl.classList.remove('active');}else{timerBlackEl.classList.add('active');timerWhiteEl.classList.remove('active');} timerInterval=setInterval(()=>{ if(currentTurn==='white'){timeWhite--;if(timeWhite<=0)endGame('black');}else{timeBlack--;if(timeBlack<=0)endGame('white');} updateTimerDisplay(); },1000); }
function updateTimerDisplay() { timerWhiteEl.innerText=fmt(timeWhite); timerBlackEl.innerText=fmt(timeBlack); }
function fmt(s){const m=Math.floor(s/60).toString().padStart(2,'0');const sc=(s%60).toString().padStart(2,'0');return `${m}:${sc}`;}
function endGame(w){gameActive=false;clearInterval(timerInterval);handleGameOver({winner:w,reason:'timeout'});}

function playAI() { const m=getAllLegalMoves('black'); if(!m.length)return; const sm=m[Math.floor(Math.random()*m.length)]; setTimeout(()=>executeMoveLocal(sm.from,sm.to),500); }
function getAllLegalMoves(team) { const m=[]; document.querySelectorAll('.square').forEach(s=>{ const p=s.querySelector('.piece'); if(p&&p.dataset.team===team) document.querySelectorAll('.square').forEach(t=>{ if(isMoveSafe(s,t,p.dataset.type,team)) m.push({from:s,to:t}); }); }); return m; }

function checkKingStatus(){const k=findKing(currentTurn);if(k&&isSquareAttacked(k,currentTurn==='white'?'black':'white'))k.classList.add('king-in-check');}
function clearMoveHints(){document.querySelectorAll('.square').forEach(s=>s.classList.remove('hint','capture-hint','selected','king-in-check'));}
function showMoveHints(s,t,tm){document.querySelectorAll('.square').forEach(target=>{if(isMoveSafe(s,target,t,tm)){if(target.querySelector('.piece'))target.classList.add('capture-hint');else target.classList.add('hint');}});}

function handlePromotion(p, startSquare, targetSquare){
    promoModal.classList.remove('hidden');
    promotionCallback=(t)=>{
        p.dataset.type=t; 
        p.setAttribute('data-content','♛');
        promoModal.classList.add('hidden');
        addMoveToHistory(p, startSquare, targetSquare);
        switchTurn();
    };
}
document.querySelectorAll('.promo-option').forEach(o=>o.addEventListener('click',()=>promotionCallback&&promotionCallback(o.dataset.type)));

// ============================================================
// FONCTION DE MISE A JOUR UI (Bannière & Profil)
// ============================================================
function updateProfileUI(u) {
    const points = u.points || 0;
    
    // 1. Calcul du Rang (Logique simple)
    let rank = "BRONZE";
    let rankColorClass = "rank-bronze"; // Par défaut dans le CSS
    let rankIcon = "🥉";
    let nextLevelPoints = 1500; // Objectif pour Silver
    let baseLevelPoints = 0;

    if (points >= 1500 && points < 2000) {
        rank = "ARGENT";
        rankColorClass = "rank-silver";
        rankIcon = "🥈";
        baseLevelPoints = 1500;
        nextLevelPoints = 2000;
    } else if (points >= 2000) {
        rank = "OR";
        rankColorClass = "rank-gold";
        rankIcon = "🥇";
        baseLevelPoints = 2000;
        nextLevelPoints = 3000;
    }

    // 2. Mise à jour du DOM
    const banner = document.querySelector('.player-banner');
    const pseudoEl = document.getElementById('displayPseudo');
    const rankTitleEl = document.getElementById('bannerRankTitle');
    const rankBadgeEl = document.getElementById('rankBadge');
    const pointsEl = document.getElementById('displayPoints');
    const eloBar = document.getElementById('eloBar');
    const gamePseudo = document.getElementById('playerPseudoDisplay');
    const rankEl = document.querySelector('.profile-rank');

    if (pseudoEl) pseudoEl.innerText = user.pseudo.toUpperCase();
    if(rankTitleEl) rankTitleEl.innerText = `RANG ${rank}`;
    if(rankBadgeEl) rankBadgeEl.innerText = rankIcon;
    if (pointsEl) pointsEl.innerText = user.points;
    if (gamePseudo) gamePseudo.innerText = user.pseudo.toUpperCase();
    if (rankEl && user.rank) rankEl.innerHTML = `<i class="fas fa-gem"></i> ${user.rank}`;

    // 3. Barre de progression (%)
    // (Points actuels - Base du rang) / (Objectif rang suivant - Base du rang)
    let percentage = 0;
    if(nextLevelPoints > baseLevelPoints) {
        percentage = ((points - baseLevelPoints) / (nextLevelPoints - baseLevelPoints)) * 100;
    }
    // On limite entre 5% (pour qu'on la voie un peu) et 100%
    percentage = Math.max(5, Math.min(100, percentage));
    
    if(eloBar) eloBar.style.width = `${percentage}%`;

    // 4. Couleur dynamique de la bannière
    if(banner) {
        banner.classList.remove('rank-silver', 'rank-gold'); // Reset
        if(rankColorClass !== 'rank-bronze') {
            banner.classList.add(rankColorClass);
        }
        // Note: Le bronze est le style par défaut dans le CSS
    }
    
    // Mettre à jour aussi le pseudo en jeu
    const inGameName = document.getElementById('playerPseudoDisplay');
    if(inGameName) inGameName.innerText = u.pseudo.toUpperCase();
}