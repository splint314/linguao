const API_URL = "http://localhost:5000";

const appHeader = document.getElementById("app-header");
const chat = document.getElementById("chat");
const emptyState = document.getElementById("empty-state");
const composer = document.getElementById("composer");
const input = document.getElementById("input-text");
const sendBtn = document.getElementById("send-btn");
const langPicker = document.getElementById("lang-picker");
const registerToggle = document.getElementById("register-toggle");

function haptic(ms = 8) {
  navigator.vibrate?.(ms);
}

function spawnRipple(el, x, y) {
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.4;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x - rect.left - size / 2}px`;
  ripple.style.top = `${y - rect.top - size / 2}px`;
  el.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

function bindRipple(container, selector) {
  container.addEventListener("pointerdown", (e) => {
    const target = e.target.closest(selector);
    if (!target) return;
    spawnRipple(target, e.clientX, e.clientY);
  });
}

bindRipple(langPicker, ".lang-pill");
bindRipple(registerToggle, ".register-option");
bindRipple(composer, "#send-btn");

chat.addEventListener("scroll", () => {
  appHeader.classList.toggle("scrolled", chat.scrollTop > 8);
});

let currentLang = "darija";
let currentRegister = "classique";

const ACCENTS = {
  darija: ["--darija", "--darija-2"],
  wolof: ["--wolof", "--wolof-2"],
  tahitien: ["--tahitien", "--tahitien-2"],
};

function applyAccent(lang) {
  const root = document.documentElement;
  const [accent, accent2] = ACCENTS[lang];
  root.style.setProperty("--accent", `var(${accent})`);
  root.style.setProperty("--accent-2", `var(${accent2})`);
}

applyAccent(currentLang);

langPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".lang-pill");
  if (!btn) return;
  langPicker.querySelectorAll(".lang-pill").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentLang = btn.dataset.lang;
  applyAccent(currentLang);
  haptic();
});

registerToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".register-option");
  if (!btn) return;
  registerToggle.querySelectorAll(".register-option").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentRegister = btn.dataset.register;
  haptic();
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
  haptic(12);

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
