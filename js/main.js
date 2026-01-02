// js/main.js
import { piecesInfo, initialBoardSetup } from './data.js';
import { isMoveSafe, isSquareAttacked, findKing } from './rules.js';

const boardElement = document.getElementById('chessBoard');
const promoModal = document.getElementById('promotionModal');
const difficultyModal = document.getElementById('difficultyModal');

// ELEMENTS DU TIMER & HUD
const timerWhiteEl = document.getElementById('timerWhite');
const timerBlackEl = document.getElementById('timerBlack');
const graveyardWhite = document.getElementById('graveyardWhite');
const graveyardBlack = document.getElementById('graveyardBlack');

let selectedSquare = null;
let currentTurn = 'white';
let promotionCallback = null;
let isVsAI = false;
let aiLevel = 'easy';

// TIME
let timeWhite = 600;
let timeBlack = 600;
let timerInterval = null;
let gameActive = false;

/* ========================
   TIMER & SCORE
   ======================== */
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
    
    if (currentTurn === 'white') {
        timerWhiteEl.classList.add('active'); timerBlackEl.classList.remove('active');
    } else {
        timerBlackEl.classList.add('active'); timerWhiteEl.classList.remove('active');
    }

    timerInterval = setInterval(() => {
        if (currentTurn === 'white') {
            timeWhite--;
            if (timeWhite <= 0) endGame('black');
        } else {
            timeBlack--;
            if (timeBlack <= 0) endGame('white');
        }
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    timerWhiteEl.innerText = formatTime(timeWhite);
    timerBlackEl.innerText = formatTime(timeBlack);
}
function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}
function endGame(winner) {
    gameActive = false;
    clearInterval(timerInterval);
    timerWhiteEl.classList.remove('active');
    timerBlackEl.classList.remove('active');
    alert(`Temps écoulé ! ${winner === 'white' ? 'Blancs' : 'Noirs'} gagnent !`);
}

function addToGraveyard(pieceElement) {
    const deadPiece = document.createElement('div');
    deadPiece.classList.add('dead-piece');
    deadPiece.dataset.team = pieceElement.dataset.team;
    
    // On force l'apparence du pion si besoin
    let content = pieceElement.getAttribute('data-content');
    if (pieceElement.dataset.type === 'pawn') content = '♟';
    deadPiece.innerText = content;

    // Si je suis Blanc et je mange du Noir -> Dans mon cimetière
    if (pieceElement.dataset.team === 'black') graveyardWhite.appendChild(deadPiece);
    else graveyardBlack.appendChild(deadPiece);
}

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
            if (targetPiece) targetSquare.classList.add('capture-hint');
            else targetSquare.classList.add('hint');
        }
    });
}

/* ========================
   IA LOGIC
   ======================== */
function getAllLegalMoves(team) {
    const moves = [];
    document.querySelectorAll('.square').forEach(sourceSquare => {
        const piece = sourceSquare.querySelector('.piece');
        if (piece && piece.dataset.team === team) {
            document.querySelectorAll('.square').forEach(targetSquare => {
                if (isMoveSafe(sourceSquare, targetSquare, piece.dataset.type, team)) {
                    moves.push({
                        from: sourceSquare, to: targetSquare, piece: piece,
                        capture: targetSquare.querySelector('.piece')
                    });
                }
            });
        }
    });
    return moves;
}

