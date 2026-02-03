"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VibesInput = void 0;
const react_1 = require("react");
const react_native_1 = require("react-native");
const VibesInput = ({ onSend, placeholder = "Enter vibe coding prompt...", }) => {
    const [text, setText] = (0, react_1.useState)("");
    const handleSend = () => {
        if (!text.trim()) {
            react_native_1.Alert.alert("Error", "Please enter a prompt");
            return;
        }
        onSend(text.trim());
        setText("");
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_1.TextInput style={styles.input} value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor="#6b7280" multiline maxLength={500}/>
      <react_native_1.TouchableOpacity style={styles.sendButton} onPress={handleSend}>
        <react_native_1.Text style={styles.sendButtonText}>Send</react_native_1.Text>
      </react_native_1.TouchableOpacity>
    </react_native_1.View>);
};
exports.VibesInput = VibesInput;
const styles = react_native_1.StyleSheet.create({
    container: {
        backgroundColor: "#1a1a1a",
        borderTopWidth: 1,
        borderTopColor: "#3a3a3a",
        padding: 16,
    },
    input: {
        backgroundColor: "#2a2a2a",
        color: "#ffffff",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 8,
        minHeight: 100,
        textAlignVertical: "top",
    },
    sendButton: {
        backgroundColor: "#2563eb",
        borderRadius: 8,
        padding: 12,
        alignItems: "center",
    },
    sendButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
});
