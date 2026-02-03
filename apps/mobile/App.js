"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
const expo_status_bar_1 = require("expo-status-bar");
const AppNavigator_1 = require("./src/navigation/AppNavigator");
function App() {
    return (<>
      <expo_status_bar_1.StatusBar style="light"/>
      <AppNavigator_1.AppNavigator />
    </>);
}
