// js/state.js
export const gameState = {
    selectedSquare: null,
    currentTurn: 'white',
    isVsAI: false,
    aiLevel: 'easy',
    moveCount: 1,
    gameActive: false,
    isOnline: false,
    onlineGameId: null,
    myColor: 'white',
    gameUnsubscribe: null,
    timeWhite: 600,
    timeBlack: 600,
    timerInterval: null
};

export const userState = {
    points: 0,
    pseudo: 'Joueur',
    inventory: ['board_wood', 'skin_classic'],
    equipped: { board: 'board_wood', skin: 'skin_classic' }
};

export const soundEffects = {
    mat: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3')
};
soundEffects.mat.volume = 0.5;