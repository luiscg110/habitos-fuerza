import * as THREE from "three";
import { Hero, attachEnvironment } from "./character.js";

function lerpColor(out, a, b, t) {
  out.r = a.r + (b.r - a.r) * t;
  out.g = a.g + (b.g - a.g) * t;
  out.b = a.b + (b.b - a.b) * t;
  return out;
}

function makeBox(w, h, d, color, roughness = 0.9, metalness = 0.05) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness, metalness }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCylinder(rTop, rBot, h, color, roughness = 0.85, metalness = 0.1) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, 20),
    new THREE.MeshStandardMaterial({ color, roughness, metalness }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Escenario que pasa de pobre → rico según la fuerza (0–1). */
function createHabitat(scene) {
  const poorBg = new THREE.Color(0x1a1410);
  const richBg = new THREE.Color(0x061820);
  const poorFog = new THREE.Color(0x1a1410);
  const richFog = new THREE.Color(0x061820);
  const poorFloor = new THREE.Color(0x3a3228);
  const richFloor = new THREE.Color(0x1c2a32);
  const poorWall = new THREE.Color(0x2a221c);
  const richWall = new THREE.Color(0x0e2430);
  const poorRing = new THREE.Color(0x6a5a40);
  const richRing = new THREE.Color(0xd4af37);
  const poorRingEmi = new THREE.Color(0x3a3018);
  const richRingEmi = new THREE.Color(0x8a6a18);

  scene.background = poorBg.clone();
  scene.fog = new THREE.Fog(poorFog.getHex(), 7.5, 17);

  const hemi = new THREE.HemisphereLight(0xc8b8a0, 0x2a2018, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe8c8, 1.35);
  key.position.set(3.2, 5.8, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.0002;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8899aa, 0.45);
  fill.position.set(-3.4, 2.2, 0.8);
  scene.add(fill);

  const front = new THREE.DirectionalLight(0xffffff, 0.4);
  front.position.set(0.2, 2, 4.4);
  scene.add(front);

  const rim = new THREE.PointLight(0xffaa55, 0.7, 12);
  rim.position.set(-1.4, 2.3, 2.3);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(5.4, 64),
    new THREE.MeshStandardMaterial({
      color: poorFloor.clone(),
      roughness: 0.95,
      metalness: 0.04,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.18, 64),
    new THREE.MeshStandardMaterial({
      color: poorRing.clone(),
      emissive: poorRingEmi.clone(),
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  scene.add(ring);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 9),
    new THREE.MeshStandardMaterial({
      color: poorWall.clone(),
      roughness: 1,
    }),
  );
  back.position.set(0, 2.8, -3.2);
  scene.add(back);

  // —— Zona pobre: cajas, tonel, silla rota ——
  const poor = new THREE.Group();
  const crateA = makeBox(0.55, 0.45, 0.48, 0x5a4632);
  crateA.position.set(-1.55, 0.225, -0.35);
  crateA.rotation.y = 0.35;
  poor.add(crateA);

  const crateB = makeBox(0.4, 0.32, 0.38, 0x4a3a28);
  crateB.position.set(-1.35, 0.16 + 0.45, -0.15);
  crateB.rotation.y = -0.5;
  poor.add(crateB);

  const barrel = makeCylinder(0.28, 0.3, 0.7, 0x3d342c, 0.75, 0.15);
  barrel.position.set(1.7, 0.35, -0.55);
  poor.add(barrel);

  const stool = makeCylinder(0.18, 0.22, 0.08, 0x4a3a2a);
  stool.position.set(1.35, 0.42, 0.55);
  poor.add(stool);
  const leg = makeBox(0.05, 0.4, 0.05, 0x3a2e22);
  leg.position.set(1.35, 0.2, 0.55);
  poor.add(leg);

  const scrap = makeBox(0.7, 0.06, 0.35, 0x2e2820);
  scrap.position.set(0.9, 0.03, 1.1);
  scrap.rotation.y = 0.6;
  poor.add(scrap);

  scene.add(poor);

  // —— Zona rica: columnas, pedestal, acentos dorados ——
  const rich = new THREE.Group();

  function column(x, z) {
    const g = new THREE.Group();
    const base = makeCylinder(0.28, 0.32, 0.12, 0xc9a84a, 0.4, 0.65);
    base.position.y = 0.06;
    const shaft = makeCylinder(0.16, 0.18, 2.2, 0xd8d0c4, 0.35, 0.2);
    shaft.position.y = 1.2;
    const cap = makeCylinder(0.3, 0.22, 0.14, 0xc9a84a, 0.4, 0.65);
    cap.position.y = 2.35;
    g.add(base, shaft, cap);
    g.position.set(x, 0, z);
    return g;
  }

  rich.add(column(-2.05, -1.1));
  rich.add(column(2.15, -1.05));

  const pedestal = makeCylinder(0.95, 1.05, 0.12, 0x243038, 0.3, 0.35);
  pedestal.position.y = 0.06;
  rich.add(pedestal);

  const goldTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.03, 10, 64),
    new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      emissive: 0x6a5010,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.28,
    }),
  );
  goldTrim.rotation.x = Math.PI / 2;
  goldTrim.position.y = 0.13;
  rich.add(goldTrim);

  const bannerL = makeBox(0.08, 2.4, 0.9, 0x6b1d2a, 0.7, 0.08);
  bannerL.position.set(-2.55, 1.4, -2.4);
  rich.add(bannerL);
  const bannerR = makeBox(0.08, 2.4, 0.9, 0x6b1d2a, 0.7, 0.08);
  bannerR.position.set(2.55, 1.4, -2.4);
  rich.add(bannerR);

  const lamp = new THREE.PointLight(0xffd27a, 0, 8);
  lamp.position.set(0, 2.8, -0.4);
  rich.add(lamp);

  scene.add(rich);

  const orbs = [];
  for (let i = 0; i < 8; i++) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.035 + Math.random() * 0.03, 14, 14),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xd6ff4b : 0xff7a45,
        emissive: i % 2 === 0 ? 0x88aa22 : 0xaa4422,
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.35,
      }),
    );
    orb.userData = {
      angle: (i / 8) * Math.PI * 2,
      radius: 1.2 + (i % 3) * 0.2,
      speed: 0.32 + i * 0.03,
      height: 0.6 + (i % 4) * 0.32,
    };
    scene.add(orb);
    orbs.push(orb);
  }

  const tmpA = new THREE.Color();
  const tmpB = new THREE.Color();
  let display = 0;

  function updateCss(t) {
    const deep = tmpA.set(0x1a1410).lerp(tmpB.set(0x041916), t);
    const mid = new THREE.Color(0x2a221c).lerp(new THREE.Color(0x0a2f2a), t);
    const root = document.documentElement.style;
    root.setProperty("--bg-deep", `#${deep.getHexString()}`);
    root.setProperty("--bg-mid", `#${mid.getHexString()}`);
    root.setProperty(
      "--panel",
      t < 0.5
        ? `rgba(${Math.round(40 - t * 20)}, ${Math.round(28 + t * 8)}, ${Math.round(22 + t * 10)}, 0.72)`
        : `rgba(8, 36, 32, 0.72)`,
    );
    const atm = document.querySelector(".atmosphere");
    if (atm) {
      const warm = 0.08 + t * 0.06;
      const gold = 0.04 + t * 0.14;
      atm.style.background = `
        radial-gradient(ellipse 70% 55% at 62% 42%, rgba(212, 175, 55, ${gold}), transparent 60%),
        radial-gradient(ellipse 50% 40% at 18% 80%, rgba(255, 122, 69, ${warm}), transparent 55%),
        linear-gradient(180deg, rgba(4, 25, 22, 0.05), rgba(4, 25, 22, ${0.25 + t * 0.2}) 70%, rgba(4, 25, 22, ${0.55 + t * 0.2}))
      `;
    }
  }

  return {
    ring,
    rim,
    orbs,
    update(muscle, pulse, dt) {
      display += (muscle - display) * Math.min(1, dt * 2.4);
      const t = THREE.MathUtils.clamp(display, 0, 1);
      const ease = t * t * (3 - 2 * t);

      lerpColor(scene.background, poorBg, richBg, ease);
      lerpColor(tmpA, poorFog, richFog, ease);
      scene.fog.color.copy(tmpA);
      scene.fog.near = THREE.MathUtils.lerp(6.5, 8.5, ease);
      scene.fog.far = THREE.MathUtils.lerp(14, 18, ease);

      lerpColor(ground.material.color, poorFloor, richFloor, ease);
      ground.material.roughness = THREE.MathUtils.lerp(0.96, 0.35, ease);
      ground.material.metalness = THREE.MathUtils.lerp(0.04, 0.28, ease);

      lerpColor(back.material.color, poorWall, richWall, ease);

      lerpColor(ring.material.color, poorRing, richRing, ease);
      lerpColor(ring.material.emissive, poorRingEmi, richRingEmi, ease);
      ring.material.emissiveIntensity = 0.2 + ease * 0.55;
      ring.material.opacity = 0.4 + ease * 0.35;

      hemi.intensity = 0.55 + ease * 0.55;
      hemi.color.setRGB(
        THREE.MathUtils.lerp(0.78, 0.91, ease),
        THREE.MathUtils.lerp(0.72, 1.0, ease),
        THREE.MathUtils.lerp(0.63, 0.96, ease),
      );
      hemi.groundColor.setRGB(
        THREE.MathUtils.lerp(0.16, 0.1, ease),
        THREE.MathUtils.lerp(0.12, 0.23, ease),
        THREE.MathUtils.lerp(0.09, 0.2, ease),
      );

      key.intensity = 1.35 + ease * 1.6;
      key.color.setRGB(1, THREE.MathUtils.lerp(0.91, 0.95, ease), THREE.MathUtils.lerp(0.78, 0.85, ease));
      fill.intensity = 0.45 + ease * 0.55;
      front.intensity = 0.4 + ease * 0.55;
      rim.intensity = 0.7 + ease * 1.5 + pulse * 1.4;
      rim.color.setRGB(
        THREE.MathUtils.lerp(1, 0.84, ease),
        THREE.MathUtils.lerp(0.67, 1, ease),
        THREE.MathUtils.lerp(0.33, 0.29, ease),
      );

      lamp.intensity = ease * (1.2 + pulse * 0.8);

      poor.visible = ease < 0.98;
      rich.visible = ease > 0.02;
      poor.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        obj.material.transparent = true;
        obj.material.opacity = 1 - ease;
        obj.material.depthWrite = ease < 0.85;
      });
      rich.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        obj.material.transparent = true;
        obj.material.opacity = ease;
        obj.material.depthWrite = ease > 0.15;
        if (obj.material.emissiveIntensity != null && obj === goldTrim) {
          obj.material.emissiveIntensity = 0.2 + ease * 0.5;
        }
      });

      updateCss(ease);
    },
  };
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  attachEnvironment(renderer, scene);

  const camera = new THREE.PerspectiveCamera(
    38,
    window.innerWidth / window.innerHeight,
    0.1,
    50,
  );
  camera.position.set(2.3, 1.5, 3.9);
  camera.lookAt(0.15, 1.0, 0);

  const habitat = createHabitat(scene);

  const hero = new Hero();
  hero.root.position.set(0.28, 0, 0);
  scene.add(hero.root);

  let last = performance.now();

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (w < 720) {
      camera.position.set(0.15, 1.6, 4.8);
      camera.lookAt(0.1, 1.05, 0);
      hero.root.position.set(0.06, 0, 0);
    } else {
      camera.position.set(2.3, 1.5, 3.9);
      camera.lookAt(0.15, 1.0, 0);
      hero.root.position.set(0.28, 0, 0);
    }
  }

  window.addEventListener("resize", onResize);
  onResize();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    hero.update(dt);
    habitat.ring.rotation.z += dt * 0.25;
    habitat.update(hero.muscle, hero.pulse, dt);

    for (const orb of habitat.orbs) {
      const u = orb.userData;
      u.angle += dt * u.speed;
      orb.position.set(
        Math.cos(u.angle) * u.radius + 0.2,
        u.height + Math.sin(now * 0.001 + u.angle) * 0.12,
        Math.sin(u.angle) * u.radius * 0.65,
      );
      orb.material.opacity = 0.2 + hero.muscle * 0.55;
      orb.material.emissiveIntensity = 0.5 + hero.muscle * 0.8;
    }

    renderer.toneMappingExposure = 1.05 + hero.muscle * 0.35;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return { hero, scene, camera, renderer };
}
