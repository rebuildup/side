"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VibesScreen = void 0;
const react_1 = require("react");
const react_native_1 = require("react-native");
const client_1 = require("../api/client");
const VibesInput_1 = require("../components/VibesInput");
const VibesScreen = ({ terminalId }) => {
    const [messages, setMessages] = (0, react_1.useState)([]);
    const handleSend = async (prompt) => {
        setMessages((prev) => [...prev, { role: "user", content: prompt }]);
        try {
            const _client = (0, client_1.getClient)();
            // TODO: Implement vibe coding API endpoint in server
            // const response = await client.post<{ message: string }>('/vibes', { terminalId, prompt });
            // setMessages((prev) => [...prev, { role: 'assistant', content: response.message }]);
            // Placeholder for now
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "Vibe coding feature is under development. The server endpoint will be implemented in a future update.",
                },
            ]);
        }
        catch (_error) {
            react_native_1.Alert.alert("Error", "Failed to send vibe coding prompt");
        }
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_1.ScrollView style={styles.messages}>
        {messages.map((message, index) => (<react_native_1.View key={index} style={[
                styles.messageBubble,
                message.role === "user" ? styles.userMessage : styles.assistantMessage,
            ]}>
            <react_native_1.Text style={[
                styles.messageText,
                message.role === "user" ? styles.userMessageText : styles.assistantMessageText,
            ]}>
              {message.content}
            </react_native_1.Text>
          </react_native_1.View>))}
      </react_native_1.ScrollView>
      <VibesInput_1.VibesInput onSend={handleSend}/>
    </react_native_1.View>);
};
exports.VibesScreen = VibesScreen;
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1a1a1a",
    },
    messages: {
        flex: 1,
        padding: 16,
    },
    messageBubble: {
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    userMessage: {
        backgroundColor: "#2563eb",
        alignSelf: "flex-end",
    },
    assistantMessage: {
        backgroundColor: "#3a3a3a",
        alignSelf: "flex-start",
    },
    messageText: {
        fontSize: 14,
    },
    userMessageText: {
        color: "#ffffff",
    },
    assistantMessageText: {
        color: "#e5e7eb",
    },
});
