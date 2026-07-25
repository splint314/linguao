// Nettoyage : une version précédente enregistrait un Service Worker.
// On le désinscrit pour éviter qu'il ne serve du contenu périmé en cache.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
  if (window.caches) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

const API_URL_KEY = "linguao:apiUrl";
const THEME_KEY = "linguao:theme";
const HISTORY_KEY = "linguao:history";
const MAX_HISTORY = 8;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

// En dev local (frontend servi par `python -m http.server 8000`), le backend
// tourne séparément sur le port 5000. En production, le frontend est servi
// derrière le même reverse proxy (Cloudflare) que l'API : les requêtes
// restent donc relatives (même origine), pas d'URL absolue codée en dur.
function guessApiUrl() {
  return window.location.port === "8000" ? "http://localhost:5000" : "";
}

function getApiUrl() {
  const stored = localStorage.getItem(API_URL_KEY);
  return stored || guessApiUrl();
}

const LANG_NAMES = { darija: "Darija", wolof: "Wolof", tahitien: "Tahitien" };
const ACCENTS = {
  darija: ["--darija", "--darija-2"],
  wolof: ["--wolof", "--wolof-2"],
  tahitien: ["--tahitien", "--tahitien-2"],
};

const input = document.getElementById("input-text");
const charCount = document.getElementById("char-count");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");
const composer = document.getElementById("composer");
const panelResult = document.getElementById("panel-result");
const resultLabel = document.getElementById("result-label");
const copyBtn = document.getElementById("copy-btn");
const langPicker = document.getElementById("lang-picker");
const registerToggle = document.getElementById("register-toggle");
const themeToggle = document.getElementById("theme-toggle");
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const apiUrlInput = document.getElementById("api-url-input");
const apiUrlSave = document.getElementById("api-url-save");
const settingsHint = document.getElementById("settings-hint");
const historySection = document.getElementById("history");
const historyList = document.getElementById("history-list");

let currentLang = "darija";
let currentRegister = "classique";
let lastResultText = null;
let requestSeq = 0;

function haptic(ms = 8) {
  navigator.vibrate?.(ms);
}

/* ---------- Theme ---------- */

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.documentElement.setAttribute("data-theme", saved);
}

function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  haptic();
}

initTheme();
themeToggle.addEventListener("click", toggleTheme);

/* ---------- Settings ---------- */

function refreshSettingsHint() {
  const current = getApiUrl();
  settingsHint.textContent = `Actuellement : ${current || "même origine que la page"}`;
}

settingsToggle.addEventListener("click", () => {
  const opening = settingsPanel.hasAttribute("hidden");
  if (opening) {
    apiUrlInput.value = localStorage.getItem(API_URL_KEY) || "";
    apiUrlInput.placeholder = guessApiUrl() || "même origine que la page";
    refreshSettingsHint();
  }
  settingsPanel.toggleAttribute("hidden");
  haptic();
});

apiUrlSave.addEventListener("click", () => {
  const value = apiUrlInput.value.trim().replace(/\/+$/, "");
  if (value) {
    localStorage.setItem(API_URL_KEY, value);
  } else {
    localStorage.removeItem(API_URL_KEY);
  }
  refreshSettingsHint();
  haptic();
});

/* ---------- Language / register pickers ---------- */

function applyAccent(lang) {
  const root = document.documentElement;
  const [accent, accent2] = ACCENTS[lang];
  root.style.setProperty("--accent", `var(${accent})`);
  root.style.setProperty("--accent-2", `var(${accent2})`);
}

function updateResultLabel() {
  resultLabel.textContent = "";
  const dot = document.createElement("span");
  dot.className = "result-dot";
  dot.setAttribute("aria-hidden", "true");
  resultLabel.appendChild(dot);
  resultLabel.appendChild(document.createTextNode(LANG_NAMES[currentLang]));
}

function syncLangPicker() {
  langPicker.querySelectorAll(".lang-pill").forEach((b) => {
    const active = b.dataset.lang === currentLang;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
}

function syncRegisterToggle() {
  registerToggle.querySelectorAll(".register-option").forEach((b) => {
    const active = b.dataset.register === currentRegister;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
}

applyAccent(currentLang);
updateResultLabel();

// On ne relance pas automatiquement une traduction en changeant de langue ou
// de registre : le serveur traite les traductions une par une (CPU only,
// pas de GPU), inutile de créer des jobs à chaque clic. L'utilisateur
// reclique sur "Traduire" pour la nouvelle combinaison.
langPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".lang-pill");
  if (!btn || btn.dataset.lang === currentLang) return;
  currentLang = btn.dataset.lang;
  syncLangPicker();
  applyAccent(currentLang);
  updateResultLabel();
  resetResultPanel();
  haptic();
});

registerToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".register-option");
  if (!btn || btn.dataset.register === currentRegister) return;
  currentRegister = btn.dataset.register;
  syncRegisterToggle();
  resetResultPanel();
  haptic();
});

/* ---------- Composer ---------- */

function updateCharCount() {
  const n = input.value.length;
  charCount.textContent = `${n} caractère${n === 1 ? "" : "s"}`;
}

function resetResultPanel() {
  requestSeq += 1;
  panelResult.textContent = "";
  const placeholder = document.createElement("p");
  placeholder.className = "result-placeholder";
  placeholder.id = "result-placeholder";
  placeholder.textContent = "La traduction apparaîtra ici.";
  panelResult.appendChild(placeholder);
  copyBtn.disabled = true;
  lastResultText = null;
}

