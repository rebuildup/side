import type React from "react";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export interface VibesInputProps {
  onSend: (prompt: string) => void;
  placeholder?: string;
}

export const VibesInput: React.FC<VibesInputProps> = ({
  onSend,
  placeholder = "Enter vibe coding prompt...",
}) => {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (!text.trim()) {
      Alert.alert("Error", "Please enter a prompt");
      return;
    }
    onSend(text.trim());
    setText("");
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        multiline
        maxLength={500}
      />
      <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
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
