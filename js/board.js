// js/board.js
import { gameState } from './state.js';
import { initialBoardSetup, piecesInfo } from './data.js';
import { isMoveSafe } from './rules.js';
import { tryMove } from './main.js';

const boardElement = document.getElementById('chessBoard');
const graveyardWhite = document.getElementById('graveyardWhite');
const graveyardBlack = document.getElementById('graveyardBlack');

export function createBoard() {
    boardElement.innerHTML = ''; graveyardWhite.innerHTML = ''; graveyardBlack.innerHTML = '';
    for(let i=0; i<64; i++) {
        const s = document.createElement('div'); s.className = `square ${(Math.floor(i/8)+i%8)%2===0?'white-square':'black-square'}`;
        s.dataset.row = Math.floor(i/8); s.dataset.col = i%8;
        // Coords
        if(i%8===0) s.innerHTML += `<span class="coord rank">${8-Math.floor(i/8)}</span>`;
        if(Math.floor(i/8)===7) s.innerHTML += `<span class="coord file">${['a','b','c','d','e','f','g','h'][i%8]}</span>`;
        // Piece
        const sym = initialBoardSetup[i];
        if(sym && piecesInfo[sym]) {
            const p = document.createElement('span'); p.className = 'piece';
            p.dataset.type = piecesInfo[sym].type; p.dataset.team = piecesInfo[sym].team;
            p.setAttribute('data-content', sym);
            setupDrag(p, s); s.appendChild(p);
        }
        setupDrop(s); boardElement.appendChild(s);
    }
}

export function executeMoveVisual(start, target, promoType) {
    const p = start.querySelector('.piece'); if(!p) return;
    const captured = target.querySelector('.piece');
    if(captured) {
        const dead = document.createElement('div'); dead.className='dead-piece'; 
        dead.innerText = captured.getAttribute('data-content')||'♟';
        (captured.dataset.team==='black'?graveyardWhite:graveyardBlack).appendChild(dead);
        captured.remove();
    }
    target.appendChild(p);
    if(promoType) { p.dataset.type = promoType; p.setAttribute('data-content', '♛'); }
}

function setupDrag(p, s) {
    p.setAttribute('draggable', true);
    p.addEventListener('dragstart', e => {
        if(checkTurn(p)) {
            gameState.selectedSquare = s;
            boardElement.classList.add('is-dragging');
            setTimeout(() => p.classList.add('dragging'), 0);
            showHints(s, p.dataset.type, p.dataset.team);
        } else e.preventDefault();
    });
    p.addEventListener('dragend', () => { boardElement.classList.remove('is-dragging'); p.classList.remove('dragging'); clearHints(); });
}

function setupDrop(s) {
    s.addEventListener('dragover', e => e.preventDefault());
    s.addEventListener('drop', e => {
        e.preventDefault(); const t = e.target.closest('.square');
        if(gameState.selectedSquare && t && gameState.selectedSquare !== t) tryMove(gameState.selectedSquare, t);
    });
    s.addEventListener('click', () => { /* Logique click simplifiée si besoin */ });
}

function checkTurn(p) {
    if(gameState.isOnline) return gameState.currentTurn === gameState.myColor && p.dataset.team === gameState.myColor;
    if(gameState.isVsAI && p.dataset.team === 'black') return false;
    return p.dataset.team === gameState.currentTurn;
}

export function clearHints() { document.querySelectorAll('.square').forEach(s => s.classList.remove('hint','capture-hint','selected','king-in-check')); }
function showHints(s, t, tm) {
    document.querySelectorAll('.square').forEach(target => {
        if(isMoveSafe(s, target, t, tm)) target.classList.add(target.querySelector('.piece')?'capture-hint':'hint');
    });
}
export function highlightCheck(sq) { if(sq) sq.classList.add('king-in-check'); }