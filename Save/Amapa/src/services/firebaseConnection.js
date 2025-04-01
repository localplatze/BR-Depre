import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, remove } from 'firebase/database';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { getOrCreateDeviceId } from './deviceStorage';

const firebaseConfig = {
  apiKey: "AIzaSyBPmGUscYU9tmljuQ2_PMYLMAw-cGnaJEg",
  authDomain: "amapa-e9328.firebaseapp.com",
  databaseURL: "https://amapa-e9328-default-rtdb.firebaseio.com",
  projectId: "amapa-e9328",
  storageBucket: "amapa-e9328.firebasestorage.app",
  messagingSenderId: "321869961979",
  appId: "1:321869961979:web:04fbea72e8c6111fb32e5e",
  measurementId: "G-0D127Z2FHE"
};

const FIREBASE_APP = initializeApp(firebaseConfig);
const FIREBASE_DB = getDatabase(FIREBASE_APP);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function saveTokenToDatabase(token, deviceId) {
  try {
    const tokenRef = ref(FIREBASE_DB, `devices/${deviceId}`);
    
    await set(tokenRef, {
      token,
      deviceName: Device.deviceName || 'Dispositivo desconhecido',
      platform: Device.osName,
      model: Device.modelName,
      lastUpdated: new Date().toISOString(),
      isActive: true
    });
    
    console.log('Token salvo com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao salvar token:', error);
    return false;
  }
}

export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      console.log('Notificações requerem um dispositivo físico');
      return null;
    }

    const deviceId = await getOrCreateDeviceId();
    if (!deviceId) {
      console.error('Não foi possível obter deviceId');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permissão de notificação não concedida');
      return null;
    }
    
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig.extra.eas.projectId,
    })).data;
    
    await saveTokenToDatabase(token, deviceId);
    return token;
  } catch (error) {
    console.error('Erro ao registrar notificações:', error);
    return null;
  }
}

export function listenToNotifications(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function listenToNotificationInteractions(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}