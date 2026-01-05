// js/auth.js
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, setDoc, doc, getDoc, collection, query, where, getDocs, signOut, updateEmail, updatePassword, deleteUser, updateDoc, deleteDoc, reauthenticateWithCredential, EmailAuthProvider, onAuthStateChanged } from './firebase.js';

console.log("Auth.js chargé correctement !");

const authScreen = document.getElementById('authScreen');
const menuScreen = document.getElementById('menuScreen');
const authError = document.getElementById('authError');
const settingsModal = document.getElementById('settingsModal');
const feedback = document.getElementById('settingsFeedback');
let currentUserData = null;

// ==========================================
// 1. GESTION DES ONGLETS (LOGIN / REGISTER)
// ==========================================
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
        console.log("Clic sur Connexion");
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.style.opacity = '1';
        tabRegister.style.opacity = '0.6';
        authError.innerText = "";
    });

    tabRegister.addEventListener('click', () => {
        console.log("Clic sur Inscription");
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabRegister.style.opacity = '1';
        tabLogin.style.opacity = '0.6';
        authError.innerText = "";
    });
}

// ==========================================
// 2. LOGIQUE INSCRIPTION
// ==========================================
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.innerText = "Vérification en cours...";
        
        const email = document.getElementById('regEmail').value;
        const pass = document.getElementById('regPass').value;
        const pseudo = document.getElementById('regPseudo').value;
        const country = document.getElementById('regCountry').value;

        try {
            // A. Vérifier unicité Pseudo
            const q = query(collection(db, "users"), where("pseudo", "==", pseudo));
            const snap = await getDocs(q);
            if (!snap.empty) throw new Error("Ce pseudo est déjà pris !");

            // B. Créer Auth
            authError.innerText = "Création du compte...";
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            
            // C. Sauvegarder BDD
            authError.innerText = "Sauvegarde du profil...";
            await setDoc(doc(db, "users", cred.user.uid), {
                pseudo: pseudo,
                email: email,
                country: country,
                points: 1200,
                rank: "Débutant",
                createdAt: new Date().toISOString(),
                lastPseudoUpdate: null
            });

            authError.style.color = "#2ecc71";
            authError.innerText = "Succès ! Chargement...";
            
        } catch (err) {
            console.error(err);
            authError.style.color = "#ff6b6b";
            let msg = err.message;
            if(msg.includes("email-already-in-use")) msg = "Email déjà utilisé.";
            authError.innerText = "Erreur : " + msg;
        }
    });
}

// ==========================================
// 3. LOGIQUE CONNEXION
// ==========================================
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.innerText = "Connexion...";
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPass').value;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            // La redirection se fait via onAuthStateChanged
        } catch (err) {
            console.error(err);
            authError.style.color = "#ff6b6b";
            authError.innerText = "Email ou mot de passe incorrect.";
        }
    });
}

// ==========================================
// 4. PARAMÈTRES (MODALE)
// ==========================================
const btnSettings = document.getElementById('btnSettings');
const closeSettings = document.getElementById('closeSettings');

if (btnSettings) {
    btnSettings.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        if (currentUserData) {
            document.getElementById('setPseudo').value = currentUserData.pseudo;
            document.getElementById('setCountry').value = currentUserData.country;
            document.getElementById('setEmail').value = currentUserData.email;
            checkPseudoDate();
        }
    });
}

if (closeSettings) {
    closeSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
        feedback.innerText = "";
    });
}

// --- Sauvegarde Pays ---
document.getElementById('saveCountry')?.addEventListener('click', async () => {
    try {
        const val = document.getElementById('setCountry').value;
        await updateDoc(doc(db, "users", auth.currentUser.uid), { country: val });
        feedback.style.color = "green"; feedback.innerText = "Pays modifié ! (F5 pour voir)";
    } catch(e) { feedback.innerText = e.message; }
});

// --- Sauvegarde Pseudo ---
function checkPseudoDate() {
    const msg = document.getElementById('pseudoMsg');
    const btn = document.getElementById('savePseudo');
    if(!currentUserData.lastPseudoUpdate) {
        msg.innerText = "Changement autorisé.";
        btn.disabled = false; return;
    }
    const days = Math.ceil(Math.abs(new Date() - new Date(currentUserData.lastPseudoUpdate)) / (86400000));
    if (days < 30) {
        msg.innerText = `Attendez encore ${30 - days} jours.`;
        msg.style.color = "red"; btn.disabled = true; btn.style.opacity = "0.5";
    } else {
        msg.innerText = "Changement autorisé.";
        msg.style.color = "green"; btn.disabled = false; btn.style.opacity = "1";
    }
}

document.getElementById('savePseudo')?.addEventListener('click', async () => {
    const newPseudo = document.getElementById('setPseudo').value;
    try {
        const q = query(collection(db, "users"), where("pseudo", "==", newPseudo));
        const snap = await getDocs(q);
        if (!snap.empty) throw new Error("Pseudo pris.");

        await updateDoc(doc(db, "users", auth.currentUser.uid), { 
            pseudo: newPseudo, 
            lastPseudoUpdate: new Date().toISOString() 
        });
        feedback.style.color = "green"; feedback.innerText = "Pseudo modifié !";
    } catch(e) { feedback.style.color = "red"; feedback.innerText = e.message; }
});

// --- Sauvegarde Email ---
document.getElementById('saveEmail')?.addEventListener('click', async () => {
    try {
        const val = document.getElementById('setEmail').value;
        await updateEmail(auth.currentUser, val);
        await updateDoc(doc(db, "users", auth.currentUser.uid), { email: val });
        feedback.style.color = "green"; feedback.innerText = "Email modifié !";
    } catch(e) { feedback.style.color = "red"; feedback.innerText = "Reconnectez-vous d'abord."; }
});

// --- Sauvegarde Pass ---
document.getElementById('savePass')?.addEventListener('click', async () => {
    try {
        const val = document.getElementById('setPass').value;
        if(val.length < 6) throw new Error("Trop court.");
        await updatePassword(auth.currentUser, val);
        feedback.style.color = "green"; feedback.innerText = "Mot de passe modifié !";
    } catch(e) { feedback.style.color = "red"; feedback.innerText = "Reconnectez-vous d'abord."; }
});

// --- Suppression ---
document.getElementById('btnDeleteAccount')?.addEventListener('click', async () => {
    if(!confirm("Supprimer définitivement ?")) return;
    try {
        const uid = auth.currentUser.uid;
        await deleteDoc(doc(db, "users", uid));
        await deleteUser(auth.currentUser);
        alert("Compte supprimé.");
        window.location.reload();
    } catch(e) { alert("Erreur : Reconnectez-vous par sécurité."); }
});


// ==========================================
// 5. FONCTION D'ECOUTE PRINCIPALE
// ==========================================
export function initAuthListener(onUserConnected) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Connecté
            try {
                const snap = await getDoc(doc(db, "users", user.uid));
                if (snap.exists()) {
                    currentUserData = snap.data();
                    if(authScreen) authScreen.classList.add('hidden');
                    if(menuScreen) menuScreen.classList.remove('hidden');
                    if(btnSettings) btnSettings.classList.remove('hidden');
                    onUserConnected(currentUserData);
                }
            } catch (e) { console.error("Erreur lecture profil:", e); }
        } else {
            // Déconnecté
            if(authScreen) authScreen.classList.remove('hidden');
            if(menuScreen) menuScreen.classList.add('hidden');
            if(btnSettings) btnSettings.classList.add('hidden');
        }
    });
}

export function logout() {
    signOut(auth).then(() => window.location.reload());
}