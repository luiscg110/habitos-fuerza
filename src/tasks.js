const STORAGE_KEY = "habitos-fuerza-v1";

export const TASKS = [
  {
    id: "teeth",
    title: "Cepillarse los dientes",
    detail: "Mañana y noche cuentan como una.",
    gain: 12,
  },
  {
    id: "room",
    title: "Arreglar el cuarto",
    detail: "Cama, piso y escritorio en orden.",
    gain: 14,
  },
  {
    id: "shower",
    title: "Bañarse",
    detail: "Higiene completa del día.",
    gain: 12,
  },
  {
    id: "water",
    title: "Tomar agua",
    detail: "Al menos 6 vasos hoy.",
    gain: 10,
  },
  {
    id: "move",
    title: "Mover el cuerpo",
    detail: "Caminar, estirar o ejercicio corto.",
    gain: 16,
  },
  {
    id: "eat",
    title: "Comer algo real",
    detail: "Una comida con verdura o proteína.",
    gain: 12,
  },
  {
    id: "sleep",
    title: "Dormir a buena hora",
    detail: "Apagar pantallas y descansar.",
    gain: 14,
  },
  {
    id: "focus",
    title: "Una tarea importante",
    detail: "Estudio, trabajo o un pendiente clave.",
    gain: 10,
  },
];

function todayKey() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function defaultState() {
  return {
    date: todayKey(),
    completed: {},
    lifetime: 0,
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayKey()) {
      return {
        date: todayKey(),
        completed: {},
        lifetime: parsed.lifetime ?? 0,
      };
    }
    return {
      date: parsed.date,
      completed: parsed.completed ?? {},
      lifetime: parsed.lifetime ?? 0,
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetDay(state) {
  const next = {
    ...state,
    date: todayKey(),
    completed: {},
  };
  saveState(next);
  return next;
}

export function toggleTask(state, taskId) {
  const task = TASKS.find((t) => t.id === taskId);
  if (!task) return state;

  const wasDone = Boolean(state.completed[taskId]);
  const completed = { ...state.completed };

  if (wasDone) {
    delete completed[taskId];
  } else {
    completed[taskId] = true;
  }

  const next = {
    ...state,
    date: todayKey(),
    completed,
    lifetime: Math.max(0, state.lifetime + (wasDone ? -1 : 1)),
  };
  saveState(next);
  return { state: next, newlyCompleted: !wasDone, task };
}

export function muscleRatio(state) {
  const total = TASKS.reduce((sum, t) => sum + t.gain, 0);
  const earned = TASKS.reduce(
    (sum, t) => sum + (state.completed[t.id] ? t.gain : 0),
    0,
  );
  return total === 0 ? 0 : earned / total;
}

export function completedCount(state) {
  return TASKS.filter((t) => state.completed[t.id]).length;
}

export function formatToday() {
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}
