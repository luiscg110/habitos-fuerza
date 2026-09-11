import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export const POWER_RANKS = [
  { min: 0, title: "Novato", line: "Empieza hoy. El cuerpo escucha." },
  { min: 0.2, title: "En marcha", line: "Ya se nota la disciplina." },
  { min: 0.4, title: "Firme", line: "Más fuerte que ayer." },
  { min: 0.6, title: "Guerrero", line: "Los hábitos te están forjando." },
  { min: 0.8, title: "Imparable", line: "Casi en modo bestia." },
  { min: 1, title: "Bestia", line: "Día completo. Eres de hierro." },
];

export function rankFor(ratio) {
  let current = POWER_RANKS[0];
  for (const r of POWER_RANKS) {
    if (ratio >= r.min) current = r;
  }
  return current;
}

export const OUTFITS = {
  adventurer: {
    id: "adventurer",
    label: "Aventurero",
    file: "/models/adventurer.glb",
    prefix: "Adventurer",
  },
  casual: {
    id: "casual",
    label: "Hoodie",
    file: "/models/hoodie.glb",
    prefix: "Casual",
  },
  punk: {
    id: "punk",
    label: "Punk",
    file: "/models/punk.glb",
    prefix: "Punk",
  },
  suit: {
    id: "suit",
    label: "Traje",
    file: "/models/business.glb",
    prefix: "Suit",
  },
};

export const PART_KEYS = ["head", "body", "legs", "feet"];
export const PART_LABELS = {
  head: "Cabeza",
  body: "Cuerpo",
  legs: "Piernas",
  feet: "Pies",
};

const PART_SUFFIX = {
  head: "Head",
  body: "Body",
  legs: "Legs",
  feet: "Feet",
};

const BULK_BONES = [
  { name: "Chest", max: 1.22 },
  { name: "Torso", max: 1.14 },
  { name: "Abdomen", max: 1.1 },
  { name: "Shoulder.L", max: 1.16 },
  { name: "Shoulder.R", max: 1.16 },
  { name: "UpperArm.L", max: 1.26 },
  { name: "UpperArm.R", max: 1.26 },
  { name: "LowerArm.L", max: 1.14 },
  { name: "LowerArm.R", max: 1.14 },
  { name: "UpperLeg.L", max: 1.18 },
  { name: "UpperLeg.R", max: 1.18 },
  { name: "LowerLeg.L", max: 1.12 },
  { name: "LowerLeg.R", max: 1.12 },
  { name: "Neck", max: 1.08 },
];

const OUTFIT_STORAGE = "habitos-fuerza-outfit-v1";

export function defaultOutfitSelection() {
  return {
    head: "adventurer",
    body: "adventurer",
    legs: "adventurer",
    feet: "adventurer",
  };
}

export function loadOutfitSelection() {
  try {
    const raw = localStorage.getItem(OUTFIT_STORAGE);
    if (!raw) return defaultOutfitSelection();
    const parsed = JSON.parse(raw);
    const base = defaultOutfitSelection();
    for (const key of PART_KEYS) {
      if (OUTFITS[parsed[key]]) base[key] = parsed[key];
    }
    return base;
  } catch {
    return defaultOutfitSelection();
  }
}

export function saveOutfitSelection(selection) {
  localStorage.setItem(OUTFIT_STORAGE, JSON.stringify(selection));
}

