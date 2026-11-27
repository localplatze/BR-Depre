import { getDatabase, get, onValue, ref, query, orderByChild, equalTo, limitToFirst, update } from 'firebase/database';
import { firebaseApp } from './firebaseApp';

export const database = getDatabase(firebaseApp);
export { get, onValue, ref, query, orderByChild, equalTo, limitToFirst, update };
