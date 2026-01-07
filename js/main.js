// js/main.js
import { gameState, userState } from './state.js';
import { createBoard, executeMoveVisual, highlightCheck, clearHints } from './board.js';
import { addMoveToHistory, handleGameOver, updateProfileUI, showPromotionModal } from '../ui.js';
import { renderShop, renderCollection } from './shop.js';
import { isMoveSafe, isSquareAttacked, findKing } from './rules.js';
import { initAuthListener } from './auth.js'; 
import { initSocialSystem } from './social.js';
import { db, doc, updateDoc, onSnapshot, getDoc } from './firebase.js';

// --- INIT ---
initAuthListener((u) => { 
    updateProfileUI(u); 
    initSocialSystem(u, startOnlineGame); 
});

// --- GAME LOGIC ---
export async function tryMove(start, target) {
    const p = start.querySelector('.piece'); if(!p) return;
    
    // Checks
    if(gameState.isOnline && (gameState.currentTurn !== gameState.myColor || p.dataset.team !== gameState.myColor)) return;
    if(!isMoveSafe(start, target, p.dataset.type, p.dataset.team)) return;

    // Promotion Check
    let promo = null;
    if(p.dataset.type === 'pawn') {
        const row = +target.dataset.row;
        if((p.dataset.team==='white' && row===0) || (p.dataset.team==='black' && row===7)) {
            if(!gameState.isOnline) {
                showPromotionModal(type => {
                    executeMoveVisual(start, target, type);
                    finishMove(p, start, target);
                }); return;
            } else promo = 'queen';
        }
    }

    // Execution
    if(gameState.isOnline) {
        const next = gameState.currentTurn==='white'?'black':'white';
        await updateDoc(doc(db, "games", gameState.onlineGameId), {
            lastMove: { from: {r:start.dataset.row, c:start.dataset.col}, to: {r:target.dataset.row, c:target.dataset.col}, player: gameState.myColor, promo, turn: next },
            turn: next
        });
    } else {
        executeMoveVisual(start, target, promo);
        finishMove(p, start, target);
    }
}

function finishMove(p, start, target) {
    addMoveToHistory(p, start, target);
    gameState.selectedSquare = null;
    switchTurn();
}

function switchTurn() {
    gameState.currentTurn = gameState.currentTurn==='white'?'black':'white';
    clearHints();
    
    // Check & Mat
    const king = findKing(gameState.currentTurn);
    const attacker = gameState.currentTurn==='white'?'black':'white';
    if(king && isSquareAttacked(king, attacker)) highlightCheck(king);

    if(checkMate(gameState.currentTurn)) {
        const winner = gameState.currentTurn==='white'?'black':'white';
        if(gameState.isOnline) { if(gameState.myColor === winner) updateDoc(doc(db,"games",gameState.onlineGameId), {status:'finished', winner, reason:'checkmate'}); }
        else handleGameOver(winner, 'checkmate');
        return;
    }

    startTimer();
    if(!gameState.isOnline && gameState.currentTurn==='black' && gameState.isVsAI) playAI();
}

function checkMate(team) {
    const king = findKing(team);
    // Si roi pas attaqué, pas mat (pat non géré pour simplifier)
    if(!king || !isSquareAttacked(king, team==='white'?'black':'white')) return false;
    
    // On vérifie grossièrement s'il y a des coups (optimisation possible)
    const pieces = document.querySelectorAll(`.piece[data-team="${team}"]`);
    for(const p of pieces) {
        const s = p.parentElement;
        const targets = document.querySelectorAll('.square');
        for(const t of targets) { if(isMoveSafe(s, t, p.dataset.type, team)) return false; }
    }
    return true;
}

// --- NETWORK LISTENER ---
function listenGame() {
    if(gameState.gameUnsubscribe) gameState.gameUnsubscribe();
    gameState.gameUnsubscribe = onSnapshot(doc(db, "games", gameState.onlineGameId), snap => {
        const data = snap.data(); if(!data) return;
        if(data.status === 'finished') { handleGameOver(data.winner, data.reason); return; }
        
        // Modale Nulle
        const dm = document.getElementById('drawModal');
        if(data.drawOffer && data.drawOffer !== gameState.myColor) dm.classList.remove('hidden');
        else dm.classList.add('hidden');

        // Move Adverse
        if(data.lastMove && gameState.currentTurn !== data.lastMove.turn) {
            const f = document.querySelector(`.square[data-row="${data.lastMove.from.r}"][data-col="${data.lastMove.from.c}"]`);
            const t = document.querySelector(`.square[data-row="${data.lastMove.to.r}"][data-col="${data.lastMove.to.c}"]`);
            executeMoveVisual(f, t, data.lastMove.promo);
            finishMove(f.querySelector('.piece'), f, t);
        }
    });
}

