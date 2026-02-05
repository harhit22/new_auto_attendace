// Driver Duty App - Main Entry Point
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CameraScreen from './src/screens/CameraScreen';
import HelperLoginScreen from './src/screens/HelperLoginScreen';
import HelperCameraScreen from './src/screens/HelperCameraScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="HelperLogin" component={HelperLoginScreen} />
        <Stack.Screen name="HelperCamera" component={HelperCameraScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
