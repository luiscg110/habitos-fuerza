import "./style.css";
import { createScene } from "./scene.js";
import { rankFor } from "./character.js";
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
    done === 0 ? rank.line : done < TASKS.length ? `${done}/${TASKS.length} · ${rank.line}` : rank.line;

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

resetBtn.addEventListener("click", () => {
  state = resetDay(state);
  hero.setMuscle(0);
  lastRank = "";
  showToast("Día reiniciado. A por todas.");
  syncUI();
});

renderTasks();
syncUI();
