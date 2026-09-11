import * as THREE from "three";
import { Hero, attachEnvironment } from "./character.js";

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a2420);
  scene.fog = new THREE.Fog(0x0a2420, 8, 20);
  attachEnvironment(renderer, scene);

  const camera = new THREE.PerspectiveCamera(
    38,
    window.innerWidth / window.innerHeight,
    0.1,
    50,
  );
  camera.position.set(2.1, 1.45, 3.6);
  camera.lookAt(0.1, 0.95, 0);

  const hemi = new THREE.HemisphereLight(0xf3fff8, 0x244038, 1.15);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff4e6, 2.8);
  key.position.set(2.8, 5.2, 3.4);
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

  const fill = new THREE.DirectionalLight(0xb7e0ff, 1.1);
  fill.position.set(-3.2, 2.4, 1.2);
  scene.add(fill);

  const front = new THREE.DirectionalLight(0xffffff, 0.85);
  front.position.set(0.2, 2.2, 4.5);
  scene.add(front);

  const rim = new THREE.PointLight(0xd6ff4b, 1.8, 12);
  rim.position.set(-1.4, 2.4, 2.2);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.MeshStandardMaterial({
      color: 0x143832,
      roughness: 0.85,
      metalness: 0.06,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.12, 64),
    new THREE.MeshStandardMaterial({
      color: 0xd6ff4b,
      emissive: 0x6d8f20,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  scene.add(ring);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 9),
    new THREE.MeshStandardMaterial({
      color: 0x08221e,
      roughness: 1,
      metalness: 0,
    }),
  );
  back.position.set(0, 2.8, -3.2);
  scene.add(back);

  const hero = new Hero();
  hero.root.position.set(0.25, 0, 0);
  scene.add(hero.root);

  const orbs = [];
  for (let i = 0; i < 6; i++) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.035 + Math.random() * 0.03, 16, 16),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xd6ff4b : 0xff7a45,
        emissive: i % 2 === 0 ? 0x88aa22 : 0xaa4422,
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.7,
      }),
    );
    orb.userData = {
      angle: (i / 6) * Math.PI * 2,
      radius: 1.15 + (i % 3) * 0.2,
      speed: 0.3 + i * 0.035,
      height: 0.7 + (i % 3) * 0.4,
    };
    scene.add(orb);
    orbs.push(orb);
  }

  let last = performance.now();

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);

    if (w < 720) {
      camera.position.set(0.15, 1.55, 4.4);
      camera.lookAt(0.1, 1.0, 0);
      hero.root.position.set(0.05, 0, 0);
    } else {
      camera.position.set(2.1, 1.45, 3.6);
      camera.lookAt(0.1, 0.95, 0);
      hero.root.position.set(0.25, 0, 0);
    }
  }

  window.addEventListener("resize", onResize);
  onResize();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    hero.update(dt);
    ring.rotation.z += dt * 0.22;

    for (const orb of orbs) {
      const u = orb.userData;
      u.angle += dt * u.speed;
      orb.position.set(
        Math.cos(u.angle) * u.radius + 0.2,
        u.height + Math.sin(now * 0.001 + u.angle) * 0.12,
        Math.sin(u.angle) * u.radius * 0.65,
      );
      orb.material.opacity = 0.3 + hero.muscle * 0.5;
    }

    rim.intensity = 0.8 + hero.muscle * 1.2 + hero.pulse * 1.4;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return { hero, scene, camera, renderer };
}
