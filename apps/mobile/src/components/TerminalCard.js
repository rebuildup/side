"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalCard = void 0;
const react_native_1 = require("react-native");
const TerminalCard = ({ id, title, status, onPress }) => {
    return (<react_native_1.TouchableOpacity style={styles.card} onPress={onPress}>
      <react_native_1.View style={styles.header}>
        <react_native_1.Text style={styles.title}>{title}</react_native_1.Text>
        <react_native_1.View style={[
            styles.statusDot,
            status === "running" ? styles.statusRunning : styles.statusStopped,
        ]}/>
      </react_native_1.View>
      <react_native_1.Text style={styles.id}>ID: {id.slice(0, 8)}</react_native_1.Text>
    </react_native_1.TouchableOpacity>);
};
exports.TerminalCard = TerminalCard;
const styles = react_native_1.StyleSheet.create({
    card: {
        backgroundColor: "#2a2a2a",
        borderRadius: 8,
        padding: 16,
        marginVertical: 8,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: "#3a3a3a",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    title: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusRunning: {
        backgroundColor: "#22c55e",
    },
    statusStopped: {
        backgroundColor: "#ef4444",
    },
    id: {
        color: "#9ca3af",
        fontSize: 12,
    },
});