// --- SETUP FUNCTIONS ---
export async function startOnlineGame(id, color) {
    gameState.isOnline=true; gameState.onlineGameId=id; gameState.myColor=color; gameState.isVsAI=false;
    resetUI();
    if(color==='black') document.getElementById('chessBoard').classList.add('rotated');
    listenGame();
}

function startLocal(mode, diff) {
    gameState.isOnline=false; gameState.isVsAI=(mode==='ai'); gameState.aiLevel=diff;
    resetUI();
    document.getElementById('chessBoard').classList.remove('rotated');
    document.querySelector('.opponent-name').innerText = gameState.isVsAI ? "ROBOT" : "LOCAL";
}

function resetUI() {
    createBoard(); gameState.currentTurn='white'; gameState.moveCount=1;
    document.querySelector('.history-content').innerHTML='';
    ['menuScreen','difficultyModal','victoryModal','shopScreen','collectionScreen'].forEach(id=>document.getElementById(id).classList.add('hidden'));
    document.getElementById('gameScreen').classList.remove('hidden');
    document.getElementById('gameControls').classList.remove('hidden');
    startTimer();
}

// --- TIMERS & AI ---
function startTimer() {
    clearInterval(gameState.timerInterval);
    const tw = document.getElementById('timerWhite'), tb = document.getElementById('timerBlack');
    gameState.timerInterval = setInterval(() => {
        if(gameState.currentTurn==='white') { gameState.timeWhite--; if(gameState.timeWhite<=0) handleGameOver('black','timeout'); }
        else { gameState.timeBlack--; if(gameState.timeBlack<=0) handleGameOver('white','timeout'); }
        tw.innerText = fmt(gameState.timeWhite); tb.innerText = fmt(gameState.timeBlack);
    }, 1000);
}
const fmt = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

function playAI() {
    // IA Basique aléatoire
    setTimeout(() => {
        const moves = [];
        document.querySelectorAll('.piece[data-team="black"]').forEach(p => {
            const s = p.parentElement;
            document.querySelectorAll('.square').forEach(t => { if(isMoveSafe(s, t, p.dataset.type, 'black')) moves.push({s, t}); });
        });
        if(moves.length) { const m = moves[Math.floor(Math.random()*moves.length)]; tryMove(m.s, m.t); }
    }, 500);
}

// --- EVENTS ---
document.getElementById('btn10min').onclick = () => startLocal('pvp', 10);
document.getElementById('btnAI').onclick = () => document.getElementById('difficultyModal').classList.remove('hidden');
document.querySelectorAll('.ai-option').forEach(b => b.onclick = () => startLocal('ai', b.dataset.level));
document.getElementById('backToMenu').onclick = () => { 
    clearInterval(gameState.timerInterval); if(gameState.gameUnsubscribe) gameState.gameUnsubscribe();
    document.getElementById('gameScreen').classList.add('hidden'); 
    document.getElementById('menuScreen').classList.remove('hidden'); 
};
document.getElementById('btnVictoryOk').onclick = () => { document.getElementById('victoryModal').classList.add('hidden'); document.getElementById('backToMenu').click(); };

// Shop nav
document.getElementById('btnShop').onclick = () => { document.getElementById('menuScreen').classList.add('hidden'); document.getElementById('shopScreen').classList.remove('hidden'); renderShop(); };
document.querySelector('.rpg-main-btn.red').onclick = () => { document.getElementById('menuScreen').classList.add('hidden'); document.getElementById('collectionScreen').classList.remove('hidden'); renderCollection(); };
document.getElementById('backFromShop').onclick = () => { document.getElementById('shopScreen').classList.add('hidden'); document.getElementById('menuScreen').classList.remove('hidden'); };
document.getElementById('backFromCollection').onclick = () => { document.getElementById('collectionScreen').classList.add('hidden'); document.getElementById('menuScreen').classList.remove('hidden'); };