// js/social.js
import { db, auth, collection, query, where, getDocs, updateDoc, doc, arrayUnion, arrayRemove, onSnapshot, getDoc } from './firebase.js';

const socialModal = document.getElementById('socialModal');
const btnSocial = document.getElementById('btnSocial');
const closeSocial = document.getElementById('closeSocial');
const feedback = document.getElementById('socialFeedback');
const notifBadge = document.getElementById('notifBadge');

let currentUser = null;

// Initialisation (appelée depuis main.js)
export function initSocialSystem(user) {
    currentUser = user;
    
    // Ecouteur pour ouvrir/fermer
    if(btnSocial) btnSocial.addEventListener('click', () => socialModal.classList.remove('hidden'));
    if(closeSocial) closeSocial.addEventListener('click', () => socialModal.classList.add('hidden'));

    // Ecouteur Recherche
    document.getElementById('btnSearchFriend').addEventListener('click', sendFriendRequest);

    // Lancer l'écoute en temps réel des données utilisateur
    listenToUserData();
}

// 1. ÉCOUTER MES DONNÉES EN TEMPS RÉEL (Si je reçois une demande)
function listenToUserData() {
    onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
        const data = docSnap.data();
        currentUser = data; // Mise à jour locale
        
        updateRequestsUI(data.friendRequests || []);
        updateFriendsUI(data.friends || []);
    });
}

// 2. ENVOYER UNE DEMANDE
async function sendFriendRequest() {
    const targetPseudo = document.getElementById('searchFriendInput').value.trim();
    if(targetPseudo === currentUser.pseudo) { feedback.innerText = "C'est vous !"; return; }

    try {
        feedback.style.color = "black"; feedback.innerText = "Recherche...";
        
        // Trouver l'ID du joueur via son pseudo
        const q = query(collection(db, "users"), where("pseudo", "==", targetPseudo));
        const snap = await getDocs(q);

        if(snap.empty) { feedback.style.color = "red"; feedback.innerText = "Joueur introuvable."; return; }

        const targetDoc = snap.docs[0];
        const targetId = targetDoc.id;

        // Vérif si déjà ami ou demande envoyée
        if(currentUser.friends && currentUser.friends.includes(targetId)) {
            feedback.style.color = "orange"; feedback.innerText = "Vous êtes déjà amis."; return;
        }

        // Envoyer la demande (Ajouter mon ID dans son tableau 'friendRequests')
        await updateDoc(doc(db, "users", targetId), {
            friendRequests: arrayUnion(auth.currentUser.uid)
        });

        feedback.style.color = "green"; feedback.innerText = "Demande envoyée !";
        document.getElementById('searchFriendInput').value = "";

    } catch (e) {
        console.error(e);
        feedback.style.color = "red"; feedback.innerText = "Erreur : " + e.message;
    }
}

// 3. AFFICHAGE DES DEMANDES
async function updateRequestsUI(requestIds) {
    const container = document.getElementById('requestsList');
    const section = document.getElementById('requestsSection');
    
    if(requestIds.length === 0) {
        section.classList.add('hidden');
        notifBadge.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    notifBadge.classList.remove('hidden'); // Allume la lumière rouge
    container.innerHTML = "";

    // Pour chaque ID, on va chercher le pseudo (ça peut prendre un peu de temps)
    for (const id of requestIds) {
        const userSnap = await getDoc(doc(db, "users", id));
        if(userSnap.exists()) {
            const userData = userSnap.data();
            const div = document.createElement('div');
            div.className = 'friend-item';
            div.innerHTML = `
                <span class="friend-name">${userData.pseudo}</span>
                <div class="friend-actions">
                    <button class="btn-accept" data-id="${id}">✔</button>
                    <button class="btn-reject" data-id="${id}">✖</button>
                </div>
            `;
            container.appendChild(div);
        }
    }

    // Gestion Clics Accepter/Refuser
    document.querySelectorAll('.btn-accept').forEach(btn => {
        btn.addEventListener('click', () => acceptFriend(btn.dataset.id));
    });
    document.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', () => rejectFriend(btn.dataset.id));
    });
}

// 4. ACCEPTER AMI
async function acceptFriend(senderId) {
    try {
        const myId = auth.currentUser.uid;

        // 1. Ajouter à MA liste d'amis et retirer de MES requêtes
        await updateDoc(doc(db, "users", myId), {
            friends: arrayUnion(senderId),
            friendRequests: arrayRemove(senderId)
        });

        // 2. Ajouter à SA liste d'amis
        await updateDoc(doc(db, "users", senderId), {
            friends: arrayUnion(myId)
        });

    } catch(e) { console.error(e); }
}

// 5. REFUSER AMI
async function rejectFriend(senderId) {
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        friendRequests: arrayRemove(senderId)
    });
}

// 6. AFFICHAGE LISTE AMIS
async function updateFriendsUI(friendIds) {
    const container = document.getElementById('friendsList');
    container.innerHTML = "";

    if(friendIds.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666;">Pas encore d\'amis.</p>';
        return;
    }

    for (const id of friendIds) {
        const userSnap = await getDoc(doc(db, "users", id));
        if(userSnap.exists()) {
            const userData = userSnap.data();
            const div = document.createElement('div');
            div.className = 'friend-item';
            div.innerHTML = `
                <span class="friend-name">${userData.pseudo}</span>
                <button class="btn-challenge" data-id="${id}">DÉFIER ⚔️</button>
            `;
            container.appendChild(div);
        }
    }

    // Bouton Défier
    document.querySelectorAll('.btn-challenge').forEach(btn => {
        btn.addEventListener('click', () => {
            alert("Système de défi en cours de développement ! Bientôt tu pourras jouer contre " + btn.dataset.id);
            // C'est ICI qu'on lancera la création de la partie multijoueur plus tard
        });
    });
}