// js/main.js
import { piecesInfo, initialBoardSetup } from './data.js';
// Note : on importe maintenant isMoveSafe, isSquareAttacked et findKing
import { isMoveSafe, isSquareAttacked, findKing } from './rules.js';

const boardElement = document.getElementById('chessBoard');
let selectedSquare = null;
let currentTurn = 'white';

function updateCard(symbol) {
    const info = piecesInfo[symbol];
    if (info) {
        document.getElementById('cardTitle').innerText = info.name;
        document.getElementById('cardDesc').innerText = info.desc;
        document.getElementById('cardAvatar').style.backgroundColor = info.color;
        document.getElementById('cardAvatar').innerText = symbol;
    }
}

// Fonction pour vérifier l'état des Rois (Echec ?)
function checkGameStatus() {
    // On retire les alertes rouges précédentes
    document.querySelectorAll('.square').forEach(sq => sq.classList.remove('king-in-check'));

    // On cherche le Roi de l'équipe qui doit jouer
    const kingSquare = findKing(currentTurn);
    
    // Qui est l'ennemi ?
    const enemyTeam = (currentTurn === 'white') ? 'black' : 'white';

    // Est-il attaqué ?
    if (isSquareAttacked(kingSquare, enemyTeam)) {
        kingSquare.classList.add('king-in-check');
        document.getElementById('cardTitle').innerText = "⚠️ ÉCHEC !";
        document.getElementById('cardDesc').innerText = "Sauvez le Roi " + currentTurn + " !";
        // Petit son d'alerte (optionnel)
        // new Audio('alert.mp3').play();
    }
}

function switchTurn() {
    currentTurn = (currentTurn === 'white') ? 'black' : 'white';
    
    document.getElementById('cardTitle').innerText = (currentTurn === 'white') ? "Tour des Blancs ♙" : "Tour des Noirs ♟";
    document.getElementById('cardDesc').innerText = "À vous de jouer !";
    document.getElementById('cardAvatar').innerText = "";
    document.getElementById('cardAvatar').style.backgroundColor = "#333";

    // À chaque changement de tour, on regarde si le nouveau joueur est en échec
    checkGameStatus();
}

function handleSquareClick(square) {
    const content = square.innerText;

    // CAS 1 : Déplacement
    if (selectedSquare) {
        const pieceSymbol = selectedSquare.innerText;
        
        // --- CHANGEMENT ICI : On utilise isMoveSafe ---
        // Cette fonction vérifie la géométrie ET si le Roi est protégé
        if (isMoveSafe(selectedSquare, square, pieceSymbol)) {
            
            // Mouvement validé
            if (square.innerText !== "") console.log("Capture !");

            square.innerText = pieceSymbol;
            square.innerHTML = selectedSquare.innerHTML; 
            
            selectedSquare.innerHTML = '';
            selectedSquare.classList.remove('selected');
            selectedSquare = null;

            switchTurn();
            
        } else {
            // Mouvement invalide (ou dangereux pour le Roi)
            if (content !== "") {
                const pieceData = piecesInfo[content];
                if (pieceData && pieceData.team === currentTurn) {
                    selectedSquare.classList.remove('selected');
                    selectedSquare = square;
                    square.classList.add('selected');
                    updateCard(content);
                }
            } else {
                // Petit effet visuel pour dire "Interdit !"
                square.classList.add('error-shake'); // (Tu peux ajouter cette anim en CSS si tu veux)
                setTimeout(() => square.classList.remove('error-shake'), 200);
            }
        }
    } 
    // CAS 2 : Sélection
    else {
        if (content !== "") {
            const pieceData = piecesInfo[content];
            if (pieceData && pieceData.team === currentTurn) {
                selectedSquare = square;
                square.classList.add('selected');
                updateCard(content);
            }
        }
    }
}

function createBoard() {
    boardElement.innerHTML = '';
    for (let i = 0; i < 64; i++) {
        const square = document.createElement('div');
        square.classList.add('square');
        const row = Math.floor(i / 8);
        const col = i % 8;
        square.dataset.row = row;
        square.dataset.col = col;

        if ((row + col) % 2 === 0) square.classList.add('white-square');
        else square.classList.add('black-square');

        const pieceSymbol = initialBoardSetup[i];
        if (pieceSymbol !== '') {
            const piece = document.createElement('span');
            piece.classList.add('piece');
            piece.innerText = pieceSymbol;
            square.appendChild(piece);
        }

        square.onclick = () => handleSquareClick(square);
        boardElement.appendChild(square);
    }
}

createBoard();