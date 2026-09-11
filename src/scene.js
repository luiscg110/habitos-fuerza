import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { Hero } from "./character.js";

/**
 * Ambientes reales (Poly Haven, CC0):
 * - pobre: abandoned_workshop
 * - rico: newman_lobby (neón morado tipo disco / TRAPDOOR)
 *
 * HDRI en skybox shader (nítido, sin blur) + PMREM para IBL.
 * Cruce suave por mixFactor; brillo contenido.
 */
const skyVert = /* glsl */ `
  varying vec3 vWorldDirection;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDirection = worldPos.xyz - cameraPosition;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
  }
`;

const skyFrag = /* glsl */ `
  precision highp float;
  precision highp sampler2D;
  uniform sampler2D tPoor;
  uniform sampler2D tRich;
  uniform float mixFactor;
  uniform float bgGain;
  varying vec3 vWorldDirection;

  vec2 equirectUv(vec3 dir) {
    vec3 d = normalize(dir);
    float u = atan(d.z, d.x) * 0.15915494309 + 0.5;
    float v = asin(clamp(d.y, -1.0, 1.0)) * 0.31830988618 + 0.5;
    return vec2(u, v);
  }

  void main() {
    vec2 uv = equirectUv(vWorldDirection);
    vec3 poor = texture2D(tPoor, uv).rgb;
    vec3 rich = texture2D(tRich, uv).rgb;
    vec3 color = mix(poor, rich, mixFactor) * bgGain;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

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

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      tPoor: { value: poorMap },
      tRich: { value: richMap },
      mixFactor: { value: 0 },
      bgGain: { value: 0.55 },
    },
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  // Orienta el muro neón morado (TRAPDOOR) detrás del héroe
  sky.rotation.y = Math.PI * 0.72;
  scene.add(sky);

  scene.background = null;
  scene.fog = null;
  scene.backgroundBlurriness = 0;
  scene.environment = poorEnv;
  scene.environmentIntensity = 0.65;

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 64),
    new THREE.MeshStandardMaterial({
      color: 0x12100e,
      roughness: 0.9,
      metalness: 0.08,
      transparent: true,
      opacity: 0.45,
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
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
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
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.22,
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
  const poorRing = new THREE.Color(0x6a5a40);
  const richRing = new THREE.Color(0xb89a4a);
  const poorEmi = new THREE.Color(0x2a2210);
  const richEmi = new THREE.Color(0x5a4080);
  const tmp = new THREE.Color();

  function updateCss(t) {
    const atm = document.querySelector(".atmosphere");
    if (!atm) return;
    const veil = 0.14 - t * 0.05;
    const purple = 0.06 + t * 0.16;
    atm.style.background = `
      radial-gradient(ellipse 70% 55% at 58% 38%, rgba(150, 60, 220, ${purple}), transparent 60%),
      radial-gradient(ellipse 40% 35% at 75% 70%, rgba(80, 40, 160, ${purple * 0.7}), transparent 55%),
      linear-gradient(180deg, rgba(0,0,0,${veil * 0.25}), rgba(0,0,0,${veil}) 100%)
    `;
  }

  return {
    ring,
    orbs,
    update(muscle, pulse, dt) {
      display += (muscle - display) * Math.min(1, dt * 2.2);
      const t = THREE.MathUtils.clamp(display, 0, 1);
      const ease = t * t * (3 - 2 * t);

      skyMat.uniforms.mixFactor.value = ease;
      // Más ganancia al lado rico para que se note el neón morado tipo disco
      skyMat.uniforms.bgGain.value = THREE.MathUtils.lerp(0.48, 0.9, ease);

      if (ease < 0.5) {
        scene.environment = poorEnv;
        scene.environmentIntensity = THREE.MathUtils.lerp(0.55, 0.72, ease * 2);
      } else {
        scene.environment = richEnv;
        scene.environmentIntensity = THREE.MathUtils.lerp(0.72, 0.95, (ease - 0.5) * 2);
      }

      ground.material.roughness = THREE.MathUtils.lerp(0.92, 0.4, ease);
      ground.material.metalness = THREE.MathUtils.lerp(0.06, 0.28, ease);
      ground.material.opacity = THREE.MathUtils.lerp(0.5, 0.32, ease);

      tmp.copy(poorRing).lerp(richRing, ease);
      ring.material.color.copy(tmp);
      tmp.copy(poorEmi).lerp(richEmi, ease);
      ring.material.emissive.copy(tmp);
      ring.material.emissiveIntensity = 0.2 + ease * 0.45 + pulse * 0.2;
      ring.material.opacity = 0.45 + ease * 0.2;

      lights.hemi.intensity = 0.35 + ease * 0.2;
      lights.key.intensity = 1.05 + ease * 0.25;
      lights.fill.intensity = 0.35 + ease * 0.25;
      lights.rim.intensity = 0.4 + ease * 0.9 + pulse * 0.8;
      lights.rim.color.setRGB(
        THREE.MathUtils.lerp(1, 0.72, ease),
        THREE.MathUtils.lerp(0.7, 0.35, ease),
        THREE.MathUtils.lerp(0.4, 1.0, ease),
      );

      renderer.toneMappingExposure = 0.8 + ease * 0.12;
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
  renderer.toneMappingExposure = 0.85;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140f18);

  const camera = new THREE.PerspectiveCamera(
    38,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(2.3, 1.5, 3.9);
  camera.lookAt(0.15, 1.0, 0);

  const hemi = new THREE.HemisphereLight(0xe8d8c8, 0x2a2018, 0.4);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d8, 1.2);
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
  const fill = new THREE.DirectionalLight(0x9ab0c8, 0.4);
  fill.position.set(-3.4, 2.2, 0.8);
  scene.add(fill);
  const rim = new THREE.PointLight(0xffaa55, 0.55, 10);
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
        orb.material.opacity = 0.12 + hero.muscle * 0.35;
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return { hero, scene, camera, renderer };
}
