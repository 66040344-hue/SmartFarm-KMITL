// seminar-firebase-config.js
export const firebaseConfig = {
    apiKey: "AIzaSyDL96VzXmFYxDuXvJgYW85HjCw5ua63b-Q",
    authDomain: "smartfarmkmitl-df9e0.firebaseapp.com",
    projectId: "smartfarmkmitl-df9e0",
    storageBucket: "smartfarmkmitl-df9e0.firebasestorage.app",
    messagingSenderId: "706598457178",
    appId: "1:706598457178:web:368c58102144e5b598ed63",
    measurementId: "G-CSHRRRCZS6"
};

// ตรวจสอบว่าได้ตั้งค่า Firebase Config แล้วหรือยัง
export function isFirebaseConfigured() {
    return firebaseConfig.projectId && firebaseConfig.projectId.trim() !== "";
}
