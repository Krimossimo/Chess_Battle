// js/main.js
import { piecesInfo, initialBoardSetup } from './data.js';
import { isMoveSafe, isSquareAttacked, findKing } from './rules.js';

const boardElement = document.getElementById('chessBoard');
let selectedSquare = null;
let currentTurn = 'white';

/* ========================
   HINTS
   ======================== */
function clearMoveHints() {
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('hint', 'capture-hint', 'selected');
    });
}

function showMoveHints(startSquare, pieceType, pieceTeam) {
    const allSquares = document.querySelectorAll('.square');
    allSquares.forEach(targetSquare => {
        if (isMoveSafe(startSquare, targetSquare, pieceType, pieceTeam)) {
            const targetPiece = targetSquare.querySelector('.piece');
            if (targetPiece) {
                targetSquare.classList.add('capture-hint');
            } else {
                targetSquare.classList.add('hint');
            }
        }
    });
}

/* ========================
   UI
   ======================== */
function updateCard(pieceType) {
    // Petite astuce pour retrouver l'info depuis les values
    const info = Object.values(piecesInfo).find(p => p.type === pieceType);
    if (!info) return;

    document.getElementById('cardTitle').innerText = info.name;
    document.getElementById('cardDesc').innerText = info.desc;
    document.getElementById('cardAvatar').style.backgroundColor = "#bfa07a";
    
    // Affiche le bon symbole visuel (Pion = ♟)
    const visualSymbol = (pieceType === 'pawn') ? '♟' : Object.keys(piecesInfo).find(key => piecesInfo[key] === info);
    document.getElementById('cardAvatar').innerText = visualSymbol || '♟';
}

function checkGameStatus() {
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('king-in-check');
    });
    const kingSquare = findKing(currentTurn);
    const enemyTeam = currentTurn === 'white' ? 'black' : 'white';
    if (kingSquare && isSquareAttacked(kingSquare, enemyTeam)) {
        kingSquare.classList.add('king-in-check');
    }
}

function switchTurn() {
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    clearMoveHints();
    checkGameStatus();
}

/* ========================
   DÉPLACEMENT
   ======================== */
function executeMove(startSquare, targetSquare) {
    const piece = startSquare.querySelector('.piece');
    if (!piece) return false;

    const pieceType = piece.dataset.type;
    const pieceTeam = piece.dataset.team;

    if (!isMoveSafe(startSquare, targetSquare, pieceType, pieceTeam)) {
        return false;
    }

    const captured = targetSquare.querySelector('.piece');
    if (captured) captured.remove();

    targetSquare.appendChild(piece);
    selectedSquare = null;
    switchTurn();
    return true;
}

/* ========================
   DRAG & DROP + CLICK
   ======================== */
function setupPieceEvents(piece, square) {
    piece.setAttribute('draggable', true);

    piece.addEventListener('dragstart', e => {
        if (piece.dataset.team !== currentTurn) {
            e.preventDefault();
            return;
        }
        selectedSquare = square;
        setTimeout(() => piece.classList.add('dragging'), 0);
        clearMoveHints();
        showMoveHints(square, piece.dataset.type, piece.dataset.team);
        updateCard(piece.dataset.type);
    });

    piece.addEventListener('dragend', () => {
        piece.classList.remove('dragging');
        clearMoveHints();
    });
}

function handleSquareEvents(square) {
    square.addEventListener('dragover', e => e.preventDefault());

    square.addEventListener('drop', e => {
        e.preventDefault();
        // Le closest permet de trouver la case même si on lâche sur un enfant
        const target = e.target.closest('.square'); 
        if (selectedSquare && target) executeMove(selectedSquare, target);
    });

    square.addEventListener('click', (e) => {
        // Clic robuste via closest
        const clickedSquare = e.target.closest('.square');
        if (!clickedSquare) return;
        
        const piece = clickedSquare.querySelector('.piece');

        if (selectedSquare && selectedSquare !== clickedSquare) {
            if (!executeMove(selectedSquare, clickedSquare)) {
                if (piece && piece.dataset.team === currentTurn) {
                    clearMoveHints();
                    selectedSquare = clickedSquare;
                    clickedSquare.classList.add('selected');
                    showMoveHints(clickedSquare, piece.dataset.type, piece.dataset.team);
                    updateCard(piece.dataset.type);
                }
            }
        } else if (piece && piece.dataset.team === currentTurn) {
            clearMoveHints();
            selectedSquare = clickedSquare;
            clickedSquare.classList.add('selected');
            showMoveHints(clickedSquare, piece.dataset.type, piece.dataset.team);
            updateCard(piece.dataset.type);
        }
    });
}

/* ========================
   CRÉATION DU PLATEAU
   ======================== */
function createBoard() {
    boardElement.innerHTML = '';

    for (let i = 0; i < 64; i++) {
        const square = document.createElement('div');
        square.classList.add('square');

        const row = Math.floor(i / 8);
        const col = i % 8;
        square.dataset.row = row;
        square.dataset.col = col;

        square.classList.add((row + col) % 2 === 0 ? 'white-square' : 'black-square');

        const symbol = initialBoardSetup[i];
        if (symbol !== '') {
            const pieceData = piecesInfo[symbol];
            if (pieceData) { // Vérif sécurité
                const piece = document.createElement('span');
                piece.classList.add('piece');
                piece.dataset.type = pieceData.type;
                piece.dataset.team = pieceData.team;
                piece.setAttribute('data-content', symbol);

                setupPieceEvents(piece, square);
                square.appendChild(piece);
            }
        }

        handleSquareEvents(square);
        boardElement.appendChild(square);
    }
}
createBoard();

// Menu Logic
const menuScreen = document.getElementById('menuScreen');
const gameScreen = document.getElementById('gameScreen');
function startGame() {
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
}
function backToMenu() {
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
}
document.getElementById('btn10min')?.addEventListener('click', startGame);
document.getElementById('btn3min')?.addEventListener('click', startGame);
document.getElementById('backToMenu')?.addEventListener('click', backToMenu);