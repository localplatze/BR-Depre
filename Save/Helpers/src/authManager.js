import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

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

class AuthManager {
  constructor(firebaseConfig) {
    // Initialize Firebase app only once
    this.app = initializeApp(firebaseConfig);
    
    // Initialize auth with persistence
    this.auth = initializeAuth(this.app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });

    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId: "518178501674-b962r77his9jjnp4c65ln4i98ljsilmv.apps.googleusercontent.com",
    });
  }

  // Get current auth instance
  getAuth() {
    return this.auth;
  }

  // Sign out from all providers
  async signOut() {
    try {
      // Sign out from Firebase
      await signOut(this.auth);
      
      // Sign out from Google
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
      }
      
      // Clear any persistent auth state
      await AsyncStorage.removeItem('@auth_provider');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Handle Google Sign-In
  async signInWithGoogle() {
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();
      
      // Store auth provider type
      await AsyncStorage.setItem('@auth_provider', 'google');
      
      return userInfo;
    } catch (error) {
      console.error('Google Sign-In error:', error);
      throw error;
    }
  }

  // Handle Email/Password Sign-In
  async signInWithEmail(email, password) {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      
      // Store auth provider type
      await AsyncStorage.setItem('@auth_provider', 'email');
      
      return result;
    } catch (error) {
      console.error('Email Sign-In error:', error);
      throw error;
    }
  }

  // Get current user
  getCurrentUser() {
    return this.auth.currentUser;
  }
}

// Create and export a singleton instance
const authManager = new AuthManager(firebaseConfig);
export default authManager;