function playAI() {
    if (currentTurn !== 'black' || !gameActive) return;
    const moves = getAllLegalMoves('black');
    if (moves.length === 0) return;

    let selectedMove = null;
    if (aiLevel === 'easy') {
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
    } else if (aiLevel === 'medium') {
        const captures = moves.filter(m => m.capture);
        selectedMove = captures.length > 0 ? captures[Math.floor(Math.random() * captures.length)] : moves[Math.floor(Math.random() * moves.length)];
    } else if (aiLevel === 'hard') {
        const values = { 'pawn': 1, 'knight': 3, 'bishop': 3, 'rook': 5, 'queen': 9, 'king': 100 };
        moves.sort((a, b) => {
            let scoreA = a.capture ? (values[a.capture.dataset.type] || 0) * 10 : 0;
            let scoreB = b.capture ? (values[b.capture.dataset.type] || 0) * 10 : 0;
            return scoreB - scoreA;
        });
        const bestMoves = moves.filter(m => {
            const score = m.capture ? (values[m.capture.dataset.type] || 0) : 0;
            return score === (moves[0].capture ? (values[moves[0].capture.dataset.type] || 0) * 10 : 0);
        });
        selectedMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    if (selectedMove) {
        setTimeout(() => executeMove(selectedMove.from, selectedMove.to), 500);
    }
}

/* ========================
   UI
   ======================== */
function updateCard(pieceType) {
    const info = Object.values(piecesInfo).find(p => p.type === pieceType);
    if (!info) return;
    document.getElementById('cardTitle').innerText = info.name;
    document.getElementById('cardDesc').innerText = info.desc;
    document.getElementById('cardAvatar').style.backgroundColor = "#bfa07a";
    const visualSymbol = (pieceType === 'pawn') ? '♟' : Object.keys(piecesInfo).find(key => piecesInfo[key] === info);
    document.getElementById('cardAvatar').innerText = visualSymbol || '♟';
}
function checkGameStatus() {
    document.querySelectorAll('.square').forEach(sq => sq.classList.remove('king-in-check'));
    const kingSquare = findKing(currentTurn);
    const enemyTeam = currentTurn === 'white' ? 'black' : 'white';
    if (kingSquare && isSquareAttacked(kingSquare, enemyTeam)) {
        kingSquare.classList.add('king-in-check');
        document.getElementById('cardTitle').innerText = "⚠️ ÉCHEC !";
    }
}
function switchTurn() {
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    clearMoveHints();
    document.getElementById('cardTitle').innerText = (currentTurn === 'white') ? "Tour des Blancs" : "Tour des Noirs";
    checkGameStatus();
    startTurnTimer();
    if (currentTurn === 'black' && isVsAI) playAI();
}

/* ========================
   EXECUTE MOVE
   ======================== */
function executeMove(startSquare, targetSquare) {
    const piece = startSquare.querySelector('.piece');
    if (!piece) return false;
    const pieceType = piece.dataset.type;
    const pieceTeam = piece.dataset.team;

    if (!isMoveSafe(startSquare, targetSquare, pieceType, pieceTeam)) return false;

    // Roque
    if (pieceType === 'king' && Math.abs(startSquare.dataset.col - targetSquare.dataset.col) === 2) {
        targetSquare.appendChild(piece);
        const row = startSquare.dataset.row;
        const isKingSide = targetSquare.dataset.col > startSquare.dataset.col;
        const rookCol = isKingSide ? 7 : 0;
        const newRookCol = isKingSide ? 5 : 3;
        const rookSquare = document.querySelector(`.square[data-row="${row}"][data-col="${rookCol}"]`);
        const rookDest = document.querySelector(`.square[data-row="${row}"][data-col="${newRookCol}"]`);
        const rook = rookSquare?.querySelector('.piece');
        if (rook) {
            rookDest.appendChild(rook);
            rook.dataset.moved = "true";
        }
    } else {
        // Capture
        const captured = targetSquare.querySelector('.piece');
        if (captured) {
            addToGraveyard(captured); // Ajout au cimetière
            captured.remove();
        }
        targetSquare.appendChild(piece);
    }
    piece.dataset.moved = "true";

    // Promotion
    if (pieceType === 'pawn') {
        const endRow = +targetSquare.dataset.row;
        if ((pieceTeam === 'white' && endRow === 0) || (pieceTeam === 'black' && endRow === 7)) {
            handlePromotion(piece, targetSquare);
            selectedSquare = null;
            return true;
        }
    }

    selectedSquare = null;
    switchTurn();
    return true;
}

function handlePromotion(pawn, square) {
    if (isVsAI && currentTurn === 'black') {
         pawn.dataset.type = 'queen';
         pawn.setAttribute('data-content', '♛');
         switchTurn(); return;
    }
    promoModal.classList.remove('hidden');
    promotionCallback = (type) => {
        pawn.dataset.type = type;
        let symbol = '';
        if(type === 'queen') symbol = '♛';
        if(type === 'rook') symbol = '♜';
        if(type === 'bishop') symbol = '♝';
        if(type === 'knight') symbol = '♞';
        pawn.setAttribute('data-content', symbol);
        promoModal.classList.add('hidden');
        switchTurn();
    };
}
document.querySelectorAll('.promo-option').forEach(opt => {
    opt.addEventListener('click', () => { if (promotionCallback) promotionCallback(opt.dataset.type); });
});

/* ========================
   EVENTS & DRAG DROP
   ======================== */
function setupPieceEvents(piece, square) {
    piece.setAttribute('draggable', true);
    piece.addEventListener('dragstart', e => {
        if (isVsAI && piece.dataset.team === 'black') { e.preventDefault(); return; }
        if (piece.dataset.team !== currentTurn) { e.preventDefault(); return; }
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
    // PERMET DE LÂCHER SUR UNE PIÈCE ADVERSE
    piece.addEventListener('dragover', e => e.preventDefault());
    piece.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        const targetSquare = piece.parentElement;
        if (selectedSquare && targetSquare) executeMove(selectedSquare, targetSquare);
    });
}

function handleSquareEvents(square) {
    square.addEventListener('dragover', e => e.preventDefault());
    square.addEventListener('drop', e => {
        e.preventDefault();
        const target = e.target.closest('.square'); 
        if (selectedSquare && target) executeMove(selectedSquare, target);
    });
    square.addEventListener('click', (e) => {
        if (isVsAI && currentTurn === 'black') return;
        const clickedSquare = e.target.closest('.square');
        if (!clickedSquare) return;
        const piece = clickedSquare.querySelector('.piece');
        if (selectedSquare && selectedSquare !== clickedSquare) {
            if (!executeMove(selectedSquare, clickedSquare)) {
                if (piece && piece.dataset.team === currentTurn) {
                    clearMoveHints(); selectedSquare = clickedSquare; clickedSquare.classList.add('selected');
                    showMoveHints(clickedSquare, piece.dataset.type, piece.dataset.team); updateCard(piece.dataset.type);
                }
            }
        } else if (piece && piece.dataset.team === currentTurn) {
            clearMoveHints(); selectedSquare = clickedSquare; clickedSquare.classList.add('selected');
            showMoveHints(clickedSquare, piece.dataset.type, piece.dataset.team); updateCard(piece.dataset.type);
        }
    });
}

/* ========================
   INIT
   ======================== */
function createBoard() {
    boardElement.innerHTML = '';
    graveyardWhite.innerHTML = ''; graveyardBlack.innerHTML = '';
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

// START
function startGame(mode, difficultyOrTime) {
    createBoard();
    let minutes = 10;
    if (difficultyOrTime === '3min') minutes = 3;
    isVsAI = (mode === 'ai');
    if (isVsAI) aiLevel = difficultyOrTime;
    
    startTimers(minutes);
    currentTurn = 'white';
    menuScreen.classList.add('hidden');
    difficultyModal.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    updateCard('king');
}
function backToMenu() {
    gameActive = false;
    clearInterval(timerInterval);
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
}
document.getElementById('btn10min')?.addEventListener('click', () => startGame('pvp', 10));
document.getElementById('btn3min')?.addEventListener('click', () => startGame('pvp', '3min'));
document.getElementById('btnAI')?.addEventListener('click', () => difficultyModal.classList.remove('hidden'));
document.querySelectorAll('.ai-option').forEach(btn => btn.addEventListener('click', () => startGame('ai', btn.dataset.level)));
document.getElementById('backToMenu')?.addEventListener('click', backToMenu);