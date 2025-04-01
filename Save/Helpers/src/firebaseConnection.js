import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase, ref, set, serverTimestamp } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDeWFdLJ1XbaPn-ElJ6Jhq4LpQqpHSyeLs",
  authDomain: "for-helpers-2ab8e.firebaseapp.com",
  databaseURL: "https://for-helpers-2ab8e-default-rtdb.firebaseio.com",
  projectId: "for-helpers-2ab8e",
  storageBucket: "for-helpers-2ab8e.firebasestorage.app",
  messagingSenderId: "518178501674",
  appId: "1:518178501674:web:5f00e4bf569eceb1d6ff53",
  measurementId: "G-4M69MYDC5E"
};

const FIREBASE_APP = initializeApp(firebaseConfig);
const FIREBASE_AUTH = initializeAuth(FIREBASE_APP);
const FIREBASE_DB = getDatabase(FIREBASE_APP);
const FIREBASE_STORAGE = getStorage(FIREBASE_APP);

export { FIREBASE_AUTH, FIREBASE_DB, FIREBASE_STORAGE };