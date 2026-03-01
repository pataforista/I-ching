// auth.js
// Módulo de autenticación — Placeholder para Firebase Auth + Stripe.
//
// INTEGRACIÓN PENDIENTE:
//   1. npm install firebase
//   2. Crear proyecto en https://console.firebase.google.com
//   3. Reemplazar firebaseConfig con los valores reales
//   4. Descomentar las secciones marcadas con TODO

// ─── Configuración Firebase (pendiente) ──────────────────────────────────────
//
// import { initializeApp } from "https://www.gstatic.com/firebasejs/10.x/firebase-app.js";
// import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut,
//          onAuthStateChanged as fbOnAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.x/firebase-auth.js";
// import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.x/firebase-firestore.js";
//
// const firebaseConfig = {
//   apiKey: "TU_API_KEY",
//   authDomain: "tu-proyecto.firebaseapp.com",
//   projectId: "tu-proyecto",
//   storageBucket: "tu-proyecto.appspot.com",
//   messagingSenderId: "000000000000",
//   appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxx"
// };
//
// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);

// ─── Estado del Usuario ───────────────────────────────────────────────────────

/**
 * currentUser — Objeto global que representa al usuario autenticado.
 *
 * Campos:
 *   uid        → Firebase User UID. null = sesión anónima (local).
 *   isPremium  → true si tiene suscripción Stripe activa (verificado via Firestore).
 *   email      → Correo del usuario (disponible tras autenticación).
 *   displayName → Nombre del usuario (disponible tras autenticación).
 *   history    → Historial del usuario en la nube (Firestore). Vacío en modo local.
 *
 * Mientras Firebase no esté activo, la app usa localStorage y entitlements locales.
 * Cuando se integre Firebase Auth, este objeto se sincronizará automáticamente.
 */
export let currentUser = {
  uid: null,
  isPremium: false,
  email: null,
  displayName: null,
  history: []
};

// ─── Inicialización ───────────────────────────────────────────────────────────

/**
 * initAuth — Inicializa el sistema de autenticación.
 *
 * En modo local (sin Firebase): retorna currentUser sin cambios.
 * Con Firebase: escucha onAuthStateChanged y verifica status premium en Firestore.
 *
 * @returns {Promise<object>} currentUser actualizado
 */
export async function initAuth() {
  // TODO: Activar cuando Firebase esté configurado
  // return new Promise((resolve) => {
  //   fbOnAuthStateChanged(auth, async (user) => {
  //     if (user) {
  //       currentUser.uid = user.uid;
  //       currentUser.email = user.email;
  //       currentUser.displayName = user.displayName;
  //       currentUser.isPremium = await checkPremiumStatus(user.uid);
  //     } else {
  //       Object.assign(currentUser, { uid: null, isPremium: false, email: null, displayName: null });
  //     }
  //     resolve(currentUser);
  //   });
  // });

  return currentUser; // Modo local: sin cambios
}

/**
 * listenAuthState — Registra un callback que se ejecuta cuando el estado de
 * autenticación cambia (login, logout, token refresh).
 *
 * @param {Function} callback - Recibe el objeto currentUser actualizado
 */
export function listenAuthState(callback) {
  // TODO: fbOnAuthStateChanged(auth, async (user) => { ... callback(currentUser); });
  callback(currentUser); // Modo local: llamada inmediata
}

// ─── Acciones de Auth ─────────────────────────────────────────────────────────

/**
 * signInWithGoogle — Abre el popup de autenticación con Google.
 * TODO: Conectar con Firebase signInWithPopup(auth, new GoogleAuthProvider())
 */
export async function signInWithGoogle() {
  // TODO:
  // const provider = new GoogleAuthProvider();
  // const result = await signInWithPopup(auth, provider);
  // return result.user;
  throw new Error("Firebase Auth no está configurado. Ver auth.js para instrucciones de integración.");
}

/**
 * signOut — Cierra la sesión actual.
 * TODO: Conectar con Firebase signOut(auth)
 */
export async function signOut() {
  // TODO: await fbSignOut(auth);
  currentUser.uid = null;
  currentUser.isPremium = false;
  currentUser.email = null;
  currentUser.displayName = null;
  currentUser.history = [];
}

// ─── Premium / Stripe ─────────────────────────────────────────────────────────

/**
 * checkPremiumStatus — Verifica si el usuario tiene suscripción activa en Firestore.
 * El documento se escribe desde un webhook de Stripe al completar el checkout.
 *
 * Estructura esperada en Firestore:
 *   /users/{uid}/subscriptions/{subscriptionId} → { status: "active", ... }
 *
 * @param {string} uid - Firebase User UID
 * @returns {Promise<boolean>}
 */
export async function checkPremiumStatus(uid) {
  // TODO:
  // const subsRef = collection(db, "users", uid, "subscriptions");
  // const q = query(subsRef, where("status", "==", "active"));
  // const snap = await getDocs(q);
  // return !snap.empty;
  return false;
}

/**
 * startCheckout — Redirige al usuario a Stripe Checkout.
 * El price ID se obtiene de data/products.json o de una variable de entorno.
 *
 * @param {string} priceId - Stripe Price ID (price_xxxxxxxx)
 */
export async function startCheckout(priceId) {
  // TODO: Llamar a tu Cloud Function o backend que crea la Stripe Checkout Session
  // const res = await fetch("/api/create-checkout-session", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ priceId, uid: currentUser.uid })
  // });
  // const { url } = await res.json();
  // window.location.href = url;
  throw new Error("Stripe Checkout no está configurado. Ver auth.js para instrucciones de integración.");
}
