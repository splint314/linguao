import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import LangPicker from "./src/components/LangPicker";
import RegisterToggle from "./src/components/RegisterToggle";
import SettingsSheet from "./src/components/SettingsSheet";
import { ACCENTS, LanguageKey, useThemeMode } from "./src/theme";
import { Register, translate } from "./src/api";

type HistoryEntry = {
  id: string;
  source: string;
  result: string;
  lang: LanguageKey;
  register: Register;
};

const LANG_NAMES: Record<LanguageKey, string> = {
  darija: "Darija",
  wolof: "Wolof",
  tahitien: "Tahitien",
};

const MAX_HISTORY = 8;

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return String(idCounter);
}

type ResultState =
  | { type: "idle" }
  | { type: "pending"; secs: number }
  | { type: "error"; message: string }
  | { type: "done"; text: string };

function AppContent() {
  const { mode, palette, toggle: toggleTheme } = useThemeMode();
  const [lang, setLang] = useState<LanguageKey>("darija");
  const [register, setRegister] = useState<Register>("classique");
  const [input, setInput] = useState("");
  const [resultLang, setResultLang] = useState<LanguageKey>("darija");
  const [result, setResult] = useState<ResultState>({ type: "idle" });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [accent] = ACCENTS[lang];
  const sending = result.type === "pending";

  // Changer de langue/registre n'annule pas une traduction en cours, mais
  // n'en relance pas une nouvelle automatiquement : le serveur traite les
  // traductions une par une (CPU only), inutile de créer des jobs à chaque
  // tape sur un bouton. L'utilisateur retape "Traduire" explicitement.
  const changeLang = (next: LanguageKey) => {
    if (next === lang) return;
    Haptics.selectionAsync().catch(() => {});
    setLang(next);
  };

  const changeRegister = (next: Register) => {
    if (next === register) return;
    setRegister(next);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setResultLang(lang);
    setResult({ type: "pending", secs: 0 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const translation = await translate(text, lang, register, (secs) => {
        setResult((prev) => (prev.type === "pending" ? { type: "pending", secs } : prev));
      });
      setResult({ type: "done", text: translation });
      setHistory((prev) =>
        [
          { id: nextId(), source: text, result: translation, lang, register },
          ...prev,
        ].slice(0, MAX_HISTORY)
      );
    } catch (err: any) {
      // fetch() échoue avec un TypeError générique ("Network request failed")
      // quand le serveur est injoignable : message peu parlant, on le
      // remplace. Les TranslateError ont un message utile qu'on garde.
      const message =
        err instanceof TypeError
          ? "Impossible de joindre le serveur. Le backend est-il lancé ?"
          : err?.message || "Erreur de traduction.";
      setResult({ type: "error", message });
    }
  };

  const clear = () => {
    setInput("");
    setResult({ type: "idle" });
  };

  const copyResult = async () => {
    if (result.type !== "done") return;
    await Clipboard.setStringAsync(result.text);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => setCopied(false), 1400);
  };

  const restoreHistory = (entry: HistoryEntry) => {
    setInput(entry.source);
    setLang(entry.lang);
    setRegister(entry.register);
    setResultLang(entry.lang);
    setResult({ type: "done", text: entry.result });
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.app, { backgroundColor: palette.bg }]} edges={["top", "bottom"]}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={[styles.brandMark, { backgroundColor: accent }]}>
            <Ionicons name="language-outline" size={18} color="#fff" />
          </View>
          <View>
            <Text style={[styles.title, { color: palette.text }]}>Linguao</Text>
            <Text style={[styles.subtitle, { color: palette.textDim }]}>Darija · Wolof · Tahitien</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={toggleTheme}
            style={[styles.iconBtn, { borderColor: palette.border, backgroundColor: palette.bgElevated }]}
            accessibilityLabel="Changer de thème"
          >
            <Ionicons name={mode === "dark" ? "sunny-outline" : "moon-outline"} size={17} color={palette.textDim} />
          </Pressable>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            style={[styles.iconBtn, { borderColor: palette.border, backgroundColor: palette.bgElevated }]}
            accessibilityLabel="Réglages du serveur"
          >
            <Ionicons name="settings-outline" size={17} color={palette.textDim} />
          </Pressable>
        </View>
      </View>

      <View style={styles.controls}>
        <LangPicker
          value={lang}
          onChange={changeLang}
          borderColor={palette.border}
          surfaceColor={palette.bgElevated}
          textDim={palette.textDim}
        />
        <RegisterToggle
          value={register}
          onChange={changeRegister}
          borderColor={palette.border}
          surfaceColor={palette.bgElevated}
          textColor={palette.text}
          textDim={palette.textDim}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: palette.bgElevated, borderColor: palette.border }]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardLabel, { color: palette.textDim }]}>FRANÇAIS</Text>
              <Pressable onPress={clear}>
                <Text style={[styles.textBtn, { color: palette.textDim }]}>Effacer</Text>
              </Pressable>
            </View>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Écris ta phrase en français..."
              placeholderTextColor={palette.textDim}
              style={[styles.textInput, { color: palette.text }]}
              multiline
              maxLength={500}
            />
            <View style={[styles.cardFoot, { borderTopColor: palette.border }]}>
              <Text style={[styles.charCount, { color: palette.textDim }]}>
                {input.length} caractère{input.length === 1 ? "" : "s"}
              </Text>
              <Pressable
                onPress={send}
                disabled={sending || !input.trim()}
                style={[styles.sendBtn, { backgroundColor: accent, opacity: sending || !input.trim() ? 0.5 : 1 }]}
              >
                <Text style={styles.sendBtnText}>Traduire</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.bgElevated, borderColor: palette.border }]}>
            <View style={styles.cardHead}>
              <View style={styles.resultLabelRow}>
                <View style={[styles.resultDot, { backgroundColor: ACCENTS[resultLang][0] }]} />
                <Text style={[styles.cardLabel, { color: palette.textDim }]}>{LANG_NAMES[resultLang]}</Text>
              </View>
              <Pressable onPress={copyResult} disabled={result.type !== "done"}>
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={16}
                  color={result.type === "done" ? (copied ? ACCENTS.tahitien[0] : palette.textDim) : palette.border}
                />
              </Pressable>
            </View>

            {result.type === "idle" && (
              <Text style={[styles.resultText, { color: palette.textDim }]}>La traduction apparaîtra ici.</Text>
            )}
            {result.type === "pending" && (
              <Text style={[styles.resultText, styles.pendingText, { color: palette.textDim }]}>
                Traduction en cours… ({result.secs}s)
              </Text>
            )}
            {result.type === "error" && (
              <Text style={[styles.resultText, styles.errorText]}>{result.message}</Text>
            )}
            {result.type === "done" && (
              <Text style={[styles.resultText, { color: palette.text }]}>{result.text}</Text>
            )}
          </View>

          {history.length > 0 && (
            <View style={styles.historySection}>
              <Text style={[styles.historyTitle, { color: palette.textDim }]}>TRADUCTIONS RÉCENTES</Text>
              {history.map((entry) => (
                <Pressable
                  key={entry.id}
                  onPress={() => restoreHistory(entry)}
                  style={[styles.historyItem, { backgroundColor: palette.bgElevated, borderColor: palette.border }]}
                >
                  <Text style={[styles.historySource, { color: palette.textDim }]} numberOfLines={1}>
                    {entry.source}
                  </Text>
                  <Text style={[styles.historyResult, { color: palette.text }]} numberOfLines={1}>
                    {entry.result}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        bgElevated={palette.bgElevated}
        border={palette.border}
        text={palette.text}
        textDim={palette.textDim}
        accent={accent}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  app: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    flexWrap: "wrap",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    minHeight: 150,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  textBtn: {
    fontSize: 12,
    fontWeight: "600",
  },
  textInput: {
    minHeight: 70,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: "top",
  },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  charCount: {
    fontSize: 11,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  sendBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  resultLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  resultText: {
    fontSize: 15,
    lineHeight: 21,
  },
  pendingText: {
    fontStyle: "italic",
  },
  errorText: {
    color: "#d1554f",
    fontSize: 13,
  },
  historySection: {
    gap: 8,
    marginTop: 4,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  historyItem: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  historySource: {
    fontSize: 12,
    marginBottom: 2,
  },
  historyResult: {
    fontSize: 14,
    fontWeight: "500",
  },
});
