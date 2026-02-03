"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppNavigator = void 0;
const native_1 = require("@react-navigation/native");
const native_stack_1 = require("@react-navigation/native-stack");
const HomeScreen_1 = require("../screens/HomeScreen");
const TerminalScreen_1 = require("../screens/TerminalScreen");
const VibesScreen_1 = require("../screens/VibesScreen");
const Stack = (0, native_stack_1.createNativeStackNavigator)();
const AppNavigator = () => {
    return (<native_1.NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{
            headerStyle: { backgroundColor: "#1a1a1a" },
            headerTintColor: "#ffffff",
            headerTitleStyle: { color: "#ffffff" },
        }}>
        <Stack.Screen name="Home" component={HomeScreen_1.HomeScreen} options={{ title: "Deck IDE" }}/>
        <Stack.Screen name="Terminal" component={TerminalScreen_1.TerminalScreen} options={({ route }) => ({ title: route.params.title })}/>
        <Stack.Screen name="Vibes" component={VibesScreen_1.VibesScreen} options={{ title: "Vibe Coding" }}/>
      </Stack.Navigator>
    </native_1.NavigationContainer>);
};
exports.AppNavigator = AppNavigator;
