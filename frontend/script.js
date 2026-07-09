const API_URL = "http://localhost:5000";

const chat = document.getElementById("chat");
const emptyState = document.getElementById("empty-state");
const composer = document.getElementById("composer");
const input = document.getElementById("input-text");
const sendBtn = document.getElementById("send-btn");
const langPicker = document.getElementById("lang-picker");
const registerToggle = document.getElementById("register-toggle");

let currentLang = "darija";
let currentRegister = "classique";

langPicker.querySelector(`[data-lang="${currentLang}"]`).classList.add("active");

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

function addBubble(text, className) {
  emptyState.remove?.();
  const el = document.createElement("div");
  el.className = `bubble ${className}`;
  el.textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function typeReveal(el, text) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    el.textContent = text;
    return;
  }
  el.textContent = "";
  let i = 0;
  const step = () => {
    el.textContent += text[i];
    i += 1;
    chat.scrollTop = chat.scrollHeight;
    if (i < text.length) requestAnimationFrame(() => setTimeout(step, 12));
  };
  step();
}

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addBubble(text, "source");
  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;

  const pending = addBubble("...", `result pending ${currentLang}`);

  try {
    const res = await fetch(`${API_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: currentLang, register: currentRegister }),
    });
    const data = await res.json();

    pending.classList.remove("pending");
    if (!res.ok) {
      pending.classList.add("error");
      pending.textContent = data.error || "Erreur de traduction.";
    } else {
      typeReveal(pending, data.translation);
    }
  } catch (err) {
    pending.classList.remove("pending");
    pending.classList.add("error");
    pending.textContent = "Impossible de joindre le serveur. Le backend est-il lancé ?";
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
