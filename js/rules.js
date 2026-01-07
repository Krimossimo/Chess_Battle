// js/rules.js
export function isMoveSafe(start, target, type, team) {
    if (!isValidGeometry(start, target, type, team)) return false;
    
    // Simulation
    const p = start.querySelector('.piece');
    const c = target.querySelector('.piece');
    target.appendChild(p);
    if(c) target.removeChild(c); // On enlève temporairement

    const king = findKing(team);
    const enemy = team === 'white' ? 'black' : 'white';
    const safe = !isSquareAttacked(king, enemy);

    // Annulation
    start.appendChild(p);
    if(c) target.appendChild(c);

    return safe;
}

export function findKing(team) {
    return Array.from(document.querySelectorAll('.piece'))
        .find(p => p.dataset.type === 'king' && p.dataset.team === team)
        ?.parentElement;
}

export function isSquareAttacked(targetSq, attackerTeam) {
    if(!targetSq) return false;
    const attackers = document.querySelectorAll(`.piece[data-team="${attackerTeam}"]`);
    for (const p of attackers) {
        if (isValidGeometry(p.parentElement, targetSq, p.dataset.type, attackerTeam)) return true;
    }
    return false;
}

function isValidGeometry(s, t, type, team) {
    const sr=+s.dataset.row, sc=+s.dataset.col, tr=+t.dataset.row, tc=+t.dataset.col;
    const dr=tr-sr, dc=tc-sc, ar=Math.abs(dr), ac=Math.abs(dc);
    const tP = t.querySelector('.piece');
    if(tP && tP.dataset.team === team) return false; // Friendly fire

    if(type==='pawn') {
        const dir = team==='white' ? -1 : 1;
        const startRow = team==='white' ? 6 : 1;
        if(dc===0 && dr===dir && !tP) return true;
        if(dc===0 && dr===dir*2 && sr===startRow && !tP && !document.querySelector(`.square[data-row="${sr+dir}"][data-col="${sc}"] .piece`)) return true;
        if(ac===1 && dr===dir && tP) return true;
        return false;
    }
    if(type==='rook') return (dr===0 || dc===0) && isPathClear(s,t);
    if(type==='bishop') return (ar===ac) && isPathClear(s,t);
    if(type==='queen') return (dr===0 || dc===0 || ar===ac) && isPathClear(s,t);
    if(type==='knight') return (ar===2 && ac===1) || (ar===1 && ac===2);
    if(type==='king') return ar<=1 && ac<=1;
    return false;
}

function isPathClear(s, t) {
    const sr=+s.dataset.row, sc=+s.dataset.col, tr=+t.dataset.row, tc=+t.dataset.col;
    const dr=Math.sign(tr-sr), dc=Math.sign(tc-sc);
    let r=sr+dr, c=sc+dc;
    while(r!==tr || c!==tc) {
        if(document.querySelector(`.square[data-row="${r}"][data-col="${c}"] .piece`)) return false;
        r+=dr; c+=dc;
    }
    return true;
}