// js/data.js

export const piecesInfo = {
    // BLANCS (Symboles Outline pour la logique)
    '♙': { name: "Pion Blanc", desc: "Le soldat de base.", color: "#eeeed2", type: 'pawn', team: 'white' },
    '♖': { name: "Tour Blanche", desc: "La forteresse.", color: "#eeeed2", type: 'rook', team: 'white' },
    '♘': { name: "Cavalier Blanc", desc: "Le sauteur.", color: "#eeeed2", type: 'knight', team: 'white' },
    '♗': { name: "Fou Blanc", desc: "Le prêtre.", color: "#eeeed2", type: 'bishop', team: 'white' },
    '♕': { name: "Reine Blanche", desc: "La guerrière.", color: "#eeeed2", type: 'queen', team: 'white' },
    '♔': { name: "Roi Blanc", desc: "Le chef.", color: "#eeeed2", type: 'king', team: 'white' },
    
    // NOIRS (Symboles Solid pour la logique)
    '♟': { name: "Pion Noir", desc: "Soldat des ténèbres.", color: "#515151", type: 'pawn', team: 'black' },
    '♜': { name: "Tour Noire", desc: "Forteresse sombre.", color: "#515151", type: 'rook', team: 'black' },
    '♞': { name: "Cavalier Noir", desc: "Cavalier de l'ombre.", color: "#515151", type: 'knight', team: 'black' },
    '♝': { name: "Fou Noir", desc: "Mage noir.", color: "#515151", type: 'bishop', team: 'black' },
    '♛': { name: "Reine Noire", desc: "La destructrice.", color: "#515151", type: 'queen', team: 'black' },
    '♚': { name: "Roi Noir", desc: "Le seigneur noir.", color: "#515151", type: 'king', team: 'black' }
};

export const initialBoardSetup = [
    '♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜',
    '♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙',
    '♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'
];