const API_URL = window.location.port === "8000" ? "http://localhost:5000" : "";

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

const chat = document.getElementById("chat");
const emptyState = document.getElementById("empty-state");
const composer = document.getElementById("composer");
const input = document.getElementById("input-text");
const sendBtn = document.getElementById("send-btn");
const langPicker = document.getElementById("lang-picker");
const registerToggle = document.getElementById("register-toggle");

let currentLang = "darija";
let currentRegister = "classique";

langPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".lang-pill");
  if (!btn) return;
  langPicker.querySelectorAll(".lang-pill").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentLang = btn.dataset.lang;
});

registerToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".register-option");
  if (!btn) return;
  registerToggle.querySelectorAll(".register-option").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentRegister = btn.dataset.register;
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 96) + "px";
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

function addBubble(text, className) {
  if (emptyState.parentNode) emptyState.remove();
  const el = document.createElement("div");
  el.className = `bubble ${className}`;
  el.textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

const POLL_TIMEOUT_MS = 3 * 60 * 1000;

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

async function pollJob(jobId, onTick) {
  const start = Date.now();
  const deadline = start + POLL_TIMEOUT_MS;
  let consecutiveFailures = 0;
  while (Date.now() < deadline) {
    await sleep(nextPollDelay(Date.now() - start));
    onTick(Math.round((Date.now() - start) / 1000));
    try {
      const res = await fetch(`${API_URL}/translate/${jobId}`);
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

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addBubble(text, "source");
  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;

  const pending = addBubble("Traduction en cours…", `result pending ${currentLang}`);

  try {
    const res = await fetch(`${API_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: currentLang, register: currentRegister }),
    });
    const data = await res.json();

    if (!res.ok) {
      pending.classList.remove("pending");
      pending.classList.add("error");
      pending.textContent = data.error || "Erreur de traduction.";
      return;
    }

    const translation = await pollJob(data.job_id, (secs) => {
      pending.textContent = `Traduction en cours… (${secs}s)`;
    });
    pending.classList.remove("pending");
    pending.textContent = translation;
  } catch (err) {
    pending.classList.remove("pending");
    pending.classList.add("error");
    pending.textContent = err.message || "Impossible de joindre le serveur. Le backend est-il lancé ?";
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
});
