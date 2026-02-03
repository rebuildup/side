"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalScreen = void 0;
const react_1 = require("react");
const react_native_1 = require("react-native");
const client_1 = require("../api/client");
const TerminalScreen = ({ terminalId, title }) => {
    const [output, setOutput] = (0, react_1.useState)([]);
    const [connected, setConnected] = (0, react_1.useState)(false);
    const wsRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        connectWebSocket();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connectWebSocket]);
    const connectWebSocket = async () => {
        try {
            const client = (0, client_1.getClient)();
            const token = await client.getWsToken(terminalId);
            const ws = client.connectWebSocket(token, {
                onMessage: (data) => {
                    setOutput((prev) => [...prev, data]);
                },
                onError: (error) => {
                    console.error("WebSocket error:", error);
                    setConnected(false);
                },
                onClose: () => {
                    setConnected(false);
                },
            });
            ws.onopen = () => {
                setConnected(true);
            };
            wsRef.current = ws;
        }
        catch (error) {
            console.error("Failed to connect:", error);
        }
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_1.View style={styles.header}>
        <react_native_1.Text style={styles.title}>{title}</react_native_1.Text>
        <react_native_1.View style={[styles.statusIndicator, connected ? styles.connected : styles.disconnected]}>
          <react_native_1.Text style={styles.statusText}>{connected ? "Connected" : "Disconnected"}</react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>
      <react_native_1.ScrollView style={styles.output}>
        {output.map((line, index) => (<react_native_1.Text key={index} style={styles.outputLine}>
            {line}
          </react_native_1.Text>))}
      </react_native_1.ScrollView>
    </react_native_1.View>);
};
exports.TerminalScreen = TerminalScreen;
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1a1a1a",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#3a3a3a",
    },
    title: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "600",
    },
    statusIndicator: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    connected: {
        backgroundColor: "#22c55e",
    },
    disconnected: {
        backgroundColor: "#ef4444",
    },
    statusText: {
        color: "#ffffff",
        fontSize: 12,
    },
    output: {
        flex: 1,
        padding: 8,
    },
    outputLine: {
        color: "#e5e7eb",
        fontFamily: "monospace",
        fontSize: 12,
    },
});
