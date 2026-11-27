import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { firebaseApp } from './firebaseApp';

let auth;
try {
  auth = initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) });
} catch (error) {
  if (error.code !== 'auth/already-initialized') throw error;
  auth = getAuth(firebaseApp);
}

export { auth };
export { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