function setPending(label) {
  panelResult.textContent = "";
  const p = document.createElement("p");
  p.className = "result-text pending";
  p.textContent = label;
  panelResult.appendChild(p);
  copyBtn.disabled = true;
  lastResultText = null;
  return p;
}

function setError(message) {
  panelResult.textContent = "";
  const p = document.createElement("p");
  p.className = "result-text error";
  p.textContent = message;
  panelResult.appendChild(p);
  copyBtn.disabled = true;
  lastResultText = null;
}

function setResult(text) {
  panelResult.textContent = "";
  const p = document.createElement("p");
  p.className = "result-text";
  p.textContent = text;
  panelResult.appendChild(p);
  copyBtn.disabled = false;
  lastResultText = text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Intervalle de polling croissant (avec un peu d'aléatoire) : moins de
// requêtes au total, et un profil moins "robotique" qui évite de déclencher
// la protection anti-bot de Cloudflare (429) sur les requêtes répétées.
function nextPollDelay(elapsedMs) {
  let base = 4000;
  if (elapsedMs > 90000) base = 8000;
  else if (elapsedMs > 30000) base = 6000;
  return base + Math.floor(Math.random() * 800);
}

async function pollJob(jobId, seq, onTick) {
  const start = Date.now();
  const deadline = start + POLL_TIMEOUT_MS;
  let consecutiveFailures = 0;
  while (Date.now() < deadline) {
    await sleep(nextPollDelay(Date.now() - start));
    if (seq !== requestSeq) return null;
    onTick(Math.round((Date.now() - start) / 1000));
    try {
      const res = await fetch(`${getApiUrl()}/translate/${jobId}`);
      if (!res.ok) throw new Error("job introuvable");
      const job = await res.json();
      consecutiveFailures = 0;
      if (job.status === "done") return job.translation;
      if (job.status === "error") throw new Error(job.error || "Erreur de traduction.");
    } catch (err) {
      // On tolère plusieurs ratés ponctuels (429 anti-bot Cloudflare, réseau...)
      // avant d'abandonner, avec une pause plus longue pour laisser retomber
      // une éventuelle limitation de débit, plutôt que d'insister aussitôt.
      consecutiveFailures += 1;
      if (consecutiveFailures >= 8) throw err;
      await sleep(5000);
    }
  }
  throw new Error("La traduction prend trop de temps, réessaie plus tard.");
}

async function runTranslate() {
  const text = input.value.trim();
  if (!text) return;

  const seq = ++requestSeq;
  const lang = currentLang;
  const register = currentRegister;
  const pending = setPending("Traduction en cours…");
  sendBtn.disabled = true;

  try {
    const res = await fetch(`${getApiUrl()}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: lang, register }),
    });
    const data = await res.json();
    if (seq !== requestSeq) return;

    if (!res.ok) {
      setError(data.error || "Erreur de traduction.");
      return;
    }

    const translation = await pollJob(data.job_id, seq, (secs) => {
      if (seq !== requestSeq) return;
      pending.textContent = `Traduction en cours… (${secs}s)`;
    });
    if (seq !== requestSeq || translation === null) return;

    setResult(translation);
    pushHistory(text, translation, lang, register);
  } catch (err) {
    if (seq !== requestSeq) return;
    // fetch() échoue avec un TypeError générique ("Failed to fetch") quand le
    // serveur est injoignable (backend arrêté, mauvaise URL, CORS...) : ce
    // message brut du navigateur n'est pas parlant, on le remplace. Les
    // autres erreurs (levées explicitement dans pollJob ou par le serveur)
    // ont un message utile qu'on garde tel quel.
    if (err instanceof TypeError) {
      setError("Impossible de joindre le serveur. Le backend est-il lancé ?");
    } else {
      setError(err.message || "Erreur de traduction.");
    }
  } finally {
    if (seq === requestSeq) sendBtn.disabled = false;
  }
}

input.addEventListener("input", updateCharCount);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    runTranslate();
  }
});

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  runTranslate();
});

clearBtn.addEventListener("click", () => {
  input.value = "";
  updateCharCount();
  resetResultPanel();
  input.focus();
  haptic();
});

copyBtn.addEventListener("click", async () => {
  if (!lastResultText) return;
  try {
    await navigator.clipboard.writeText(lastResultText);
    copyBtn.classList.add("copied");
    haptic();
    setTimeout(() => copyBtn.classList.remove("copied"), 1400);
  } catch (err) {
    // Presse-papier indisponible (permissions, contexte non sécurisé...) : on ignore silencieusement.
  }
});

/* ---------- History ---------- */

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function pushHistory(source, result, lang, register) {
  const list = loadHistory();
  list.unshift({ source, result, lang, register });
  const trimmed = list.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  renderHistory(trimmed);
}

function renderHistory(list) {
  historyList.textContent = "";
  if (!list.length) {
    historySection.hidden = true;
    return;
  }
  historySection.hidden = false;

  list.forEach((item) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item";

    const source = document.createElement("p");
    source.className = "history-source";
    source.textContent = item.source;

    const result = document.createElement("p");
    result.className = "history-result";
    result.textContent = item.result;

    btn.appendChild(source);
    btn.appendChild(result);

    btn.addEventListener("click", () => {
      requestSeq += 1;
      input.value = item.source;
      updateCharCount();
      currentLang = item.lang;
      currentRegister = item.register;
      syncLangPicker();
      syncRegisterToggle();
      applyAccent(currentLang);
      updateResultLabel();
      setResult(item.result);
      input.focus();
      haptic();
    });

    li.appendChild(btn);
    historyList.appendChild(li);
  });
}

renderHistory(loadHistory());
