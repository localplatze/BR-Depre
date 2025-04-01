import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, remove } from 'firebase/database';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { getOrCreateDeviceId } from './deviceStorage';

const firebaseConfig = {
  apiKey: "AIzaSyDQE6dkjmm6-T5dHINSaGhRrYFXWNwMP3Y",
  authDomain: "laranjal-jari.firebaseapp.com",
  databaseURL: "https://laranjal-jari-default-rtdb.firebaseio.com",
  projectId: "laranjal-jari",
  storageBucket: "laranjal-jari.firebasestorage.app",
  messagingSenderId: "772875821448",
  appId: "1:772875821448:web:b8cbe37d5fa9ba2f959a3d",
  measurementId: "G-0F48TB38GJ"
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