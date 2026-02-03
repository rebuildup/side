import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { getClient } from "../api/client";

export interface TerminalScreenProps {
  terminalId: string;
  title: string;
}

export const TerminalScreen: React.FC<TerminalScreenProps> = ({ terminalId, title }) => {
  const [output, setOutput] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const connectWebSocket = async () => {
    try {
      const client = getClient();
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
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.statusIndicator, connected ? styles.connected : styles.disconnected]}>
          <Text style={styles.statusText}>{connected ? "Connected" : "Disconnected"}</Text>
        </View>
      </View>
      <ScrollView style={styles.output}>
        {output.map((line, index) => (
          <Text key={index} style={styles.outputLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
