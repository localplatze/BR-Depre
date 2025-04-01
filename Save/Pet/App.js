import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { RecoverScreen } from './src/screens/RecoverScreen';
import { AdminScreen } from './src/screens/AdminScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { PetDetailScreen } from './src/screens/PetDetailScreen';
import { NewPetScreen } from './src/screens/NewPetScreen';
import { EditPetScreen } from './src/screens/EditPetScreen';
import { RequestScreen } from './src/screens/RequestScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { WalkListScreen } from './src/screens/WalkListScreen';
import { ManageWalkScreen } from './src/screens/ManageWalkScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#FFFFFF' }
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Recover" component={RecoverScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="PetDetail" component={PetDetailScreen} />
        <Stack.Screen name="NewPet" component={NewPetScreen} />
        <Stack.Screen name="EditPet" component={EditPetScreen} />
        <Stack.Screen name="Request" component={RequestScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="WalkList" component={WalkListScreen} />
        <Stack.Screen name="ManageWalk" component={ManageWalkScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}