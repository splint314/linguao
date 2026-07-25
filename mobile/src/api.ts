import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type { LanguageKey } from "./theme";

const API_URL_KEY = "linguao:apiUrl";
const BACKEND_PORT = 5000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

// En dev via Expo Go, le bundle JS est chargé depuis l'IP LAN de la machine
// de dev (ex: "192.168.1.10:8081"). On réutilise cette IP pour deviner
// l'adresse du backend Flask, qui tourne sur la même machine. En build de
// prod, il n'y a pas de hostUri : l'utilisateur doit renseigner l'adresse
// réelle du serveur via les réglages.
export function guessApiUrl(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ?? (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) return `http://${host}:${BACKEND_PORT}`;
  return `http://localhost:${BACKEND_PORT}`;
}

export async function getStoredApiUrl(): Promise<string | null> {
  return AsyncStorage.getItem(API_URL_KEY);
}

export async function setStoredApiUrl(url: string | null): Promise<void> {
  if (url) {
    await AsyncStorage.setItem(API_URL_KEY, url);
  } else {
    await AsyncStorage.removeItem(API_URL_KEY);
  }
}

export async function resolveApiUrl(): Promise<string> {
  const stored = await getStoredApiUrl();
  return stored || guessApiUrl();
}

export type Register = "classique" | "sms";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Intervalle de polling croissant (avec un peu d'aléatoire) : moins de
// requêtes au total, et un profil moins "robotique" qui évite de déclencher
// la protection anti-bot de Cloudflare (429) sur les requêtes répétées.
// Reprend exactement la logique du client web (frontend/script.js) pour
// rester cohérent avec ce que le serveur de prod tolère.
function nextPollDelay(elapsedMs: number): number {
  let base = 4000;
  if (elapsedMs > 90000) base = 8000;
  else if (elapsedMs > 30000) base = 6000;
  return base + Math.floor(Math.random() * 800);
}

export class TranslateError extends Error {}

async function pollJob(
  apiUrl: string,
  jobId: string,
  onTick?: (secs: number) => void
): Promise<string> {
  const start = Date.now();
  const deadline = start + POLL_TIMEOUT_MS;
  let consecutiveFailures = 0;

  while (Date.now() < deadline) {
    await sleep(nextPollDelay(Date.now() - start));
    onTick?.(Math.round((Date.now() - start) / 1000));
    try {
      const res = await fetch(`${apiUrl}/translate/${jobId}`);
      if (!res.ok) throw new Error("job introuvable");
      const job = await res.json();
      consecutiveFailures = 0;
      if (job.status === "done") return job.translation as string;
      if (job.status === "error") throw new TranslateError(job.error || "Erreur de traduction.");
    } catch (err) {
      if (err instanceof TranslateError) throw err;
      consecutiveFailures += 1;
      if (consecutiveFailures >= 8) throw err;
      await sleep(5000);
    }
  }
  throw new TranslateError("La traduction prend trop de temps, réessaie plus tard.");
}

export async function translate(
  text: string,
  language: LanguageKey,
  register: Register,
  onTick?: (secs: number) => void
): Promise<string> {
  const apiUrl = await resolveApiUrl();
  const res = await fetch(`${apiUrl}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, register }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new TranslateError(data.error || "Erreur de traduction.");
  }
  return pollJob(apiUrl, data.job_id, onTick);
}
