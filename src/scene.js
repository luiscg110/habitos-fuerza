import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { Hero } from "./character.js";

/**
 * Ambientes reales (Poly Haven, CC0):
 * - pobre: abandoned_workshop
 * - rico: hotel_room
 *
 * Patrón habitual en Three.js / demos:
 * HDRI → scene.background + PMREM → scene.environment (IBL).
 * La fuerza cruza de un HDRI a otro.
 */
async function loadHabitat(renderer, scene, lights) {
  const loader = new HDRLoader();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const [poorMap, richMap] = await Promise.all([
    loader.loadAsync("/env/poor.hdr"),
    loader.loadAsync("/env/rich.hdr"),
  ]);

  for (const map of [poorMap, richMap]) {
    map.mapping = THREE.EquirectangularReflectionMapping;
    map.colorSpace = THREE.LinearSRGBColorSpace;
    map.needsUpdate = true;
  }

  const poorEnv = pmrem.fromEquirectangular(poorMap).texture;
  const richEnv = pmrem.fromEquirectangular(richMap).texture;
  pmrem.dispose();

  scene.background = poorMap;
  scene.environment = poorEnv;
  scene.environmentIntensity = 1;
  scene.backgroundBlurriness = 0.12;
  scene.backgroundIntensity = 1;
  scene.fog = null;

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 64),
    new THREE.MeshStandardMaterial({
      color: 0x12100e,
      roughness: 0.9,
      metalness: 0.08,
      transparent: true,
      opacity: 0.4,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.002;
  ground.receiveShadow = true;
  scene.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.12, 64),
    new THREE.MeshStandardMaterial({
      color: 0x8a7a50,
      emissive: 0x3a3010,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      roughness: 0.4,
      metalness: 0.45,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  const orbs = [];
  for (let i = 0; i < 6; i++) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.03 + Math.random() * 0.02, 12, 12),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xd6ff4b : 0xff7a45,
        emissive: i % 2 === 0 ? 0x88aa22 : 0xaa4422,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.25,
      }),
    );
    orb.userData = {
      angle: (i / 6) * Math.PI * 2,
      radius: 1.15 + (i % 3) * 0.18,
      speed: 0.28 + i * 0.03,
      height: 0.55 + (i % 3) * 0.35,
    };
    scene.add(orb);
    orbs.push(orb);
  }

  let display = 0;
  let usingRich = false;
  const poorRing = new THREE.Color(0x6a5a40);
  const richRing = new THREE.Color(0xd4af37);
  const poorEmi = new THREE.Color(0x2a2210);
  const richEmi = new THREE.Color(0x8a6a18);
  const tmp = new THREE.Color();

  function updateCss(t) {
    const atm = document.querySelector(".atmosphere");
    if (!atm) return;
    const veil = 0.08 - t * 0.04;
    const gold = 0.015 + t * 0.07;
    atm.style.background = `
      radial-gradient(ellipse 65% 50% at 60% 40%, rgba(212, 175, 55, ${gold}), transparent 62%),
      linear-gradient(180deg, rgba(0,0,0,${veil * 0.2}), rgba(0,0,0,${veil}) 100%)
    `;
  }

  return {
    ring,
    orbs,
    update(muscle, pulse, dt) {
      display += (muscle - display) * Math.min(1, dt * 2.2);
      const t = THREE.MathUtils.clamp(display, 0, 1);
      const ease = t * t * (3 - 2 * t);

      // Cruce: en el medio borra más; al cruzar 50% cambia el HDRI
      const edge = Math.abs(ease * 2 - 1);
      scene.backgroundBlurriness = THREE.MathUtils.lerp(0.45, 0.08, edge);
      scene.backgroundIntensity = THREE.MathUtils.lerp(0.55, 1.05, edge);

      const wantRich = ease >= 0.5;
      if (wantRich !== usingRich) {
        usingRich = wantRich;
        scene.background = usingRich ? richMap : poorMap;
        scene.environment = usingRich ? richEnv : poorEnv;
      }
      scene.environmentIntensity = THREE.MathUtils.lerp(0.95, 1.4, ease);

      ground.material.roughness = THREE.MathUtils.lerp(0.92, 0.32, ease);
      ground.material.metalness = THREE.MathUtils.lerp(0.06, 0.4, ease);
      ground.material.opacity = THREE.MathUtils.lerp(0.45, 0.28, ease);

      tmp.copy(poorRing).lerp(richRing, ease);
      ring.material.color.copy(tmp);
      tmp.copy(poorEmi).lerp(richEmi, ease);
      ring.material.emissive.copy(tmp);
      ring.material.emissiveIntensity = 0.25 + ease * 0.5 + pulse * 0.25;
      ring.material.opacity = 0.5 + ease * 0.25;

      lights.hemi.intensity = 0.45 + ease * 0.25;
      lights.key.intensity = 1.6 + ease * 0.8;
      lights.fill.intensity = 0.55 + ease * 0.3;
      lights.rim.intensity = 0.7 + ease * 1.0 + pulse * 1.2;
      lights.rim.color.setRGB(
        THREE.MathUtils.lerp(1, 0.92, ease),
        THREE.MathUtils.lerp(0.7, 0.95, ease),
        THREE.MathUtils.lerp(0.4, 0.55, ease),
      );

      renderer.toneMappingExposure = 1.05 + ease * 0.15;
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
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1410);

  const camera = new THREE.PerspectiveCamera(
    38,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(2.3, 1.5, 3.9);
  camera.lookAt(0.15, 1.0, 0);

  const hemi = new THREE.HemisphereLight(0xffe8c8, 0x2a2018, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d8, 1.8);
  key.position.set(3.2, 5.8, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0002;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9ab0c8, 0.6);
  fill.position.set(-3.4, 2.2, 0.8);
  scene.add(fill);
  const rim = new THREE.PointLight(0xffaa55, 0.8, 10);
  rim.position.set(-1.4, 2.3, 2.3);
  scene.add(rim);
  const lights = { hemi, key, fill, rim };

  const hero = new Hero();
  hero.root.position.set(0.28, 0, 0);
  scene.add(hero.root);

  /** @type {Awaited<ReturnType<typeof loadHabitat>> | null} */
  let habitat = null;
  loadHabitat(renderer, scene, lights)
    .then((h) => {
      habitat = h;
      h.update(hero.muscle, hero.pulse, 1);
    })
    .catch((err) => {
      console.error("No se pudo cargar el ambiente HDRI", err);
    });

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

    if (habitat) {
      habitat.ring.rotation.z += dt * 0.25;
      habitat.update(hero.muscle, hero.pulse, dt);
      for (const orb of habitat.orbs) {
        const u = orb.userData;
        u.angle += dt * u.speed;
        orb.position.set(
          Math.cos(u.angle) * u.radius + 0.2,
          u.height + Math.sin(now * 0.001 + u.angle) * 0.1,
          Math.sin(u.angle) * u.radius * 0.65,
        );
        orb.material.opacity = 0.15 + hero.muscle * 0.45;
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return { hero, scene, camera, renderer };
}
