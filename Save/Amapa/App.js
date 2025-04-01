import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { registerForPushNotifications, listenToNotifications } from './src/services/firebaseConnection';
import { HomeScreen } from './src/screens/HomeScreen';
import { WebViewScreen } from './src/screens/WebViewScreen';

const Stack = createStackNavigator();

export default function App() {
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotifications();
        
        if (token) {
          console.log('App registrado para notificações');
        }
      } catch (error) {
        console.error('Erro ao configurar notificações:', error);
      }
    };

    const notificationListener = listenToNotifications(notification => {
      console.log('Notificação recebida:', notification);
      // Aqui você pode adicionar lógica para tratar a notificação
    });

    setupNotifications();

    return () => {
      notificationListener.remove();
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#FFFFFF' }
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="WebView" component={WebViewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}