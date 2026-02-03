import type React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface TerminalCardProps {
  id: string;
  title: string;
  status: "running" | "stopped";
  onPress: () => void;
}

export const TerminalCard: React.FC<TerminalCardProps> = ({ id, title, status, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View
          style={[
            styles.statusDot,
            status === "running" ? styles.statusRunning : styles.statusStopped,
          ]}
        />
      </View>
      <Text style={styles.id}>ID: {id.slice(0, 8)}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
