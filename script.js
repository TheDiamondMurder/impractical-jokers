const modeButtons = [...document.querySelectorAll("[data-mode]")];
const extremeToggle = document.querySelector("#extreme-toggle");
const deckCount = document.querySelector("#deck-count");
const drawButtons = [...document.querySelectorAll("[data-draw]")];
const historySection = document.querySelector("#history-section");
const historyList = document.querySelector("#history-list");
const clearHistoryButton = document.querySelector("#clear-history");

const state = {
  mode: "irl",
  extreme: false,
  prompts: null,
  used: new Map(),
  history: loadHistory(),
};

const drawMessages = {
  punishments: ["selecting victim", "measuring embarrassment", "removing dignity", "locking punishment"],
  challenges: ["shuffling disaster", "testing group courage", "making it worse", "locking challenge"],
};

function loadHistory() {
  try {
    const value = JSON.parse(localStorage.getItem("impractical-jokers-history") || "[]");
    return Array.isArray(value) ? value.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem("impractical-jokers-history", JSON.stringify(state.history));
  } catch {
    // The game still works when storage is unavailable.
  }
}

function activePool(type) {
  if (!state.prompts) return [];
  const modeDeck = state.prompts[state.mode]?.[type];
  if (!modeDeck) return [];
  const standard = modeDeck.standard.map((text) => ({ text, level: "standard" }));
  const extreme = state.extreme ? modeDeck.extreme.map((text) => ({ text, level: "extreme" })) : [];
  return [...standard, ...extreme];
}

function updateDeckCount() {
  if (!state.prompts) {
    deckCount.textContent = "loading decks";
    return;
  }
  const punishments = activePool("punishments").length;
  const challenges = activePool("challenges").length;
  deckCount.textContent = `${punishments} punishments / ${challenges} challenges`;
}

function resetCards() {
  document.querySelectorAll(".playing-card").forEach((card) => card.classList.remove("is-revealed"));
}

function selectPrompt(type) {
  const pool = activePool(type);
  if (!pool.length) return null;
  const key = `${state.mode}:${state.extreme}:${type}`;
  const used = state.used.get(key) || new Set();
  let available = pool.filter((prompt) => !used.has(prompt.text));
  if (!available.length) {
    used.clear();
    available = pool;
  }
  const prompt = available[Math.floor(Math.random() * available.length)];
  used.add(prompt.text);
  state.used.set(key, used);
  return prompt;
}

function addHistory(type, prompt) {
  state.history.unshift({
    type,
    text: prompt.text,
    level: prompt.level,
    mode: state.mode,
    createdAt: Date.now(),
  });
  state.history = state.history.slice(0, 8);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  historySection.hidden = state.history.length === 0;
  historyList.innerHTML = state.history.map((item) => `
    <article class="history-item ${item.level === "extreme" ? "is-extreme" : ""}">
      <span class="history-type">${item.type === "punishments" ? "punishment" : "group challenge"}</span>
      <p>${escapeHtml(item.text)}</p>
      <small>${escapeHtml(item.mode)}${item.level === "extreme" ? " / extreme" : ""}</small>
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = original; }, 1100);
  } catch {
    button.textContent = "Copy failed";
  }
}

function draw(type) {
  if (!state.prompts) return;
  const panel = document.querySelector(`[data-deck="${type}"]`);
  if (panel.classList.contains("is-drawing")) return;
  const card = panel.querySelector(".playing-card");
  const overlayText = panel.querySelector(".draw-overlay strong");
  const messages = drawMessages[type];
  let messageIndex = 0;

  card.classList.remove("is-revealed");
  panel.classList.add("is-drawing");
  overlayText.textContent = messages[0];
  const messageTimer = setInterval(() => {
    messageIndex = Math.min(messageIndex + 1, messages.length - 1);
    overlayText.textContent = messages[messageIndex];
  }, 470);

  setTimeout(() => {
    clearInterval(messageTimer);
    const prompt = selectPrompt(type);
    if (!prompt) {
      panel.classList.remove("is-drawing");
      return;
    }
    const resultText = card.querySelector(".result-text");
    const resultLevel = card.querySelector(".result-level");
    resultText.textContent = prompt.text;
    resultText.classList.toggle("is-long", prompt.text.length > 110);
    resultText.classList.toggle("is-very-long", prompt.text.length > 165);
    resultLevel.textContent = prompt.level;
    resultLevel.classList.toggle("is-extreme", prompt.level === "extreme");
    card.querySelector(".copy-action").onclick = (event) => copyText(prompt.text, event.currentTarget);
    panel.classList.remove("is-drawing");
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("is-revealed")));
    addHistory(type, prompt);
  }, 2050);
}

modeButtons.forEach((button) => button.addEventListener("click", () => {
  state.mode = button.dataset.mode;
  modeButtons.forEach((item) => {
    const selected = item === button;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  resetCards();
  updateDeckCount();
}));

extremeToggle.addEventListener("change", () => {
  state.extreme = extremeToggle.checked;
  document.body.classList.toggle("is-extreme", state.extreme);
  resetCards();
  updateDeckCount();
});

drawButtons.forEach((button) => button.addEventListener("click", () => draw(button.dataset.draw)));

clearHistoryButton.addEventListener("click", () => {
  state.history = [];
  saveHistory();
  renderHistory();
});

async function loadPrompts() {
  try {
    const response = await fetch("prompts.json?v=1", { cache: "no-store" });
    if (!response.ok) throw new Error("Prompt library unavailable");
    state.prompts = await response.json();
    updateDeckCount();
  } catch {
    deckCount.textContent = "deck failed to load";
    drawButtons.forEach((button) => { button.disabled = true; });
  }
}

renderHistory();
loadPrompts();
