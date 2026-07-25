import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ACCENTS, LANGUAGES, LanguageKey } from "../theme";

type Props = {
  value: LanguageKey;
  onChange: (lang: LanguageKey) => void;
  borderColor: string;
  surfaceColor: string;
  textDim: string;
};

export default function LangPicker({ value, onChange, borderColor, surfaceColor, textDim }: Props) {
  return (
    <View
      style={[styles.group, { backgroundColor: surfaceColor, borderColor }]}
      accessibilityRole="tablist"
    >
      {LANGUAGES.map(({ key, label }) => {
        const active = key === value;
        const [accent, accent2] = ACCENTS[key];
        return (
          <Pressable
            key={key}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.pill,
              active && { backgroundColor: accent },
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: active ? "#fff" : accent2, opacity: active ? 0.9 : 0.6 },
              ]}
            />
            <Text style={[styles.label, { color: active ? "#fff" : textDim }]}>{label}</Text>
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
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
