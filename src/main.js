import "./style.css";
import { createScene } from "./scene.js";
import {
  rankFor,
  OUTFITS,
  PART_KEYS,
  PART_LABELS,
  loadOutfitSelection,
  headForStrength,
} from "./character.js";
import {
  TASKS,
  loadState,
  toggleTask,
  resetDay,
  muscleRatio,
  completedCount,
  formatToday,
} from "./tasks.js";

const canvas = document.querySelector("#scene");
const taskList = document.querySelector("#task-list");
const powerFill = document.querySelector("#power-fill");
const powerValue = document.querySelector("#power-value");
const statusLine = document.querySelector("#status-line");
const dateLabel = document.querySelector("#date-label");
const rankLabel = document.querySelector("#rank-label");
const toast = document.querySelector("#toast");
const resetBtn = document.querySelector("#reset-day");
const outfitControls = document.querySelector("#outfit-controls");

const { hero } = createScene(canvas);

let state = loadState();
let toastTimer;
let lastRank = "";

const checkSvg = `
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2.2 6.2 4.8 8.8 9.8 3.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

function showToast(message) {
  toast.hidden = false;
  toast.textContent = message;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.hidden = true;
    }, 350);
  }, 1800);
}

function syncUI() {
  const ratio = muscleRatio(state);
  const pct = Math.round(ratio * 100);
  const done = completedCount(state);
  const rank = rankFor(ratio);

  powerFill.style.width = `${pct}%`;
  powerValue.textContent = `${pct}%`;
  dateLabel.textContent = formatToday();
  rankLabel.textContent = `Rango: ${rank.title}`;
  statusLine.textContent =
    done === 0
      ? rank.line
      : done < TASKS.length
        ? `${done}/${TASKS.length} · ${rank.line}`
        : rank.line;

  if (rank.title !== lastRank && lastRank) {
    showToast(`¡Nuevo rango: ${rank.title}!`);
  }
  lastRank = rank.title;

  for (const btn of taskList.querySelectorAll(".task")) {
    const id = btn.dataset.id;
    btn.classList.toggle("done", Boolean(state.completed[id]));
    btn.setAttribute("aria-pressed", String(Boolean(state.completed[id])));
  }

  hero.setMuscle(ratio);

  // Cabeza progresa con la fuerza: Hoodie → Traje → Aventurero
  const headId = headForStrength(ratio);
  if (hero.selection?.head !== headId) {
    hero.setPart("head", headId);
  }
  const headSelect = document.querySelector("#outfit-head");
  if (headSelect && headSelect.value !== headId) {
    headSelect.value = headId;
  }
}

function renderTasks() {
  taskList.innerHTML = "";
  for (const task of TASKS) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "task";
    btn.dataset.id = task.id;
    btn.innerHTML = `
      <span class="task-check">${checkSvg}</span>
      <span class="task-copy">
        <strong>${task.title}</strong>
        <span>${task.detail}</span>
      </span>
      <span class="task-gain">+${task.gain}</span>
    `;
    btn.addEventListener("click", () => {
      const result = toggleTask(state, task.id);
      state = result.state;
      if (result.newlyCompleted) {
        hero.celebrate();
        showToast(`+${result.task.gain} · ¡sigues creciendo!`);
      }
      syncUI();
    });
    li.appendChild(btn);
    taskList.appendChild(li);
  }
}

function renderOutfitControls() {
  const selection = loadOutfitSelection();
  outfitControls.innerHTML = "";

  for (const part of PART_KEYS) {
    const field = document.createElement("div");
    field.className = "outfit-field";

    const label = document.createElement("label");
    label.htmlFor = `outfit-${part}`;
    label.textContent =
      part === "head" ? `${PART_LABELS[part]} (por fuerza)` : PART_LABELS[part];

    const select = document.createElement("select");
    select.id = `outfit-${part}`;
    select.dataset.part = part;
    if (part === "head") {
      select.disabled = true;
      select.title = "Cambia sola con tu nivel de fuerza";
    }

    for (const outfit of Object.values(OUTFITS)) {
      // Cabeza solo usa Hoodie / Traje / Aventurero
      if (part === "head" && !["casual", "suit", "adventurer"].includes(outfit.id)) {
        continue;
      }
      const option = document.createElement("option");
      option.value = outfit.id;
      option.textContent = outfit.label;
      if (selection[part] === outfit.id) option.selected = true;
      select.appendChild(option);
    }

    if (part !== "head") {
      select.addEventListener("change", () => {
        hero.setPart(part, select.value);
        const name = OUTFITS[select.value]?.label ?? select.value;
        showToast(`${PART_LABELS[part]}: ${name}`);
      });
    }

    field.append(label, select);
    outfitControls.appendChild(field);
  }
}

resetBtn.addEventListener("click", () => {
  state = resetDay(state);
  hero.setMuscle(0);
  lastRank = "";
  showToast("Día reiniciado. A por todas.");
  syncUI();
});

renderTasks();
renderOutfitControls();
syncUI();
