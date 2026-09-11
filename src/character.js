import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export class Hero {
  constructor() {
    this.root = new THREE.Group();
    this.muscle = 0;
    this.targetMuscle = 0;
    this.pulse = 0;
    this.time = 0;
    this.ready = false;
    this.mixer = null;
    this.idleAction = null;
    this.flexAction = null;
    this.model = null;
    this.bodyMeshes = [];
    this.baseScale = 1;
    this.aura = this.#makeAura();
    this.root.add(this.aura);
    this.#load();
  }

  #makeAura() {
    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.025, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0xd6ff4b,
        emissive: 0x88aa22,
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.15,
        transparent: true,
        opacity: 0.45,
      }),
    );
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 0.02;
    return aura;
  }

  async #load() {
    const loader = new GLTFLoader();
    // Quaternius "Hoodie Character" (CC0 via poly.pizza)
    const gltf = await loader.loadAsync("/models/hoodie.glb");
    const model = gltf.scene;

    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;

      const sourceMats = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      const nextMats = sourceMats.map((mat) => {
        if (!mat) return mat;
        const cloned = mat.clone();
        cloned.side = THREE.FrontSide;
        cloned.roughness = 0.55;
        cloned.metalness = 0.08;
        cloned.envMapIntensity = 1.25;
        if (cloned.color) {
          // Empuja un poco hacia tonos más claros para que no se pierda en el fondo
          cloned.color.offsetHSL(0, 0.02, 0.08);
        }
        return cloned;
      });
      obj.material = Array.isArray(obj.material) ? nextMats : nextMats[0];

      if (/body|leg|head|feet/i.test(obj.name)) {
        this.bodyMeshes.push(obj);
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
    model.rotation.y = Math.PI * 0.2;

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
        clips.find((a) => a.name.includes("Wave")) ||
        clips.find((a) => a.name.includes("Punch_Right"));

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

    const m = this.muscle;
    if (this.ready && this.model) {
      // Crecimiento visible sin romper el skinning
      const sx = this.baseScale * (1 + m * 0.12 + this.pulse * 0.05);
      const sy = this.baseScale * (1 + m * 0.04 + this.pulse * 0.02);
      const sz = this.baseScale * (1 + m * 0.14 + this.pulse * 0.06);
      this.model.scale.set(sx, sy, sz);
      this.model.rotation.y = Math.PI * 0.2 + Math.sin(this.time * 0.4) * 0.06;
    }

    const auraScale =
      0.95 + m * 0.45 + this.pulse * 0.35 + Math.sin(this.time * 3) * 0.025;
    this.aura.scale.set(auraScale, auraScale, 1);
    this.aura.material.opacity = 0.22 + m * 0.35 + this.pulse * 0.28;
    this.aura.material.emissiveIntensity = 0.28 + m * 0.7 + this.pulse * 1.0;
    this.aura.rotation.z = this.time * 0.5;
  }
}

export function attachEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}
