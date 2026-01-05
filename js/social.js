// js/social.js
import { db, auth, collection, query, where, getDocs, updateDoc, doc, arrayUnion, arrayRemove, onSnapshot, getDoc, addDoc } from './firebase.js';

// IMPORTANT : On importe la fonction pour lancer le jeu qui se trouve dans main.js
import { startOnlineGame } from './main.js';

const socialModal = document.getElementById('socialModal');
const btnSocial = document.getElementById('btnSocial');
const closeSocial = document.getElementById('closeSocial');
const feedback = document.getElementById('socialFeedback');
const notifBadge = document.getElementById('notifBadge');

let currentUser = null;
let gamesUnsubscribe = null; // Pour arrêter d'écouter les défis si besoin

// ==========================================
// 1. INITIALISATION DU SYSTÈME SOCIAL
// ==========================================
export function initSocialSystem(user) {
    currentUser = user;
    
    // Ouverture / Fermeture Modale
    if(btnSocial) btnSocial.addEventListener('click', () => socialModal.classList.remove('hidden'));
    if(closeSocial) closeSocial.addEventListener('click', () => socialModal.classList.add('hidden'));

    // Bouton Recherche Ami
    document.getElementById('btnSearchFriend')?.addEventListener('click', sendFriendRequest);

    // Lancement des écoutes en temps réel
    listenToUserData();      // Mes amis / Mes demandes
    listenToIncomingGames(); // Les défis qu'on m'envoie
}

// ==========================================
// 2. ÉCOUTE DONNÉES UTILISATEUR (AMIS)
// ==========================================
function listenToUserData() {
    onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
        const data = docSnap.data();
        currentUser = data; // Mise à jour locale
        
        updateRequestsUI(data.friendRequests || []);
        updateFriendsUI(data.friends || []);
    });
}

// ==========================================
// 3. ÉCOUTE DES DÉFIS ENTRANT (MULTIJOUEUR)
// ==========================================
function listenToIncomingGames() {
    // On écoute toute la collection "games" (simplifié pour ce tuto)
    const q = collection(db, "games");
    
    gamesUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
                const gameData = change.doc.data();
                const gameId = change.doc.id;

                // Si la partie est active ET que je suis dedans (White ou Black)
                if (gameData.status === 'active' && (gameData.white === auth.currentUser.uid || gameData.black === auth.currentUser.uid)) {
                    
                    // Vérification simple pour éviter de relancer si on y est déjà
                    const gameScreen = document.getElementById('gameScreen');
                    if (!gameScreen.classList.contains('hidden')) return; 

                    console.log("Partie détectée ! Lancement...");
                    
                    // On détermine ma couleur
                    const myColor = (gameData.white === auth.currentUser.uid) ? 'white' : 'black';
                    
                    // On ferme tout
                    socialModal.classList.add('hidden');
                    document.getElementById('menuScreen').classList.add('hidden');
                    
                    // ET ON LANCE LE JEU !
                    startOnlineGame(gameId, myColor);
                }
            }
        });
    });
}

// ==========================================
// 4. CRÉER UN DÉFI (Bouton "DÉFIER")
// ==========================================
async function createGameChallenge(friendId) {
    try {
        const myId = auth.currentUser.uid;
        
        // Création de la partie dans Firestore
        const docRef = await addDoc(collection(db, "games"), {
            white: myId,       // Je crée, je suis les Blancs
            black: friendId,   // Mon ami est les Noirs
            status: 'active',  // Partie active immédiatement
            turn: 'white',     // Aux blancs de jouer
            lastMove: null,    // Plateau vide au début
            createdAt: new Date().toISOString()
        });

        console.log("Partie créée avec ID:", docRef.id);
        // Pas besoin de faire plus : la fonction listenToIncomingGames() va voir ce nouveau document
        // et lancer la partie automatiquement pour moi aussi !
        
    } catch (e) {
        console.error("Erreur création partie:", e);
        alert("Erreur lors de la création du défi.");
    }
}

// ==========================================
// 5. GESTION AMIS (ENVOI, ACCEPT, REFUS)
// ==========================================

// Envoyer une demande
async function sendFriendRequest() {
    const targetPseudo = document.getElementById('searchFriendInput').value.trim();
    if(!targetPseudo) return;
    if(targetPseudo === currentUser.pseudo) { feedback.innerText = "C'est vous !"; return; }

    try {
        feedback.style.color = "black"; feedback.innerText = "Recherche...";
        
        // 1. Trouver l'ID
        const q = query(collection(db, "users"), where("pseudo", "==", targetPseudo));
        const snap = await getDocs(q);

        if(snap.empty) { feedback.style.color = "red"; feedback.innerText = "Joueur introuvable."; return; }

        const targetDoc = snap.docs[0];
        const targetId = targetDoc.id;

        // 2. Vérifs
        if(currentUser.friends && currentUser.friends.includes(targetId)) {
            feedback.style.color = "orange"; feedback.innerText = "Déjà amis."; return;
        }

        // 3. Envoyer
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

// Afficher les demandes reçues
async function updateRequestsUI(requestIds) {
    const container = document.getElementById('requestsList');
    const section = document.getElementById('requestsSection');
    
    if(requestIds.length === 0) {
        section.classList.add('hidden');
        notifBadge.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    notifBadge.classList.remove('hidden');
    container.innerHTML = "";

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

    // Ecouteurs Accept/Reject
    document.querySelectorAll('.btn-accept').forEach(btn => {
        btn.addEventListener('click', () => acceptFriend(btn.dataset.id));
    });
    document.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', () => rejectFriend(btn.dataset.id));
    });
}

// Accepter Ami
async function acceptFriend(senderId) {
    try {
        const myId = auth.currentUser.uid;
        // Moi : Ajoute Ami + Retire Demande
        await updateDoc(doc(db, "users", myId), {
            friends: arrayUnion(senderId),
            friendRequests: arrayRemove(senderId)
        });
        // Lui : Ajoute Ami
        await updateDoc(doc(db, "users", senderId), {
            friends: arrayUnion(myId)
        });
    } catch(e) { console.error(e); }
}

// Refuser Ami
async function rejectFriend(senderId) {
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        friendRequests: arrayRemove(senderId)
    });
}

// Afficher Liste Amis + BOUTON DÉFIER
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
                <button class="btn-challenge" data-id="${id}" style="background:#e67e22; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold;">
                    DÉFIER ⚔️
                </button>
            `;
            container.appendChild(div);
        }
    }

    // Clic sur DÉFIER -> Lancement de createGameChallenge
    document.querySelectorAll('.btn-challenge').forEach(btn => {
        btn.addEventListener('click', () => {
            const friendId = btn.dataset.id;
            if(confirm("Lancer une partie contre cet ami ?")) {
                createGameChallenge(friendId);
            }
        });
    });
}