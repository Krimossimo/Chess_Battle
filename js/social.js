// js/social.js

// 1. IMPORTS FIREBASE
import { db, doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, addDoc, onSnapshot } from './firebase.js';

// 2. VARIABLES LOCALES
let currentUser = null;
let startGameCallback = null; // C'est ici qu'on stockera la fonction startOnlineGame de main.js

// ============================================================
// 3. INITIALISATION (Appelé par main.js)
// ============================================================
export function initSocialSystem(user, onGameStart) {
    console.log("🔍 DEBUG - User reçu dans Social :", user); // On regarde ce qu'il y a dedans

    // SÉCURITÉ : Si l'user n'a pas d'UID, on arrête tout avant que ça plante
    if (!user || !user.uid) {
        console.error("⛔ ERREUR CRITIQUE : L'objet user n'a pas d'UID ! Vérifie auth.js");
        console.log("L'objet reçu est :", user);
        return; // On stoppe ici pour éviter l'écran rouge
    }

    console.log("✅ Social System Loaded for:", user.pseudo);
    currentUser = user;
    startGameCallback = onGameStart; 

    setupUIListeners();
    listenToUserData(); 
}

// ============================================================
// 4. GESTION UI (Boutons & Modale)
// ============================================================
function setupUIListeners() {
    const btnSocial = document.getElementById('btnSocial');
    const modal = document.getElementById('socialModal');
    const closeBtn = document.getElementById('closeSocial');
    const btnSearch = document.getElementById('btnSearchFriend');
    const inputSearch = document.getElementById('searchFriendInput');

    // Ouverture Modale
    if (btnSocial) {
        btnSocial.addEventListener('click', () => {
            modal.classList.remove('hidden');
            renderFriendsList(); // Rafraîchir la liste à l'ouverture
        });
    }

    // Fermeture Modale
    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }

    // Recherche Ami
    if (btnSearch) {
        btnSearch.addEventListener('click', async () => {
            const pseudoTarget = inputSearch.value.trim().toLowerCase();
            const feedback = document.getElementById('socialFeedback');
            
            if (pseudoTarget === currentUser.pseudo.toLowerCase()) {
                feedback.innerText = "Vous ne pouvez pas vous ajouter vous-même.";
                feedback.style.color = "red";
                return;
            }

            feedback.innerText = "Recherche en cours...";
            
            // Requête Firebase pour trouver l'ID via le pseudo
            const q = query(collection(db, "users"), where("pseudo", "==", pseudoTarget));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                feedback.innerText = "Joueur introuvable.";
                feedback.style.color = "red";
            } else {
                const targetUser = querySnapshot.docs[0];
                sendFriendRequest(targetUser.id, targetUser.data().pseudo);
                feedback.innerText = "Demande envoyée !";
                feedback.style.color = "green";
                inputSearch.value = "";
            }
        });
    }
}

// ============================================================
// 5. LOGIQUE SOCIALE (Firebase)
// ============================================================

// Envoyer une demande (Ami ou Défi)
async function sendFriendRequest(targetUid, targetPseudo) {
    // On ajoute une "request" dans le document de la CIBLE
    const requestData = {
        fromUid: currentUser.uid,
        fromPseudo: currentUser.pseudo,
        type: 'friend' // Pour l'instant juste ami, on fera défi plus tard
    };

    await updateDoc(doc(db, "users", targetUid), {
        requests: arrayUnion(requestData)
    });
}

// Accepter une demande
async function acceptRequest(req) {
    try {
        // 1. Ajouter l'ami réciproquement
        const friendDataForMe = { uid: req.fromUid, pseudo: req.fromPseudo };
        const friendDataForHim = { uid: currentUser.uid, pseudo: currentUser.pseudo };

        await updateDoc(doc(db, "users", currentUser.uid), {
            friends: arrayUnion(friendDataForMe),
            requests: arrayRemove(req) // On supprime la demande
        });

        await updateDoc(doc(db, "users", req.fromUid), {
            friends: arrayUnion(friendDataForHim)
        });

        // Mise à jour visuelle immédiate
        alert(`Vous êtes maintenant ami avec ${req.fromPseudo} !`);
    } catch (e) {
        console.error("Erreur acceptation :", e);
    }
}

