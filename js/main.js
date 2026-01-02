// js/main.js
import { piecesInfo, initialBoardSetup } from './data.js';
import { isMoveSafe, isSquareAttacked, findKing } from './rules.js';

const boardElement = document.getElementById('chessBoard');
let selectedSquare = null;
let currentTurn = 'white';

// --- MISE A JOUR UI ---
function updateCard(symbol) {
    const info = piecesInfo[symbol];
    if (info) {
        document.getElementById('cardTitle').innerText = info.name;
        document.getElementById('cardDesc').innerText = info.desc;
        // On remet la couleur du bois pour l'avatar car l'image est gérée par le CSS maintenant
        document.getElementById('cardAvatar').style.backgroundColor = "#bfa07a"; 
        
        // Petite astuce : on affiche le symbole dans l'avatar en utilisant le même style que les pièces
        // Mais pour faire simple ici, on affiche juste le texte, le CSS de la carte gèrera le reste
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
    if (kingSquare && isSquareAttacked(kingSquare, enemyTeam)) {
        kingSquare.classList.add('king-in-check');
        document.getElementById('cardTitle').innerText = "⚠️ ÉCHEC !";
        document.getElementById('cardDesc').innerText = "Sauvez le Roi " + currentTurn + " !";
    }
}

function switchTurn() {
    currentTurn = (currentTurn === 'white') ? 'black' : 'white';
    
    document.getElementById('cardTitle').innerText = (currentTurn === 'white') ? "Tour des Blancs ♙" : "Tour des Noirs ♟";
    document.getElementById('cardDesc').innerText = "À vous de jouer !";
    document.getElementById('cardAvatar').innerText = "";
    document.getElementById('cardAvatar').style.backgroundColor = "#bfa07a"; 

    // À chaque changement de tour, on regarde si le nouveau joueur est en échec
    checkGameStatus();
}

function handleSquareClick(square) {
    const content = square.innerText;

    // CAS 1 : Déplacement
    if (selectedSquare) {
        const pieceSymbol = selectedSquare.innerText;
        
        // Cette fonction vérifie la géométrie ET si le Roi est protégé
        if (isMoveSafe(selectedSquare, square, pieceSymbol)) {
            
            // Mouvement validé
            if (square.innerText !== "") console.log("Capture !");

            // On déplace le contenu HTML complet (pour garder les data-attributes et le style !)
            square.innerHTML = selectedSquare.innerHTML; 
            
            // On met à jour le texte (utile pour la logique JS)
            square.innerText = pieceSymbol; 
            
            // Nettoyage de l'ancienne case
            selectedSquare.innerHTML = '';
            selectedSquare.innerText = ''; // Important pour vider le texte logique
            selectedSquare.classList.remove('selected');
            selectedSquare = null;

            switchTurn();
            
        } else {
            // Mouvement invalide
            if (content !== "") {
                const pieceData = piecesInfo[content];
                if (pieceData && pieceData.team === currentTurn) {
                    selectedSquare.classList.remove('selected');
                    selectedSquare = square;
                    square.classList.add('selected');
                    updateCard(content);
                }
            } else {
                // Erreur visuelle
                square.classList.add('error-shake');
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

// --- INITIALISATION DU PLATEAU ---
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

            // --- C'EST ICI QUE TOUT SE JOUE POUR LE STYLE ---
            const pieceData = piecesInfo[pieceSymbol];
            if (pieceData) {
                 piece.dataset.team = pieceData.team; // 'white' ou 'black'
                 piece.dataset.type = pieceData.type; // 'pawn', 'rook', etc.
            }
            // -----------------------------------------------

            square.appendChild(piece);
        }

        square.onclick = () => handleSquareClick(square);
        boardElement.appendChild(square);
    }
}

// Lancement du plateau
createBoard();


// ==========================================
// LOGIQUE DU MENU
// ==========================================

const menuScreen = document.getElementById('menuScreen');
const gameScreen = document.getElementById('gameScreen');

// Fonction pour lancer le jeu
function startGame(timeControl) {
    console.log(`Lancement de la partie : ${timeControl}`);
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
}

// Fonction pour revenir au menu
function backToMenu() {
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
}

// Ecouteurs d'événements (Clicks)
// Le ?. permet d'éviter les erreurs si les boutons ne sont pas chargés
document.getElementById('btn10min')?.addEventListener('click', () => startGame('10min'));
document.getElementById('btn3min')?.addEventListener('click', () => startGame('3min'));

document.getElementById('btnShop')?.addEventListener('click', () => {
    alert("La boutique sera disponible bientôt ! Préparez vos ChessPoints.");
});

document.getElementById('backToMenu')?.addEventListener('click', backToMenu);