export class Hero {
  constructor() {
    this.root = new THREE.Group();
    this.muscle = 0;
    this.targetMuscle = 0;
    this.pulse = 0;
    this.time = 0;
    this.ready = false;
    this.baseScale = 1;
    this.mixers = [];
    this.idleActions = [];
    this.flexActions = [];
    this.bones = [];
    this.models = [];
    /** @type {Record<string, Record<string, THREE.Object3D>>} */
    this.partsByOutfit = {};
    this.selection = loadOutfitSelection();
    this.aura = this.#makeAura();
    this.root.add(this.aura);
    this.#load().catch((err) => {
      console.error(err);
      const loading = document.querySelector("#loading");
      if (loading) {
        loading.hidden = false;
        loading.textContent = "No se pudo cargar el héroe. Recarga.";
      }
    });
  }

  #makeAura() {
    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.028, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0xd6ff4b,
        emissive: 0x88aa22,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.15,
        transparent: true,
        opacity: 0.45,
      }),
    );
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 0.025;
    return aura;
  }

  async #load() {
    const loader = new GLTFLoader();
    const entries = Object.values(OUTFITS);

    const loaded = await Promise.all(
      entries.map(async (outfit) => ({
        outfit,
        gltf: await loader.loadAsync(outfit.file),
      })),
    );

    for (const { outfit, gltf } of loaded) {
      const model = gltf.scene;
      const partMap = {};

      model.traverse((obj) => {
        if (obj.isMesh) {
          if (/backpack/i.test(obj.name)) {
            obj.visible = false;
            return;
          }
          obj.castShadow = true;
          obj.receiveShadow = true;
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          for (const mat of mats) {
            if (!mat) continue;
            mat.roughness = Math.min(mat.roughness ?? 0.7, 0.58);
            mat.metalness = Math.min(mat.metalness ?? 0.05, 0.15);
            mat.envMapIntensity = 1.15;
          }

          for (const [key, suffix] of Object.entries(PART_SUFFIX)) {
            if (obj.name === `${outfit.prefix}_${suffix}`) {
              partMap[key] = obj;
            }
          }
        }
        if (obj.isBone) {
          const conf = BULK_BONES.find((b) => b.name === obj.name);
          if (conf) this.bones.push({ bone: obj, max: conf.max });
        }
      });

      // Encajar cada modelo igual
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 1.9 / Math.max(size.y, 0.001);
      model.scale.setScalar(scale);
      model.position.set(
        -center.x * scale,
        -box.min.y * scale,
        -center.z * scale,
      );
      model.rotation.y = Math.PI * 0.18;
      this.baseScale = scale;

      this.root.add(model);
      this.models.push(model);
      this.partsByOutfit[outfit.id] = partMap;

      if (gltf.animations?.length) {
        const mixer = new THREE.AnimationMixer(model);
        const clips = gltf.animations;
        const idleClip =
          clips.find((a) => a.name.includes("Idle_Neutral")) ||
          clips.find((a) => /\|Idle$/.test(a.name)) ||
          clips[0];
        const flexClip =
          clips.find((a) => a.name.includes("Punch_Right")) ||
          clips.find((a) => a.name.includes("Wave")) ||
          clips.find((a) => a.name.includes("Interact"));

        const idle = mixer.clipAction(idleClip);
        idle.play();
        this.mixers.push(mixer);
        this.idleActions.push(idle);

        if (flexClip) {
          const flex = mixer.clipAction(flexClip);
          flex.setLoop(THREE.LoopOnce);
          flex.clampWhenFinished = true;
          this.flexActions.push(flex);
        }
      }
    }

    this.applyOutfit(this.selection);
    this.ready = true;
    this.setMuscle(this.targetMuscle, true);
    const loading = document.querySelector("#loading");
    if (loading) loading.hidden = true;
  }

  applyOutfit(selection) {
    this.selection = { ...selection };
    saveOutfitSelection(this.selection);

    // Oculta todas las piezas; muestra solo la combinación elegida
    for (const outfit of Object.values(OUTFITS)) {
      const parts = this.partsByOutfit[outfit.id] || {};
      for (const key of PART_KEYS) {
        const mesh = parts[key];
        if (mesh) mesh.visible = false;
      }
    }

    for (const key of PART_KEYS) {
      const outfitId = this.selection[key];
      const mesh = this.partsByOutfit[outfitId]?.[key];
      if (mesh) mesh.visible = true;
    }
  }

  setPart(partKey, outfitId) {
    if (!PART_KEYS.includes(partKey) || !OUTFITS[outfitId]) return;
    this.applyOutfit({ ...this.selection, [partKey]: outfitId });
  }

  setMuscle(value, instant = false) {
    this.targetMuscle = THREE.MathUtils.clamp(value, 0, 1);
    if (instant) this.muscle = this.targetMuscle;
  }

  celebrate() {
    this.pulse = 1;
    this.flexActions.forEach((flex, i) => {
      const idle = this.idleActions[i];
      const mixer = this.mixers[i];
      if (!flex || !idle || !mixer) return;
      idle.fadeOut(0.12);
      flex.reset().fadeIn(0.12).play();
      const onFinished = (e) => {
        if (e.action !== flex) return;
        mixer.removeEventListener("finished", onFinished);
        flex.fadeOut(0.2);
        idle.reset().fadeIn(0.25).play();
      };
      mixer.addEventListener("finished", onFinished);
    });
  }

  update(dt) {
    this.time += dt;
    this.muscle += (this.targetMuscle - this.muscle) * Math.min(1, dt * 3.2);
    this.pulse = Math.max(0, this.pulse - dt * 1.35);
    for (const mixer of this.mixers) mixer.update(dt);
    if (!this.ready) return;

    const m = this.muscle;
    const pump = Math.min(1, m + this.pulse * 0.35);

    for (const { bone, max } of this.bones) {
      bone.scale.setScalar(THREE.MathUtils.lerp(1, max, pump));
    }

    const sx = this.baseScale * (1 + pump * 0.12);
    const sy = this.baseScale * (1 + pump * 0.03);
    const sz = this.baseScale * (1 + pump * 0.1);
    const rotY = Math.PI * 0.18 + Math.sin(this.time * 0.4) * 0.08;
    for (const model of this.models) {
      model.scale.set(sx, sy, sz);
      model.rotation.y = rotY;
    }

    const aura =
      0.9 + m * 0.55 + this.pulse * 0.4 + Math.sin(this.time * 3) * 0.03;
    this.aura.scale.set(aura, aura, 1);
    this.aura.material.opacity = 0.22 + m * 0.45 + this.pulse * 0.3;
    this.aura.material.emissiveIntensity = 0.35 + m * 1.0 + this.pulse * 1.3;
    this.aura.rotation.z = this.time * 0.55;
  }
}

export function attachEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}
