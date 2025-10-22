import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCyU__wuJAJMp2L_3a61Z4QaXkbbV_f87s",
  authDomain: "steeringupthepot.firebaseapp.com",
  projectId: "steeringupthepot",
  storageBucket: "steeringupthepot.firebasestorage.app",
  messagingSenderId: "451071605803",
  appId: "1:451071605803:web:d5f47f64b3706ac2967e6e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
