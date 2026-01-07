// js/ui.js
import { gameState, userState, soundEffects } from './js/state.js';

// DOM Elements
const victoryModal = document.getElementById('victoryModal');
const ultimateMatOverlay = document.getElementById('ultimateMatOverlay');
const historyContent = document.querySelector('.history-content');
const gameControls = document.getElementById('gameControls');
const promoModal = document.getElementById('promotionModal');

export function updateProfileUI(u) {
    if (u) { userState.points = u.points || 0; userState.pseudo = u.pseudo || 'Joueur'; }
    
    // Calcul Rang
    let rank = "BRONZE", rankIcon = '<i class="fas fa-shield-alt"></i>';
    if (userState.points >= 1500 && userState.points < 2000) { rank = "ARGENT"; rankIcon = '<i class="fas fa-medal"></i>'; }
    else if (userState.points >= 2000) { rank = "DIAMANT"; rankIcon = '<i class="fas fa-gem"></i>'; }

    // Update DOM
    document.getElementById('displayPseudo').innerText = userState.pseudo.toUpperCase();
    document.getElementById('displayPoints').innerText = userState.points;
    document.querySelector('.profile-rank').innerHTML = `${rankIcon} RANG ${rank}`;
    document.getElementById('playerPseudoDisplay').innerText = userState.pseudo.toUpperCase();
}

export function addMoveToHistory(piece, from, to) {
    const files = ['a','b','c','d','e','f','g','h'];
    let notation = files[to.dataset.col] + (8 - to.dataset.row);
    if(piece.dataset.type === 'knight') notation = 'N' + notation;
    else if(piece.dataset.type !== 'pawn') notation = piece.dataset.type.charAt(0).toUpperCase() + notation;

    if (gameState.currentTurn === 'white') {
        const div = document.createElement('div'); div.className = 'move-row';
        div.innerHTML = `<span>${gameState.moveCount}.</span><span>${notation}</span><span></span>`;
        historyContent.appendChild(div);
    } else {
        const rows = historyContent.querySelectorAll('.move-row');
        if (rows.length) rows[rows.length - 1].lastElementChild.innerText = notation;
        gameState.moveCount++;
    }
    const c = document.getElementById('moveHistory'); if(c) c.scrollTop = c.scrollHeight;
}

export function handleGameOver(winner, reason) {
    gameState.gameActive = false;
    clearInterval(gameState.timerInterval);
    if (reason === 'checkmate') triggerUltimateMatAnimation(winner);
    else showVictoryModal(winner, reason);
}

function triggerUltimateMatAnimation(winner) {
    gameControls.classList.add('hidden'); 
    try { soundEffects.mat.currentTime = 0; soundEffects.mat.play(); } catch(e) {}
    document.body.classList.add('screen-shake');
    if(ultimateMatOverlay) {
        ultimateMatOverlay.classList.remove('hidden');
        setTimeout(() => ultimateMatOverlay.classList.add('active'), 50);
        setTimeout(() => {
            document.body.classList.remove('screen-shake');
            ultimateMatOverlay.classList.remove('active');
            ultimateMatOverlay.classList.add('hidden');
            showVictoryModal(winner, 'checkmate');
        }, 4000);
    } else showVictoryModal(winner, 'checkmate');
}

function showVictoryModal(winner, reason) {
    victoryModal.classList.remove('hidden');
    const t = document.getElementById('victoryTitle'), r = document.getElementById('victoryReason');
    if (winner === 'draw') { t.innerText="MATCH NUL"; t.style.color="#7f8c8d"; r.innerText="Égalité."; }
    else if (winner === gameState.myColor || (!gameState.isOnline && winner)) { t.innerText="VICTOIRE !"; t.style.color="#27ae60"; r.innerText=reason==='checkmate'?"Échec et mat !":"Abandon."; }
    else { t.innerText="DÉFAITE..."; t.style.color="#c0392b"; r.innerText="Dommage."; }
}

export function showPromotionModal(callback) {
    promoModal.classList.remove('hidden');
    // Clone pour reset les listeners
    const old = document.querySelector('.promo-options');
    const newOpts = old.cloneNode(true);
    old.parentNode.replaceChild(newOpts, old);
    
    newOpts.querySelectorAll('.promo-option').forEach(o => {
        o.addEventListener('click', () => {
            promoModal.classList.add('hidden');
            callback(o.dataset.type);
        });
    });
}