// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, arrayUnion, arrayRemove, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1wz_aGK57Ad9aVqZWj0LQt4IekLx65IY",
  authDomain: "chessbattle-fdf1b.firebaseapp.com",
  projectId: "chessbattle-fdf1b",
  storageBucket: "chessbattle-fdf1b.firebasestorage.app",
  messagingSenderId: "44354488916",
  appId: "1:44354488916:web:e665a98637175dd51e7bc1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // C'est ici qu'on crée "db"

// On exporte "db" (celui qu'on vient de créer) pour les autres fichiers
export { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, arrayUnion, arrayRemove, onSnapshot, addDoc };