// js/rules.js

function getPiece(square) {
    if (!square) return null;
    return square.querySelector('.piece');
}

export function isGeometricMoveValid(start, end, type, team) {
    const sr = +start.dataset.row; const sc = +start.dataset.col;
    const er = +end.dataset.row; const ec = +end.dataset.col;
    const dr = er - sr; const dc = ec - sc;
    const ar = Math.abs(dr); const ac = Math.abs(dc);
    const targetPiece = getPiece(end);
    const empty = !targetPiece;

    function pathClear() {
        const stepR = Math.sign(dr); const stepC = Math.sign(dc);
        let r = sr + stepR; let c = sc + stepC;
        while (r !== er || c !== ec) {
            const sq = document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
            if (getPiece(sq)) return false;
            r += stepR; c += stepC;
        }
        return true;
    }

    // PION
    if (type === 'pawn') {
        const dir = team === 'white' ? -1 : 1;
        const startRow = team === 'white' ? 6 : 1;
        // Avance 1
        if (dc === 0 && dr === dir && empty) return true;
        // Avance 2
        if (dc === 0 && dr === dir * 2 && sr === startRow && empty && pathClear()) return true;
        // Capture (Diagonale) - CORRIGÉ (ac === 1)
        if (ac === 1 && dr === dir && !empty) return true;
        return false;
    }

    // ROI & ROQUE
    if (type === 'king') {
        if (ar <= 1 && ac <= 1) return true;
        // Roque
        if (ar === 0 && ac === 2) {
            const piece = getPiece(start);
            if (piece.dataset.moved === "true") return false;
            // Petit Roque
            if (dc === 2) { 
                const rook = getPiece(document.querySelector(`.square[data-row="${sr}"][data-col="7"]`));
                if (rook && rook.dataset.moved !== "true" && pathClear()) return true;
            }
            // Grand Roque
            if (dc === -2) {
                const rook = getPiece(document.querySelector(`.square[data-row="${sr}"][data-col="0"]`));
                // Vérifier si b1/b8 est vide aussi
                const bColEmpty = !getPiece(document.querySelector(`.square[data-row="${sr}"][data-col="1"]`));
                if (rook && rook.dataset.moved !== "true" && pathClear() && bColEmpty) return true;
            }
        }
        return false;
    }

    if (type === 'rook') return (dr === 0 || dc === 0) && pathClear();
    if (type === 'bishop') return ar === ac && pathClear();
    if (type === 'knight') return (ar === 2 && ac === 1) || (ar === 1 && ac === 2);
    if (type === 'queen') return ((dr === 0 || dc === 0) || ar === ac) && pathClear();
    return false;
}

export function isSquareAttacked(square, team) {
    if (!square) return false;
    const squares = document.querySelectorAll('.square');
    for (const sq of squares) {
        const piece = getPiece(sq);
        if (piece && piece.dataset.team === team) {
            if (isGeometricMoveValid(sq, square, piece.dataset.type, piece.dataset.team)) return true;
        }
    }
    return false;
}

export function findKing(team) {
    const squares = document.querySelectorAll('.square');
    for (const sq of squares) {
        const piece = getPiece(sq);
        if (piece && piece.dataset.type === 'king' && piece.dataset.team === team) return sq;
    }
    return null;
}

export function isMoveSafe(start, end, type, team) {
    if (!isGeometricMoveValid(start, end, type, team)) return false;
    const target = getPiece(end);
    if (target && target.dataset.team === team) return false;

    // Simulation
    const movingPiece = getPiece(start);
    const captured = target;
    end.appendChild(movingPiece);
    if (captured) captured.remove();

    const kingSquare = findKing(team);
    // Sécurité si roi mangé
    if (!kingSquare) {
        start.appendChild(movingPiece);
        if (captured) end.appendChild(captured);
        return false;
    }

    const enemy = team === 'white' ? 'black' : 'white';
    const inCheck = isSquareAttacked(kingSquare, enemy);

    // Revert
    start.appendChild(movingPiece);
    if (captured) end.appendChild(captured);

    return !inCheck;
}