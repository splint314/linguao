import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { getStoredApiUrl, guessApiUrl, setStoredApiUrl } from "../api";

type Props = {
  visible: boolean;
  onClose: () => void;
  bgElevated: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
};

export default function SettingsSheet({
  visible,
  onClose,
  bgElevated,
  border,
  text,
  textDim,
  accent,
}: Props) {
  const [value, setValue] = useState("");
  const [current, setCurrent] = useState("");

  useEffect(() => {
    if (!visible) return;
    getStoredApiUrl().then((stored) => {
      setValue(stored ?? "");
      setCurrent(stored || guessApiUrl());
    });
  }, [visible]);

  const save = async () => {
    const trimmed = value.trim().replace(/\/+$/, "");
    await setStoredApiUrl(trimmed || null);
    setCurrent(trimmed || guessApiUrl());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: bgElevated, borderColor: border }]}>
          <Text style={[styles.title, { color: text }]}>Adresse du serveur backend</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={guessApiUrl()}
            placeholderTextColor={textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.input, { borderColor: border, color: text }]}
          />
          <Text style={[styles.hint, { color: textDim }]}>Actuellement : {current}</Text>
          <Pressable style={[styles.button, { backgroundColor: accent }]} onPress={save}>
            <Text style={styles.buttonText}>Enregistrer</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    padding: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
  },
  button: {
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
