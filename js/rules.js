// js/rules.js
import { piecesInfo } from './data.js';

// --- 1. VALIDATION GÉOMÉTRIQUE (La pièce bouge-t-elle correctement ?) ---
// C'est l'ancienne fonction "isMoveValid", renommée pour être plus précis
function isGeometricMoveValid(startCase, endCase, pieceSymbol) {
    const pieceData = piecesInfo[pieceSymbol];
    if (!pieceData) return false;

    // Coordonnées
    const startRow = parseInt(startCase.dataset.row);
    const startCol = parseInt(startCase.dataset.col);
    const endRow = parseInt(endCase.dataset.row);
    const endCol = parseInt(endCase.dataset.col);

    const diffRow = endRow - startRow;
    const diffCol = endCol - startCol;
    const absRow = Math.abs(diffRow);
    const absCol = Math.abs(diffCol);

    const targetContent = endCase.innerText;
    const isTargetEmpty = targetContent === "";
    const isCapture = !isTargetEmpty;

    // Vérification : Chemin libre (sauf Cavalier)
    function isPathClear() {
        const dRow = Math.sign(diffRow);
        const dCol = Math.sign(diffCol);
        let currentRow = startRow + dRow;
        let currentCol = startCol + dCol;

        while (currentRow !== endRow || currentCol !== endCol) {
            const square = document.querySelector(`[data-row="${currentRow}"][data-col="${currentCol}"]`);
            if (square.innerText !== "") return false;
            currentRow += dRow;
            currentCol += dCol;
        }
        return true;
    }

    // --- RÈGLES PAR PIÈCE ---
    
    // PION
    if (pieceData.type === 'pawn') {
        const direction = (pieceData.team === 'white') ? -1 : 1;
        const startRowForDouble = (pieceData.team === 'white') ? 6 : 1;

        // Avance de 1
        if (diffCol === 0 && diffRow === direction && isTargetEmpty) return true;
        // Avance de 2
        if (diffCol === 0 && diffRow === direction * 2 && startRow === startRowForDouble && isTargetEmpty) return isPathClear();
        // Capture diagonale
        if (absCol === 1 && diffRow === direction && isCapture) return true;
        return false;
    }

    // TOUR
    if (pieceData.type === 'rook') {
        if (diffRow === 0 || diffCol === 0) return isPathClear();
        return false;
    }

    // FOU
    if (pieceData.type === 'bishop') {
        if (absRow === absCol) return isPathClear();
        return false;
    }

    // CAVALIER (Saute, pas de isPathClear)
    if (pieceData.type === 'knight') {
        return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
    }

    // REINE
    if (pieceData.type === 'queen') {
        if ((diffRow === 0 || diffCol === 0) || (absRow === absCol)) return isPathClear();
        return false;
    }

    // ROI
    if (pieceData.type === 'king') {
        return absRow <= 1 && absCol <= 1;
    }

    return false;
}

// --- 2. DÉTECTION D'ATTAQUE (Est-ce que cette case est menacée ?) ---
export function isSquareAttacked(square, attackingTeam) {
    // On regarde TOUTES les cases du plateau
    const allSquares = document.querySelectorAll('.square');
    
    for (const attackerSquare of allSquares) {
        const attackerSymbol = attackerSquare.innerText;
        
        // Si c'est une pièce ennemie
        if (attackerSymbol !== "") {
            const attackerData = piecesInfo[attackerSymbol];
            if (attackerData && attackerData.team === attackingTeam) {
                // Est-ce qu'elle peut géométriquement manger notre case cible ?
                if (isGeometricMoveValid(attackerSquare, square, attackerSymbol)) {
                    return true; // OUI, la case est attaquée !
                }
            }
        }
    }
    return false;
}

// --- 3. TROUVER LE ROI ---
export function findKing(team) {
    const allSquares = document.querySelectorAll('.square');
    for (const square of allSquares) {
        const content = square.innerText;
        if (content !== "") {
            const data = piecesInfo[content];
            if (data && data.type === 'king' && data.team === team) {
                return square;
            }
        }
    }
    return null;
}

// --- 4. LA FONCTION FINALE : VALIDATION DE SÉCURITÉ ---
// C'est celle-ci qu'on appelle depuis main.js
export function isMoveSafe(startCase, endCase, pieceSymbol) {
    
    // A. Vérifier d'abord si le mouvement est géométriquement possible
    if (!isGeometricMoveValid(startCase, endCase, pieceSymbol)) return false;

    // B. Vérifier le "Tir Ami"
    const targetContent = endCase.innerText;
    const pieceData = piecesInfo[pieceSymbol];
    if (targetContent !== "") {
        const targetData = piecesInfo[targetContent];
        if (targetData && targetData.team === pieceData.team) return false;
    }

    // C. SIMULATION (Le Cerveau)
    // On joue le coup "pour de faux" pour voir ce qui se passe
    
    // 1. Sauvegarder l'état actuel
    const originalStartHTML = startCase.innerHTML;
    const originalEndHTML = endCase.innerHTML;
    const originalStartText = startCase.innerText;
    const originalEndText = endCase.innerText;

    // 2. Jouer le coup virtuellement
    endCase.innerText = pieceSymbol; // On pose la pièce
    startCase.innerText = "";        // On vide le départ
    
    // 3. Trouver notre Roi
    const myKingSquare = findKing(pieceData.team);
    
    // 4. Est-ce que le Roi est attaqué MAINTENANT ?
    // L'ennemi, c'est l'équipe adverse
    const enemyTeam = (pieceData.team === 'white') ? 'black' : 'white';
    const isCheck = isSquareAttacked(myKingSquare, enemyTeam);

    // 5. ANNULER LA SIMULATION (Rembobiner le temps)
    // On remet tout exactement comme avant, l'utilisateur n'a rien vu
    startCase.innerHTML = originalStartHTML;
    endCase.innerHTML = originalEndHTML;
    // (Important de remettre innerText pour que la logique JS reste synchro)
    startCase.innerText = originalStartText;
    endCase.innerText = originalEndText;

    // Si le roi était en échec dans la simulation, le coup est INTERDIT
    if (isCheck) {
        return false;
    }

    return true; // Le coup est sûr !
}