// Refuser une demande
async function rejectRequest(req) {
    await updateDoc(doc(db, "users", currentUser.uid), {
        requests: arrayRemove(req)
    });
}

// Lancer un défi à un ami déjà dans la liste
async function challengeFriend(friendUid) {
    if(confirm("Lancer une partie contre cet ami ?")) {
        // 1. Créer la game
        const newGameRef = await addDoc(collection(db, "games"), {
            white: currentUser.uid,
            black: friendUid,
            status: 'active',
            createdAt: new Date(),
            moves: []
        });

        // 2. Dire à l'ami (et à moi) qu'on a une game active
        // C'est ce champ 'activeGameId' qui va déclencher le jeu chez l'autre
        await updateDoc(doc(db, "users", friendUid), { activeGameId: newGameRef.id });
        await updateDoc(doc(db, "users", currentUser.uid), { activeGameId: newGameRef.id });
    }
}

// ============================================================
// 6. ECOUTE TEMPS RÉEL (Le cœur du système)
// ============================================================
function listenToUserData() {
    // On écoute les changements sur NOTRE profil utilisateur
    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        const data = docSnap.data();
        if (!data) return;

        // A. Mise à jour de la liste des demandes
        updateRequestsList(data.requests || []);

        // B. Mise à jour de la liste d'amis
        updateFriendsListHTML(data.friends || []);

        // C. DETECTION LANCEMENT DE PARTIE (IMPORTANT !)
        if (data.activeGameId) {
            console.log("🔥 PARTIE DÉTECTÉE ! ID:", data.activeGameId);
            
            // 1. On détermine notre couleur
            checkGameAndLaunch(data.activeGameId);

            // 2. On nettoie le champ activeGameId pour ne pas re-déclencher au refresh
            // (Optionnel : certains préfèrent le garder tant que la partie est active)
            updateDoc(doc(db, "users", currentUser.uid), { activeGameId: null });
        }
    });
}

// Vérifie la game et lance le callback du main.js
async function checkGameAndLaunch(gameId) {
    const gameSnap = await getDoc(doc(db, "games", gameId));
    if (gameSnap.exists()) {
        const gData = gameSnap.data();
        // Si je suis white, je suis white, sinon black
        const myColor = (gData.white === currentUser.uid) ? 'white' : 'black';
        
        // APPEL AU MAIN.JS
        if (startGameCallback) {
            document.getElementById('socialModal').classList.add('hidden'); // On ferme la modale
            startGameCallback(gameId, myColor);
        }
    }
}

// ============================================================
// 7. RENDU HTML
// ============================================================

function updateRequestsList(requests) {
    const container = document.getElementById('requestsList');
    const section = document.getElementById('requestsSection');
    
    if (!requests || requests.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    container.innerHTML = '';

    requests.forEach(req => {
        const div = document.createElement('div');
        div.className = 'friend-item';
        div.innerHTML = `
            <span class="friend-name">${req.fromPseudo}</span>
            <div class="friend-actions">
                <button class="btn-accept">✔</button>
                <button class="btn-reject">✖</button>
            </div>
        `;
        
        // Listeners boutons
        div.querySelector('.btn-accept').addEventListener('click', () => acceptRequest(req));
        div.querySelector('.btn-reject').addEventListener('click', () => rejectRequest(req));
        
        container.appendChild(div);
    });
    
    // Petit badge de notification sur le bouton principal
    const badge = document.getElementById('notifBadge');
    if(badge) {
        badge.classList.remove('hidden');
        badge.innerText = requests.length;
    }
}

function updateFriendsListHTML(friends) {
    const container = document.getElementById('friendsList');
    container.innerHTML = '';

    if (!friends || friends.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666; font-style:italic;">Aucun ami pour le moment.</p>';
        return;
    }

    friends.forEach(friend => {
        const div = document.createElement('div');
        div.className = 'friend-item';
        div.innerHTML = `
            <span class="friend-name">👤 ${friend.pseudo}</span>
            <button class="btn-challenge">⚔️ DÉFIER</button>
        `;

        div.querySelector('.btn-challenge').addEventListener('click', () => challengeFriend(friend.uid));
        container.appendChild(div);
    });
}

// Helper si on veut forcer le refresh
function renderFriendsList() {
    // La mise à jour se fait automatiquement via listenToUserData, 
    // mais on peut utiliser cette fonction pour des états de chargement si besoin.
}