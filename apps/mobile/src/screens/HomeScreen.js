"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeScreen = void 0;
const react_1 = require("react");
const react_native_1 = require("react-native");
const client_1 = require("../api/client");
const TerminalCard_1 = require("../components/TerminalCard");
const HomeScreen = ({ navigation }) => {
    const [terminals, setTerminals] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        loadTerminals();
    }, [loadTerminals]);
    const loadTerminals = async () => {
        try {
            const client = (0, client_1.getClient)();
            // Fetch terminals from server
            // Note: API endpoint to be implemented in server
            const terminals = await client.get("/terminals");
            setTerminals(terminals);
            setLoading(false);
        }
        catch (_err) {
            setError("Failed to load terminals");
            setLoading(false);
        }
    };
    if (loading) {
        return (<react_native_1.View style={styles.centerContainer}>
        <react_native_1.ActivityIndicator size="large" color="#2563eb"/>
      </react_native_1.View>);
    }
    if (error) {
        return (<react_native_1.View style={styles.centerContainer}>
        <react_native_1.Text style={styles.errorText}>{error}</react_native_1.Text>
      </react_native_1.View>);
    }
    return (<react_native_1.View style={styles.container}>
      <react_native_1.Text style={styles.title}>Deck IDE</react_native_1.Text>
      <react_native_1.ScrollView style={styles.terminalList}>
        {terminals.length === 0 ? (<react_native_1.Text style={styles.emptyText}>No terminals active</react_native_1.Text>) : (terminals.map((terminal) => (<TerminalCard_1.TerminalCard key={terminal.id} id={terminal.id} title={terminal.title} status={terminal.status} onPress={() => navigation.navigate("Terminal", { terminalId: terminal.id, title: terminal.title })}/>)))}
      </react_native_1.ScrollView>
    </react_native_1.View>);
};
exports.HomeScreen = HomeScreen;
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1a1a1a",
    },
    centerContainer: {
        flex: 1,
        backgroundColor: "#1a1a1a",
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        color: "#ffffff",
        fontSize: 24,
        fontWeight: "bold",
        padding: 16,
    },
    terminalList: {
        flex: 1,
    },
    emptyText: {
        color: "#9ca3af",
        textAlign: "center",
        marginTop: 32,
    },
    errorText: {
        color: "#ef4444",
    },
});
