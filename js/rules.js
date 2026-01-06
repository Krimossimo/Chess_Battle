// js/rules.js

// 1. Fonction principale : Vérifie si un coup est "Sûr" (ne met pas notre roi en échec)
export function isMoveSafe(startSquare, targetSquare, type, team) {
    // A. Vérifie d'abord si le mouvement est géométriquement valide (règles de base)
    if (!isValidGeometry(startSquare, targetSquare, type, team)) return false;

    // B. SIMULATION DU COUP
    const piece = startSquare.querySelector('.piece');
    if (!piece) return false; // Sécurité anti-crash

    const captured = targetSquare.querySelector('.piece'); // Pièce mangée potentielle
    
    // On joue le coup "pour de faux" dans le DOM
    targetSquare.appendChild(piece);
    if (captured) targetSquare.removeChild(captured); // On enlève temporairement la pièce mangée

    // C. Vérifie si le Roi est en danger après ce mouvement
    const myKingSquare = findKing(team);
    const enemyTeam = (team === 'white') ? 'black' : 'white';
    let isSafe = true;

    // Si on trouve le roi, on regarde s'il est attaqué
    if (myKingSquare && isSquareAttacked(myKingSquare, enemyTeam)) {
        isSafe = false;
    }

    // D. ANNULATION DU COUP (Restauration)
    startSquare.appendChild(piece); // On remet la pièce au départ
    if (captured) targetSquare.appendChild(captured); // On remet la pièce mangée (si elle existait)

    return isSafe;
}

// 2. Trouve la case du Roi
export function findKing(team) {
    const pieces = document.querySelectorAll('.piece');
    for (const p of pieces) {
        if (p.dataset.type === 'king' && p.dataset.team === team) {
            return p.parentElement;
        }
    }
    return null;
}

// 3. Vérifie si une case est attaquée par l'ennemi
export function isSquareAttacked(targetSquare, attackerTeam) {
    const allSquares = document.querySelectorAll('.square');
    
    for (const sq of allSquares) {
        const piece = sq.querySelector('.piece');
        // Si c'est une pièce ennemie
        if (piece && piece.dataset.team === attackerTeam) {
            // Est-ce qu'elle peut géométriquement atteindre la case cible ?
            if (isValidGeometry(sq, targetSquare, piece.dataset.type, attackerTeam)) {
                return true;
            }
        }
    }
    return false;
}

// 4. Moteur des règles de déplacement (Géométrie pure)
function isValidGeometry(start, target, type, team) {
    const sRow = +start.dataset.row;
    const sCol = +start.dataset.col;
    const tRow = +target.dataset.row;
    const tCol = +target.dataset.col;

    const dRow = tRow - sRow;
    const dCol = tCol - sCol;
    const absRow = Math.abs(dRow);
    const absCol = Math.abs(dCol);

    // Règle 0 : On ne mange pas ses amis
    const targetPiece = target.querySelector('.piece');
    if (targetPiece && targetPiece.dataset.team === team) return false;

    // PION
    if (type === 'pawn') {
        const direction = (team === 'white') ? -1 : 1; // Blanc monte (-1), Noir descend (+1)
        const startRow = (team === 'white') ? 6 : 1; 
        
        // Avance de 1
        if (dCol === 0 && dRow === direction && !targetPiece) return true;
        // Avance de 2 (depuis départ)
        if (dCol === 0 && dRow === direction * 2 && sRow === startRow && !targetPiece) {
            // Vérifier chemin bloqué
            const midRow = sRow + direction;
            const midSquare = document.querySelector(`.square[data-row="${midRow}"][data-col="${sCol}"]`);
            if (!midSquare.querySelector('.piece')) return true;
        }
        // Mange en diagonale
        if (absCol === 1 && dRow === direction && targetPiece) return true;
        
        return false;
    }

    // TOUR (Lignes)
    if (type === 'rook') {
        if (dRow !== 0 && dCol !== 0) return false; 
        return isPathClear(start, target);
    }

    // FOU (Diagonales)
    if (type === 'bishop') {
        if (absRow !== absCol) return false;
        return isPathClear(start, target);
    }

    // REINE (Tour + Fou)
    if (type === 'queen') {
        if (dRow !== 0 && dCol !== 0 && absRow !== absCol) return false;
        return isPathClear(start, target);
    }

    // CAVALIER (L)
    if (type === 'knight') {
        return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
    }

    // ROI (1 case)
    if (type === 'king') {
        return absRow <= 1 && absCol <= 1;
    }

    return false;
}

// Helper : Vérifie qu'il n'y a pas d'obstacle sur le chemin
function isPathClear(start, target) {
    const sRow = +start.dataset.row;
    const sCol = +start.dataset.col;
    const tRow = +target.dataset.row;
    const tCol = +target.dataset.col;

    const dRow = Math.sign(tRow - sRow);
    const dCol = Math.sign(tCol - sCol);

    let currRow = sRow + dRow;
    let currCol = sCol + dCol;

    while (currRow !== tRow || currCol !== tCol) {
        const square = document.querySelector(`.square[data-row="${currRow}"][data-col="${currCol}"]`);
        if (square && square.querySelector('.piece')) return false; // Obstacle !
        currRow += dRow;
        currCol += dCol;
    }
    return true;
}