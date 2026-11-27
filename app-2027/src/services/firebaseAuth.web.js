import { getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseApp } from './firebaseApp';

export const auth = getAuth(firebaseApp);
export { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut };
