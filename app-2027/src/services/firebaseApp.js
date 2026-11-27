import { getApp, getApps, initializeApp } from 'firebase/app';

// Mesma aplicação Firebase já usada pelo site.
const firebaseConfig = {
  apiKey: 'AIzaSyBBrIiwL2sUVEPc8YBzdkJxPVyVVC5QN1M',
  authDomain: 'brdepre.firebaseapp.com',
  databaseURL: 'https://brdepre-default-rtdb.firebaseio.com',
  projectId: 'brdepre',
  storageBucket: 'brdepre.firebasestorage.app',
  messagingSenderId: '1077826896098',
  appId: '1:1077826896098:web:abe2b07a280a4852649ebb',
  measurementId: 'G-4JXFEZ8DW6',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
