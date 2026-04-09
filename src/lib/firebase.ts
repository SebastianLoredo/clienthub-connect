import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDa91BGvG54ghx0PR8tmWD5ztVGzCW8kjg",
  authDomain: "test-totum.firebaseapp.com",
  projectId: "test-totum",
  storageBucket: "test-totum.firebasestorage.app",
  messagingSenderId: "971088564945",
  appId: "1:971088564945:web:5de2cbfdd668d110062bf0",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
