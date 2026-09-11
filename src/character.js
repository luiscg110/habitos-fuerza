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

export class Hero {
  constructor() {
    this.root = new THREE.Group();
    this.muscle = 0;
    this.targetMuscle = 0;
    this.pulse = 0;
    this.time = 0;
    this.ready = false;
    this.model = null;
    this.mixer = null;
    this.idleAction = null;
    this.flexAction = null;
    this.bones = [];
    this.baseScale = 1;
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
    // Quaternius Adventurer (CC0) — héroe con ropa
    const gltf = await loader.loadAsync("/models/hero.glb");
    const model = gltf.scene;

    model.traverse((obj) => {
      if (obj.isMesh) {
        // Sin mochila: se ve mejor el personaje
        if (/backpack/i.test(obj.name)) {
          obj.visible = false;
          return;
        }
        obj.castShadow = true;
        obj.receiveShadow = true;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.roughness = Math.min(mat.roughness ?? 0.7, 0.58);
          mat.metalness = Math.min(mat.metalness ?? 0.05, 0.15);
          mat.envMapIntensity = 1.15;
        }
      }
      if (obj.isBone) {
        const conf = BULK_BONES.find((b) => b.name === obj.name);
        if (conf) this.bones.push({ bone: obj, max: conf.max });
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    this.baseScale = 1.9 / Math.max(size.y, 0.001);
    model.scale.setScalar(this.baseScale);
    model.position.set(
      -center.x * this.baseScale,
      -box.min.y * this.baseScale,
      -center.z * this.baseScale,
    );
    model.rotation.y = Math.PI * 0.18;

    this.model = model;
    this.root.add(model);

    if (gltf.animations?.length) {
      this.mixer = new THREE.AnimationMixer(model);
      const clips = gltf.animations;
      const idleClip =
        clips.find((a) => a.name.includes("Idle_Neutral")) ||
        clips.find((a) => /\|Idle$/.test(a.name)) ||
        clips[0];
      const flexClip =
        clips.find((a) => a.name.includes("Punch_Right")) ||
        clips.find((a) => a.name.includes("Wave")) ||
        clips.find((a) => a.name.includes("Interact"));

      this.idleAction = this.mixer.clipAction(idleClip);
      this.idleAction.play();

      if (flexClip) {
        this.flexAction = this.mixer.clipAction(flexClip);
        this.flexAction.setLoop(THREE.LoopOnce);
        this.flexAction.clampWhenFinished = true;
      }
    }

    this.ready = true;
    this.setMuscle(this.targetMuscle, true);
    const loading = document.querySelector("#loading");
    if (loading) loading.hidden = true;
  }

  setMuscle(value, instant = false) {
    this.targetMuscle = THREE.MathUtils.clamp(value, 0, 1);
    if (instant) this.muscle = this.targetMuscle;
  }

  celebrate() {
    this.pulse = 1;
    if (this.flexAction && this.idleAction && this.mixer) {
      this.idleAction.fadeOut(0.12);
      this.flexAction.reset().fadeIn(0.12).play();
      const onFinished = (e) => {
        if (e.action !== this.flexAction) return;
        this.mixer.removeEventListener("finished", onFinished);
        this.flexAction.fadeOut(0.2);
        this.idleAction.reset().fadeIn(0.25).play();
      };
      this.mixer.addEventListener("finished", onFinished);
    }
  }

  update(dt) {
    this.time += dt;
    this.muscle += (this.targetMuscle - this.muscle) * Math.min(1, dt * 3.2);
    this.pulse = Math.max(0, this.pulse - dt * 1.35);
    if (this.mixer) this.mixer.update(dt);
    if (!this.ready || !this.model) return;

    const m = this.muscle;
    const pump = Math.min(1, m + this.pulse * 0.35);

    for (const { bone, max } of this.bones) {
      bone.scale.setScalar(THREE.MathUtils.lerp(1, max, pump));
    }

    const sx = this.baseScale * (1 + pump * 0.12);
    const sy = this.baseScale * (1 + pump * 0.03);
    const sz = this.baseScale * (1 + pump * 0.1);
    this.model.scale.set(sx, sy, sz);
    this.model.rotation.y = Math.PI * 0.18 + Math.sin(this.time * 0.4) * 0.08;

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
