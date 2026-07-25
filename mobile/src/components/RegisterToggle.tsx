import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { Register } from "../api";

type Props = {
  value: Register;
  onChange: (register: Register) => void;
  borderColor: string;
  surfaceColor: string;
  textColor: string;
  textDim: string;
};

const OPTIONS: { key: Register; label: string }[] = [
  { key: "classique", label: "Classique" },
  { key: "sms", label: "SMS" },
];

export default function RegisterToggle({
  value,
  onChange,
  borderColor,
  surfaceColor,
  textColor,
  textDim,
}: Props) {
  return (
    <View style={[styles.group, { backgroundColor: surfaceColor, borderColor }]} accessibilityRole="tablist">
      {OPTIONS.map(({ key, label }) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.option, active && { backgroundColor: textColor }]}
          >
            <Text style={[styles.label, { color: active ? surfaceColor : textDim }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
