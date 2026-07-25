import { useCallback, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type LanguageKey = "darija" | "wolof" | "tahitien";
export type ThemeMode = "light" | "dark";

const THEME_KEY = "linguao:theme";

export const LANGUAGES: { key: LanguageKey; label: string }[] = [
  { key: "darija", label: "Darija" },
  { key: "wolof", label: "Wolof" },
  { key: "tahitien", label: "Tahitien" },
];

export const ACCENTS: Record<LanguageKey, [string, string]> = {
  darija: ["#e08a5c", "#c85f3a"],
  wolof: ["#6e7fee", "#4a56c9"],
  tahitien: ["#2fc4bb", "#1f9a92"],
};

const PALETTES: Record<ThemeMode, {
  bg: string;
  bgElevated: string;
  bgElevated2: string;
  text: string;
  textDim: string;
  border: string;
}> = {
  dark: {
    bg: "#0f0e1a",
    bgElevated: "#1c1a2e",
    bgElevated2: "#242138",
    text: "#f3f1f9",
    textDim: "#9d97b8",
    border: "#322e4a",
  },
  light: {
    bg: "#faf9fd",
    bgElevated: "#ffffff",
    bgElevated2: "#f1eff8",
    text: "#211f2e",
    textDim: "#6d6884",
    border: "#e3e0ee",
  },
};

export function useThemeMode() {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setOverride(saved);
    });
  }, []);

  const mode: ThemeMode = override ?? (systemScheme === "light" ? "light" : "dark");

  const toggle = useCallback(() => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setOverride(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }, [mode]);

  return { mode, palette: PALETTES[mode], toggle };
}
