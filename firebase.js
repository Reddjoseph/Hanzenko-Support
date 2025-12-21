import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCYKeLj2u4AJ87K9sQWdIQHWiPQlGrnC_Q",
  authDomain: "hanzenko.firebaseapp.com",
  projectId: "hanzenko",
  storageBucket: "hanzenko.firebasestorage.app",
  messagingSenderId: "163825775174",
  appId: "1:163825775174:web:c3a7d0df629d13b1529047"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);