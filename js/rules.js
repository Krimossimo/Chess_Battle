// js/rules.js

function getPiece(square) {
    if (!square) return null;
    return square.querySelector('.piece');
}

/* ========================
   GÉOMÉTRIE
   ======================== */
function isGeometricMoveValid(start, end, type, team) {
    const sr = +start.dataset.row;
    const sc = +start.dataset.col;
    const er = +end.dataset.row;
    const ec = +end.dataset.col;

    const dr = er - sr;
    const dc = ec - sc;
    const ar = Math.abs(dr);
    const ac = Math.abs(dc);

    const targetPiece = getPiece(end);
    const empty = !targetPiece;

    function pathClear() {
        const stepR = Math.sign(dr);
        const stepC = Math.sign(dc);
        let r = sr + stepR;
        let c = sc + stepC;

        while (r !== er || c !== ec) {
            const sq = document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
            if (getPiece(sq)) return false;
            r += stepR;
            c += stepC;
        }
        return true;
    }

    /* ----- PION (CORRIGÉ) ----- */
    if (type === 'pawn') {
        const dir = team === 'white' ? -1 : 1;
        const startRow = team === 'white' ? 6 : 1;

        // Avance de 1
        if (dc === 0 && dr === dir && empty) return true;

        // Avance de 2
        if (dc === 0 && dr === dir * 2 && sr === startRow && empty && pathClear()) return true;

        // Capture (C'ÉTAIT ICI L'ERREUR : ac au lieu de ar)
        if (ac === 1 && dr === dir && !empty) return true;

        return false;
    }

    if (type === 'rook') return (dr === 0 || dc === 0) && pathClear();
    if (type === 'bishop') return ar === ac && pathClear();
    if (type === 'knight') return (ar === 2 && ac === 1) || (ar === 1 && ac === 2);
    if (type === 'queen') return ((dr === 0 || dc === 0) || ar === ac) && pathClear();
    if (type === 'king') return ar <= 1 && ac <= 1;

    return false;
}

/* ========================
   CASE ATTAQUÉE
   ======================== */
export function isSquareAttacked(square, team) {
    if (!square) return false; // Sécurité
    const squares = document.querySelectorAll('.square');

    for (const sq of squares) {
        const piece = getPiece(sq);
        if (piece && piece.dataset.team === team) {
            if (isGeometricMoveValid(sq, square, piece.dataset.type, piece.dataset.team)) {
                return true;
            }
        }
    }
    return false;
}

/* ========================
   TROUVER ROI
   ======================== */
export function findKing(team) {
    const squares = document.querySelectorAll('.square');
    for (const sq of squares) {
        const piece = getPiece(sq);
        // On vérifie bien que dataset.type existe
        if (piece && piece.dataset.type === 'king' && piece.dataset.team === team) {
            return sq;
        }
    }
    return null;
}

/* ========================
   COUP SÛR
   ======================== */
export function isMoveSafe(start, end, type, team) {
    if (!isGeometricMoveValid(start, end, type, team)) return false;

    const target = getPiece(end);
    // Interdit de manger son propre ami
    if (target && target.dataset.team === team) return false;

    const movingPiece = getPiece(start);
    const captured = target;

    // Simulation
    end.appendChild(movingPiece);
    if (captured) captured.remove();

    const kingSquare = findKing(team);
    
    // Si le roi n'existe pas (bug data), on annule par sécurité
    if (!kingSquare) {
        start.appendChild(movingPiece);
        if (captured) end.appendChild(captured);
        return false; 
    }

    const enemy = team === 'white' ? 'black' : 'white';
    const inCheck = isSquareAttacked(kingSquare, enemy);

    // Retour en arrière
    start.appendChild(movingPiece);
    if (captured) end.appendChild(captured);

    return !inCheck;
}