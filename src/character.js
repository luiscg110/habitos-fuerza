import * as THREE from "three";
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

function skin(hex, roughness = 0.48) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness,
    metalness: 0.04,
  });
}

function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Héroe a torso desnudo: se ve el cuerpo (pecho, abs, brazos, piernas).
 * Crece músculo al completar hábitos.
 */
export class Hero {
  constructor() {
    this.root = new THREE.Group();
    this.muscle = 0;
    this.targetMuscle = 0;
    this.pulse = 0;
    this.flex = 0;
    this.flexTarget = 0;
    this.time = 0;
    this.ready = true;

    this.skin = skin(0xe6b089);
    this.skinDeep = skin(0xd4926a, 0.55);
    this.skinHot = skin(0xc97858, 0.5);
    this.hair = skin(0x1a120e, 0.85);
    this.shorts = skin(0x1a2430, 0.7);
    this.band = skin(0xd6ff4b, 0.45);
    this.eye = skin(0x111111, 0.35);

    this.parts = {};
    this.#build();
    this.setMuscle(0, true);

    const loading = document.querySelector("#loading");
    if (loading) loading.hidden = true;
  }

  #add(name, geo, mat, parent, pos) {
    const m = mesh(geo, mat);
    if (pos) m.position.set(...pos);
    this.parts[name] = m;
    parent.add(m);
    return m;
  }

  #build() {
    this.body = new THREE.Group();
    this.root.add(this.body);

    // Cabeza
    this.#add("head", new THREE.SphereGeometry(0.24, 28, 22), this.skin, this.body, [0, 1.72, 0]);
    this.parts.head.scale.set(0.95, 1.05, 0.92);
    this.#add("hair", new THREE.SphereGeometry(0.25, 20, 14), this.hair, this.body, [0, 1.84, -0.03]);
    this.parts.hair.scale.set(1.05, 0.72, 1.08);
    this.#add("jaw", new THREE.SphereGeometry(0.16, 18, 12), this.skinDeep, this.body, [0, 1.58, 0.05]);
    this.parts.jaw.scale.set(1.1, 0.65, 1);

    for (const s of [-1, 1]) {
      const brow = mesh(new THREE.BoxGeometry(0.1, 0.022, 0.03), this.hair);
      brow.position.set(s * 0.08, 1.76, 0.19);
      brow.rotation.z = s * -0.3;
      this.body.add(brow);
      const eye = mesh(new THREE.SphereGeometry(0.028, 10, 8), this.eye);
      eye.position.set(s * 0.07, 1.7, 0.21);
      this.body.add(eye);
    }

    // Cuello
    this.#add("neck", new THREE.CylinderGeometry(0.09, 0.12, 0.16, 14), this.skin, this.body, [0, 1.46, 0]);

    // Traps
    this.traps = new THREE.Group();
    this.traps.position.y = 1.36;
    this.body.add(this.traps);
    this.#add("trapL", new THREE.SphereGeometry(0.12, 14, 12), this.skinDeep, this.traps, [-0.14, 0.02, -0.02]);
    this.#add("trapR", new THREE.SphereGeometry(0.12, 14, 12), this.skinDeep, this.traps, [0.14, 0.02, -0.02]);

    // Hombros + torso desnudo
    this.shoulders = new THREE.Group();
    this.shoulders.position.y = 1.26;
    this.body.add(this.shoulders);

    this.#add("deltL", new THREE.SphereGeometry(0.14, 16, 14), this.skin, this.shoulders, [-0.34, 0.02, 0]);
    this.#add("deltR", new THREE.SphereGeometry(0.14, 16, 14), this.skin, this.shoulders, [0.34, 0.02, 0]);
    this.#add("pecL", new THREE.SphereGeometry(0.18, 18, 14), this.skinDeep, this.shoulders, [-0.14, -0.05, 0.12]);
    this.#add("pecR", new THREE.SphereGeometry(0.18, 18, 14), this.skinDeep, this.shoulders, [0.14, -0.05, 0.12]);
    this.#add("chest", new THREE.BoxGeometry(0.4, 0.36, 0.26), this.skin, this.shoulders, [0, -0.06, 0]);

    // Abs visibles
    this.abs = new THREE.Group();
    this.abs.position.y = 0.9;
    this.body.add(this.abs);
    const spots = [
      [-0.07, 0.14],
      [0.07, 0.14],
      [-0.07, 0.01],
      [0.07, 0.01],
      [-0.07, -0.12],
      [0.07, -0.12],
    ];
    spots.forEach(([x, y], i) => {
      this.#add(`abs${i}`, new THREE.BoxGeometry(0.11, 0.1, 0.09), this.skinHot, this.abs, [x, y, 0.09]);
    });
    this.#add("obL", new THREE.BoxGeometry(0.09, 0.3, 0.11), this.skinDeep, this.abs, [-0.18, 0.01, 0.02]);
    this.#add("obR", new THREE.BoxGeometry(0.09, 0.3, 0.11), this.skinDeep, this.abs, [0.18, 0.01, 0.02]);

    // Shorts (únicas prendas)
    this.#add("hips", new THREE.CylinderGeometry(0.2, 0.24, 0.26, 16), this.shorts, this.body, [0, 0.66, 0]);
    const belt = this.#add("belt", new THREE.TorusGeometry(0.22, 0.02, 8, 24), this.band, this.body, [0, 0.78, 0]);
    belt.rotation.x = Math.PI / 2;

    this.armL = this.#arm(-1);
    this.armR = this.#arm(1);
    this.shoulders.add(this.armL.root, this.armR.root);

    this.legL = this.#leg(-1);
    this.legR = this.#leg(1);
    this.body.add(this.legL.root, this.legR.root);

    this.aura = mesh(
      new THREE.TorusGeometry(0.62, 0.03, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0xd6ff4b,
        emissive: 0x88aa22,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.45,
        roughness: 0.35,
      }),
    );
    this.aura.rotation.x = Math.PI / 2;
    this.aura.position.y = 0.03;
    this.root.add(this.aura);
  }

  #arm(side) {
    const root = new THREE.Group();
    root.position.set(side * 0.38, 0, 0);
    const upper = mesh(new THREE.CapsuleGeometry(0.085, 0.26, 6, 12), this.skin);
    upper.position.set(side * 0.05, -0.2, 0);
    upper.rotation.z = side * 0.2;
    const bicep = mesh(new THREE.SphereGeometry(0.1, 14, 12), this.skinHot);
    bicep.position.set(side * 0.07, -0.12, 0.05);
    const tri = mesh(new THREE.SphereGeometry(0.08, 12, 10), this.skinDeep);
    tri.position.set(side * 0.04, -0.18, -0.05);
    const lower = mesh(new THREE.CapsuleGeometry(0.065, 0.24, 6, 10), this.skin);
    lower.position.set(side * 0.1, -0.48, 0.02);
    const fist = mesh(new THREE.SphereGeometry(0.075, 12, 10), this.skinDeep);
    fist.position.set(side * 0.12, -0.68, 0.02);
    root.add(upper, bicep, tri, lower, fist);
    return { root, upper, bicep, tri, lower, fist, side };
  }

  #leg(side) {
    const root = new THREE.Group();
    root.position.set(side * 0.12, 0.54, 0);
    const thigh = mesh(new THREE.CapsuleGeometry(0.12, 0.3, 6, 12), this.skin);
    thigh.position.set(0, -0.26, 0);
    const quad = mesh(new THREE.SphereGeometry(0.11, 12, 10), this.skinHot);
    quad.position.set(0, -0.16, 0.07);
    const calf = mesh(new THREE.CapsuleGeometry(0.085, 0.26, 6, 10), this.skinDeep);
    calf.position.set(0, -0.58, 0);
    const shoe = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.28), this.shorts);
    shoe.position.set(0, -0.82, 0.04);
    root.add(thigh, quad, calf, shoe);
    return { root, thigh, quad, calf, shoe, side };
  }

  setMuscle(value, instant = false) {
    this.targetMuscle = THREE.MathUtils.clamp(value, 0, 1);
    if (instant) this.muscle = this.targetMuscle;
  }

  celebrate() {
    this.flexTarget = 1;
    this.pulse = 1;
  }

  update(dt) {
    this.time += dt;
    this.muscle += (this.targetMuscle - this.muscle) * Math.min(1, dt * 3.4);
    this.flex += (this.flexTarget - this.flex) * Math.min(1, dt * 6);
    if (this.flexTarget > 0 && this.flex > 0.92) this.flexTarget = 0;
    this.pulse = Math.max(0, this.pulse - dt * 1.45);

    const m = this.muscle;
    const breath = Math.sin(this.time * 2.2) * 0.012;
    this.body.position.y = Math.sin(this.time * 1.5) * 0.016;
    this.body.rotation.y = Math.sin(this.time * 0.6) * 0.1;

    const pec = 0.6 + m * 1.7 + this.pulse * 0.2;
    this.parts.pecL.scale.set(pec, pec * 0.85, pec * 1.15);
    this.parts.pecR.scale.set(pec, pec * 0.85, pec * 1.15);
    this.parts.pecL.position.set(-0.13 - m * 0.03, -0.04, 0.11 + m * 0.12);
    this.parts.pecR.position.set(0.13 + m * 0.03, -0.04, 0.11 + m * 0.12);

    this.parts.chest.scale.set(1 + m * 0.5, 1 + m * 0.3 + breath, 1 + m * 0.7);
    const delt = 0.9 + m * 1.35;
    this.parts.deltL.scale.setScalar(delt);
    this.parts.deltR.scale.setScalar(delt);
    this.parts.deltL.position.x = -0.32 - m * 0.14;
    this.parts.deltR.position.x = 0.32 + m * 0.14;

    const trap = 0.75 + m * 1.45;
    this.parts.trapL.scale.setScalar(trap);
    this.parts.trapR.scale.setScalar(trap);
    this.parts.neck.scale.set(1 + m * 0.55, 1, 1 + m * 0.4);
    this.shoulders.scale.x = 1 + m * 0.2;

    for (let i = 0; i < 6; i++) {
      const a = this.parts[`abs${i}`];
      a.scale.set(1 + m * 0.3, 1 + m * 0.15, 0.85 + m * 1.05);
      a.position.z = 0.08 + m * 0.09;
    }
    this.parts.obL.scale.set(1 + m * 0.45, 1, 1 + m * 0.55);
    this.parts.obR.scale.set(1 + m * 0.45, 1, 1 + m * 0.55);

    for (const arm of [this.armL, this.armR]) {
      const s = arm.side;
      const bi = 0.7 + m * 1.95 + this.flex * 0.3;
      arm.bicep.scale.set(bi, bi * 0.9, bi * 1.3);
      arm.tri.scale.setScalar(0.75 + m * 1.4);
      arm.upper.scale.set(1 + m * 0.9, 1 + m * 0.1, 1 + m * 0.9);
      arm.lower.scale.set(1 + m * 0.5, 1, 1 + m * 0.5);
      arm.root.rotation.z = s * (0.1 + m * 0.16 - this.flex * 0.7);
      arm.root.rotation.x = -this.flex * 1.0;
      arm.lower.rotation.x = this.flex * 1.45;
    }

    for (const leg of [this.legL, this.legR]) {
      leg.thigh.scale.set(1 + m * 0.7, 1 + m * 0.06, 1 + m * 0.7);
      leg.quad.scale.setScalar(0.75 + m * 1.4);
      leg.calf.scale.set(1 + m * 0.5, 1, 1 + m * 0.5);
    }

    const aura = 0.88 + m * 0.65 + this.pulse * 0.45 + Math.sin(this.time * 3) * 0.03;
    this.aura.scale.set(aura, aura, 1);
    this.aura.material.opacity = 0.2 + m * 0.45 + this.pulse * 0.3;
    this.aura.material.emissiveIntensity = 0.3 + m * 1.1 + this.pulse * 1.4;
    this.aura.rotation.z = this.time * 0.65;
  }
}

export function attachEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}
