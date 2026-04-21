const firebaseConfig = {
    apiKey: "AIzaSyBn7HuSVO5m1yNKnZzXfeIHuI5S0hsQPmQ",
    authDomain: "vexe-f6558.firebaseapp.com",
    databaseURL: "https://vexe-f6558-default-rtdb.firebaseio.com",
    projectId: "vexe-f6558",
    storageBucket: "vexe-f6558.firebasestorage.app",
    messagingSenderId: "1033562853687",
    appId: "1:1033562853687:web:2fa53a0a2880a8e4188ab2"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const CLOUDINARY_CONFIG = { cloudName: "duzoqh3jp", uploadPreset: "so_34k" };
const ADMIN_EMAIL = "jasim28v@gmail.com";
console.log('🔥 VOID LION Ready');
