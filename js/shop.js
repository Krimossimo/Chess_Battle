// js/shop.js
import { userState } from './state.js';
import { updateProfileUI } from '../ui.js';

const shopItems = [
    { id: 'board_wood', type: 'board', name: 'Bois Classique', price: 0, icon: '🟫', color: '#5d4037' },
    { id: 'board_forest', type: 'board', name: 'Forêt Elfique', price: 500, icon: '🌲', color: '#27ae60' },
    { id: 'board_ice', type: 'board', name: 'Toundra Glacée', price: 1000, icon: '❄️', color: '#3498db' },
    { id: 'board_lava', type: 'board', name: 'Volcan', price: 2500, icon: '🔥', color: '#c0392b' },
    { id: 'skin_classic', type: 'skin', name: 'Pièces Standard', price: 0, icon: '♟️' },
    { id: 'skin_gold', type: 'skin', name: 'Armée Dorée', price: 5000, icon: '👑' }
];

export function renderShop(cat = 'board') {
    const c = document.getElementById('shopContainer'); if(!c) return;
    c.innerHTML = '';
    shopItems.filter(i => i.type === cat).forEach(item => {
        const owned = userState.inventory.includes(item.id);
        const card = document.createElement('div'); card.className = `item-card ${owned?'owned':''}`;
        const btn = owned ? `<button class="action-btn btn-disabled">POSSÉDÉ</button>` 
            : `<button class="action-btn ${userState.points>=item.price?'btn-buy':'btn-disabled'}">ACHETER ${item.price}$</button>`;
        card.innerHTML = `${owned?'<div class="owned-badge">ACQUIS</div>':''}<div class="item-icon">${item.icon}</div><div class="item-name">${item.name}</div>${btn}`;
        c.appendChild(card);
        if(!owned && userState.points>=item.price) card.querySelector('button').onclick = () => buy(item);
    });
}

export function renderCollection() {
    const c = document.getElementById('collectionContainer'); if(!c) return;
    c.innerHTML = '';
    shopItems.filter(i => userState.inventory.includes(i.id)).forEach(item => {
        const equipped = userState.equipped[item.type] === item.id;
        const card = document.createElement('div'); card.className = `item-card ${equipped?'equipped':''}`;
        card.innerHTML = `<div class="item-icon">${item.icon}</div><div class="item-name">${item.name}</div><button class="action-btn ${equipped?'btn-equipped':'btn-equip'}">${equipped?'ÉQUIPÉ':'ÉQUIPER'}</button>`;
        c.appendChild(card);
        if(!equipped) card.querySelector('button').onclick = () => equip(item);
    });
}

function buy(item) {
    if(confirm(`Acheter ${item.name}?`)) {
        userState.points -= item.price; userState.inventory.push(item.id);
        updateProfileUI(); renderShop(item.type); alert("Achat réussi !");
    }
}

function equip(item) {
    userState.equipped[item.type] = item.id;
    if(item.color) document.querySelector('.board-frame').style.backgroundColor = item.color;
    renderCollection();
}