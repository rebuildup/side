import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type React from "react";
import { HomeScreen } from "../screens/HomeScreen";
import { TerminalScreen } from "../screens/TerminalScreen";
import { VibesScreen } from "../screens/VibesScreen";

export type RootStackParamList = {
  Home: undefined;
  Terminal: { terminalId: string; title: string };
  Vibes: { terminalId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: "#1a1a1a" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { color: "#ffffff" },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Deck IDE" }} />
        <Stack.Screen
          name="Terminal"
          component={TerminalScreen}
          options={({ route }) => ({ title: route.params.title })}
        />
        <Stack.Screen name="Vibes" component={VibesScreen} options={{ title: "Vibe Coding" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
