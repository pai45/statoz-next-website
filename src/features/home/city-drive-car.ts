import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CITY_PALETTE as P } from './city-config';

/**
 * The StatOz coupe, authored in metres with its nose along local −Z. It is right-hand drive for
 * left-hand traffic: the driver sits on the car's right (+X). The same model serves the outside
 * shots and the cockpit: the cabin, windshield, dashboard, wheel, hands and HUD are real geometry.
 */
export const DRIVER_EYE = new THREE.Vector3(.4, 1.08, .5);

type Station = [z: number, halfWidth: number, bottom: number, top: number, roundness: number];
// Lower body: nose, front wheels, cowl, doors, haunches and tail.
const BODY: Station[] = [
  [-2.31, .7, .34, .6, 2.6], [-2.24, .84, .28, .68, 3], [-2.05, .93, .25, .74, 3.4], [-1.6, .965, .24, .8, 3.8], [-1.05, .975, .24, .85, 4],
  [-.62, .985, .24, .89, 4.2], [0, .99, .24, .9, 4.4], [.6, .995, .24, .92, 4.4], [1.15, .99, .24, .95, 4.2], [1.6, .97, .25, .95, 3.8],
  [1.98, .92, .27, .91, 3.4], [2.2, .84, .3, .86, 3], [2.32, .72, .36, .8, 2.6],
];
// Greenhouse: windshield, roof and fastback glass.
const CABIN: [z: number, bottomHalf: number, topHalf: number, belt: number, roof: number][] = [
  [-.72, .9, .86, .885, .9], [-.28, .87, .68, .9, 1.25], [.22, .85, .64, .905, 1.33], [.78, .85, .63, .925, 1.3], [1.15, .86, .64, .94, 1.15], [1.5, .86, .74, .95, .97],
];

/** Lofts cross-sections along Z. Closed rings wrap; open rings (the cabin arch) do not. */
function loft(stations: { z: number; points: THREE.Vector2[] }[], cap = true, closed = true) {
  const ring = stations[0].points.length, vertices: number[] = [], indices: number[] = [];
  stations.forEach(({ z, points }) => points.forEach(p => vertices.push(p.x, p.y, z)));
  for (let s = 0; s < stations.length - 1; s++) for (let i = 0; i < (closed ? ring : ring - 1); i++) {
    const a = s * ring + i, b = s * ring + (i + 1) % ring, c = a + ring, d = b + ring;
    indices.push(a, b, c, b, d, c);
  }
  if (cap) for (const [s, flip] of [[0, false], [stations.length - 1, true]] as const) {
    const center = vertices.length / 3, pts = stations[s].points;
    vertices.push(0, pts.reduce((sum, p) => sum + p.y, 0) / pts.length, stations[s].z);
    for (let i = 0; i < ring; i++) { const a = s * ring + i, b = s * ring + (i + 1) % ring; flip ? indices.push(center, a, b) : indices.push(center, b, a); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
/** A rounded box section: superellipse sides, flat floor. */
function section(halfWidth: number, bottom: number, top: number, roundness: number, count = 28) {
  const points: THREE.Vector2[] = [], mid = (bottom + top) / 2, half = (top - bottom) / 2;
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2 - Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / roundness) * halfWidth, y = mid + Math.sign(s) * Math.pow(Math.abs(s), 2 / roundness) * half;
    points.push(new THREE.Vector2(x, Math.max(bottom + .02, y)));
  }
  return points;
}

export function createDriveCar() {
  const group = new THREE.Group(); group.name = 'statoz-coupe';
  const bodywork = new THREE.Group(); group.add(bodywork);
  const exterior = new THREE.Group(), cabin = new THREE.Group(), cockpit = new THREE.Group();
  bodywork.add(exterior, cabin, cockpit);

  const paint = new THREE.MeshPhysicalMaterial({ color: '#0b2a38', metalness: .72, roughness: .28, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.6 });
  const satin = new THREE.MeshStandardMaterial({ color: '#05090f', metalness: .4, roughness: .55 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c8d6e0', metalness: 1, roughness: .16, envMapIntensity: 1.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#07080b', roughness: .92 });
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.cyan).multiplyScalar(2.2), toneMapped: false });
  const headlamp = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e9fbff').multiplyScalar(3), toneMapped: false });
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2457').multiplyScalar(1.6), toneMapped: false });
  const interior = new THREE.MeshStandardMaterial({ color: '#0b1018', roughness: .7, metalness: .2 });
  const archLiner = new THREE.MeshStandardMaterial({ color: '#030508', roughness: .9, side: THREE.DoubleSide });
  const leather = new THREE.MeshStandardMaterial({ color: '#141a24', roughness: .55 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };
  const tube = (points: THREE.Vector3[], radius: number, material: THREE.Material, parent: THREE.Object3D) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, radius, 8), material, parent);

  // Lower body, closed at nose and tail.
  add(loft(BODY.map(([z, w, b, t, r]) => ({ z, points: section(w, b, t, r) }))), paint, exterior);
  // Wheel arches: dark liners with a satin lip read as cut-outs in the bodywork.
  for (const side of [-1, 1]) for (const z of [-1.45, 1.38]) {
    const linerGeometry = new THREE.CylinderGeometry(.47, .47, .34, 28, 1, true, 0, Math.PI); linerGeometry.rotateZ(Math.PI / 2);
    add(linerGeometry, archLiner, exterior, side * .84, .36, z);
    const lip = add(new THREE.TorusGeometry(.47, .022, 6, 28, Math.PI), satin, exterior, side * .985, .36, z); lip.rotation.y = Math.PI / 2;
  }
  // Panel lines, splitter, diffuser, skirts and the shoulder accent.
  for (const side of [-1, 1]) {
    tube([new THREE.Vector3(side * .99, .32, -.66), new THREE.Vector3(side * .995, .6, -.66), new THREE.Vector3(side * .985, .87, -.68)], .006, satin, exterior);
    tube([new THREE.Vector3(side * .995, .32, .92), new THREE.Vector3(side * 1, .62, .9), new THREE.Vector3(side * .99, .9, .86)], .006, satin, exterior);
    tube([new THREE.Vector3(side * .93, .74, -2.02), new THREE.Vector3(side * .99, .84, -.7), new THREE.Vector3(side * 1, .9, .7), new THREE.Vector3(side * .96, .9, 1.9)], .007, neon, exterior);
    add(new RoundedBoxGeometry(.06, .07, 2.3, 2, .02), neon, exterior, side * .96, .27, .0);
    const mirror = add(new RoundedBoxGeometry(.2, .1, .14, 2, .04), paint, exterior, side * 1.02, .99, -.6); mirror.rotation.y = side * .25;
    add(new THREE.BoxGeometry(.012, .07, .1), new THREE.MeshStandardMaterial({ color: '#2a4a5c', metalness: 1, roughness: .05 }), exterior, side * 1.1, .99, -.58);
  }
  add(new RoundedBoxGeometry(1.6, .05, .25, 2, .02), satin, exterior, 0, .24, -2.24);
  add(new RoundedBoxGeometry(1.5, .14, .28, 2, .04), satin, exterior, 0, .32, 2.2);
  for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(.02, .12, .26), satin, exterior, i * .18, .3, 2.22);
  add(new RoundedBoxGeometry(1.1, .12, .05, 2, .03), satin, exterior, 0, .44, -2.3);
  // Light signature: a full-width front bar, twin projectors and a continuous tail strip.
  add(new RoundedBoxGeometry(1.46, .028, .03, 2, .012), headlamp, exterior, 0, .66, -2.27);
  for (const side of [-1, 1]) {
    add(new THREE.CylinderGeometry(.065, .065, .05, 18), headlamp, exterior, side * .58, .6, -2.25).rotation.x = Math.PI / 2;
    add(new THREE.TorusGeometry(.075, .012, 6, 20), chrome, exterior, side * .58, .6, -2.24);
  }
  const tailBar = add(new RoundedBoxGeometry(1.5, .045, .03, 2, .015), tail, exterior, 0, .8, 2.32);
  add(new THREE.BoxGeometry(.32, .07, .02), new THREE.MeshBasicMaterial({ color: '#d9e7f2' }), exterior, 0, .58, 2.335);

  // Greenhouse. Pillars and roof are paint; the glass is one shader-driven shell.
  const cabinStations = CABIN.map(([z, bottomHalf, topHalf, belt, roof]) => {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10, a = Math.PI * t; points.push(new THREE.Vector2(-Math.cos(a) * THREE.MathUtils.lerp(bottomHalf, topHalf, Math.sin(a)), belt + Math.sin(a) * (roof - belt))); }
    return { z, points };
  });
  const glassUniforms = { uTime: { value: 0 }, uTravel: { value: 0 }, uSpeed: { value: 0 }, uInside: { value: 0 } };
  const glass = new THREE.ShaderMaterial({
    uniforms: glassUniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal; void main(){ vLocal = position; vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; vNormal = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uTravel, uSpeed, uInside; varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      void main(){
        vec3 view = normalize(cameraPosition - vWorld);
        float facing = clamp(abs(dot(normalize(vNormal), view)), 0.0, 1.0), fresnel = pow(1.0 - facing, 3.0);
        // Street lights slide over the glass as bands; their pace follows the drive.
        float band = vLocal.y * 9.0 + vLocal.z * 4.0 + uTravel * .9;
        float streak = pow(max(0.0, sin(band)), 90.0) * uSpeed * .35 * smoothstep(1.05, 1.25, vLocal.y) * (1.0 - uInside * .6);
        float dust = step(.996, hash(floor(vLocal.xy * 260.0))) * .35;
        vec3 tint = vec3(.05, .16, .22);
        float alpha = mix(.62 + fresnel * .3, .025 + fresnel * .1 + dust * .3, uInside);
        vec3 color = tint + vec3(.55, .9, 1.0) * (fresnel * .45 + streak) + dust * .6;
        gl_FragColor = vec4(color, clamp(alpha + streak * .5, 0.0, 1.0));
      }`,
  });
  const shell = add(loft(cabinStations, false, false), glass, cabin); shell.castShadow = false; shell.renderOrder = 2; shell.name = 'coupe-glass';
  // Roof skin over the glass, then A/B/C pillars, the header bar and a slim roof spine.
  const roofStations = cabinStations.slice(1, 5).map(({ z, points }) => ({ z, points: points.slice(2, 9).map(p => new THREE.Vector2(p.x * 1.01, p.y + .012)) }));
  const roofGeometry = (() => { const ring = roofStations[0].points.length, v: number[] = [], idx: number[] = [];
    roofStations.forEach(({ z, points }) => points.forEach(p => v.push(p.x, p.y, z)));
    for (let s = 0; s < roofStations.length - 1; s++) for (let i = 0; i < ring - 1; i++) { const a = s * ring + i, b = a + 1, c = a + ring, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
  const roofMesh = add(roofGeometry, paint, cabin); (roofMesh.material as THREE.Material).side = THREE.DoubleSide;
  for (const side of [-1, 1]) {
    tube([new THREE.Vector3(side * .89, .89, -.72), new THREE.Vector3(side * .8, 1.08, -.5), new THREE.Vector3(side * .69, 1.25, -.28)], .035, paint, cabin);
    tube([new THREE.Vector3(side * .87, .91, .3), new THREE.Vector3(side * .73, 1.15, .3), new THREE.Vector3(side * .65, 1.32, .28)], .03, paint, cabin);
    tube([new THREE.Vector3(side * .86, .94, 1.15), new THREE.Vector3(side * .76, 1.1, .97), new THREE.Vector3(side * .64, 1.29, .78)], .045, paint, cabin);
    tube([new THREE.Vector3(side * .89, .89, -.72), new THREE.Vector3(side * .87, .91, .3), new THREE.Vector3(side * .86, .94, 1.15), new THREE.Vector3(side * .86, .95, 1.5)], .018, chrome, cabin);
  }
  tube([new THREE.Vector3(-.69, 1.25, -.28), new THREE.Vector3(0, 1.275, -.27), new THREE.Vector3(.69, 1.25, -.28)], .04, paint, cabin);

  // Cockpit: dashboard, binnacle, screens, wheel, mirror, door cards, seats.
  const dash = add(new RoundedBoxGeometry(1.72, .1, .42, 3, .045), interior, cockpit, 0, .88, -.5);
  dash.rotation.x = -.08;
  add(new RoundedBoxGeometry(.46, .08, .16, 3, .035), interior, cockpit, DRIVER_EYE.x, .955, -.4);
  add(new RoundedBoxGeometry(1.5, .012, .02, 2, .006), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.cyan).multiplyScalar(.9), toneMapped: false }), cockpit, 0, .93, -.29);
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 512; screenCanvas.height = 300;
  const screen = new THREE.CanvasTexture(screenCanvas); screen.colorSpace = THREE.SRGBColorSpace;
  const center = add(new THREE.PlaneGeometry(.3, .18), new THREE.MeshBasicMaterial({ map: screen, toneMapped: false }), cockpit, -.06, .99, -.36); center.rotation.x = -.5;
  const clusterCanvas = document.createElement('canvas'); clusterCanvas.width = 512; clusterCanvas.height = 180;
  const cluster = new THREE.CanvasTexture(clusterCanvas); cluster.colorSpace = THREE.SRGBColorSpace;
  const gauges = add(new THREE.PlaneGeometry(.32, .112), new THREE.MeshBasicMaterial({ map: cluster, toneMapped: false }), cockpit, DRIVER_EYE.x, .96, -.32); gauges.rotation.x = -.42;
  for (const side of [-1, 1]) {
    const door = add(new RoundedBoxGeometry(.05, .34, 1.15, 2, .02), leather, cockpit, side * .87, .78, .02); door.rotation.z = side * .06;
    add(new THREE.BoxGeometry(.012, .012, .9), neon, cockpit, side * .845, .9, .02);
    const seat = add(new RoundedBoxGeometry(.48, .5, .14, 3, .05), leather, cockpit, side * .4, .78, .55); seat.rotation.x = -.18;
  }
  const mirrorArm = add(new THREE.CylinderGeometry(.008, .008, .06), interior, cockpit, 0, 1.24, -.3);
  const rearMirror = add(new RoundedBoxGeometry(.22, .06, .025, 2, .015), interior, cockpit, 0, 1.2, -.31);
  add(new THREE.PlaneGeometry(.21, .045), new THREE.MeshStandardMaterial({ color: '#16303f', metalness: 1, roughness: .05, envMapIntensity: 2 }), rearMirror, 0, 0, .014).rotation.y = Math.PI;
  void mirrorArm;

  // Steering wheel: a flat-bottomed rim with a badge, on a column, turned by the steering angle.
  const wheelPivot = new THREE.Group(); wheelPivot.position.set(DRIVER_EYE.x, .9, -.1); wheelPivot.rotation.x = -.42; cockpit.add(wheelPivot);
  const wheelSpin = new THREE.Group(); wheelPivot.add(wheelSpin);
  const rimShape = new THREE.Shape(); rimShape.absarc(0, 0, .19, -1.1, Math.PI + 1.1, false); rimShape.lineTo(-.16, -.15); rimShape.lineTo(.16, -.15); rimShape.closePath();
  const rim = add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimShape.getPoints(40).map(p => new THREE.Vector3(p.x, p.y, 0)), true), 64, .019, 8, true), leather, wheelSpin);
  void rim;
  for (const angle of [Math.PI / 2 + Math.PI, Math.PI * .15, Math.PI * .85]) add(new THREE.BoxGeometry(.15, .028, .02), interior, wheelSpin, Math.cos(angle) * .075, Math.sin(angle) * .075, 0).rotation.z = angle;
  add(new THREE.CylinderGeometry(.045, .045, .03, 20), interior, wheelSpin).rotation.x = Math.PI / 2;
  add(new THREE.CircleGeometry(.022, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.cyan).multiplyScalar(.8), toneMapped: false }), wheelSpin, 0, 0, .017);
  add(new THREE.CylinderGeometry(.025, .03, .3), interior, wheelPivot, 0, 0, -.16).rotation.x = Math.PI / 2;

  // The driver: helmet with visor, jacket in StatOz colours, gloves pinned to the rim.
  const driver = new THREE.Group(); driver.name = 'coupe-driver'; driver.position.set(DRIVER_EYE.x, 0, 0); bodywork.add(driver);
  const skin = new THREE.MeshStandardMaterial({ color: '#a8735a', roughness: .7 });
  const jacket = new THREE.MeshStandardMaterial({ color: '#0e1a28', roughness: .6 });
  const accent = new THREE.MeshStandardMaterial({ color: P.cyan, emissive: P.cyan, emissiveIntensity: .25, roughness: .4 });
  const glove = new THREE.MeshStandardMaterial({ color: '#10141c', roughness: .6 });
  add(new THREE.SphereGeometry(.12, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#e7f3f7', roughness: .2, clearcoat: 1 }), driver, 0, 1.12, .52);
  const visor = add(new THREE.SphereGeometry(.122, 20, 10, -Math.PI * .72, Math.PI * .44, Math.PI * .34, Math.PI * .3), new THREE.MeshPhysicalMaterial({ color: '#0b2a3a', metalness: .9, roughness: .05, clearcoat: 1 }), driver, 0, 1.12, .52);
  void visor;
  add(new THREE.CylinderGeometry(.05, .055, .08), skin, driver, 0, 1.0, .56);
  const torso = add(new RoundedBoxGeometry(.42, .44, .24, 3, .08), jacket, driver, 0, .78, .68); torso.rotation.x = -.18;
  add(new THREE.BoxGeometry(.05, .4, .245), accent, driver, .1, .78, .68).rotation.x = -.18;
  const arms: { upper: THREE.Mesh; fore: THREE.Mesh; hand: THREE.Mesh; shoulder: THREE.Vector3; grip: number }[] = [];
  for (const side of [-1, 1]) {
    const upper = add(new THREE.CylinderGeometry(.045, .05, 1, 8), jacket, driver), fore = add(new THREE.CylinderGeometry(.04, .045, 1, 8), jacket, driver);
    const hand = add(new THREE.SphereGeometry(.042, 10, 8), glove, driver);
    arms.push({ upper, fore, hand, shoulder: new THREE.Vector3(side * .2, .95, .64), grip: side < 0 ? Math.PI * .88 : Math.PI * .12 });
  }
  const up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), hand = new THREE.Vector3(), elbow = new THREE.Vector3();
  function bone(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
    mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.scale.set(1, from.distanceTo(to), 1);
    mesh.quaternion.setFromUnitVectors(up, b.copy(to).sub(from).normalize());
  }

  // Wheels: profiled tyres, five-spoke alloys, calipers that stay put while the wheel turns.
  const tyreProfile = [[.25, -.13], [.33, -.135], [.36, -.11], [.365, 0], [.36, .11], [.33, .135], [.25, .13]].map(([r, y]) => new THREE.Vector2(r, y));
  const tyreGeometry = new THREE.LatheGeometry(tyreProfile, 36); tyreGeometry.rotateZ(Math.PI / 2);
  const rimMaterial = new THREE.MeshStandardMaterial({ color: '#9fb2bf', metalness: 1, roughness: .22, envMapIntensity: 1.6 });
  const spokeGeometry = mergeGeometries(Array.from({ length: 5 }, (_, i) => { const g = new THREE.BoxGeometry(.03, .21, .045); g.translate(0, .13, 0); g.rotateX(i * Math.PI * 2 / 5); return g; }))!;
  const wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  for (const side of [-1, 1]) for (const z of [-1.45, 1.38]) {
    const pivot = new THREE.Group(); pivot.position.set(side * .86, .365, z); bodywork.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    add(tyreGeometry, rubber, spin);
    add(new THREE.TorusGeometry(.25, .018, 8, 32), rimMaterial, spin, side * .1, 0, 0).rotation.y = Math.PI / 2;
    add(spokeGeometry, rimMaterial, spin, side * .095, 0, 0);
    add(new THREE.CylinderGeometry(.06, .06, .05, 14), rimMaterial, spin, side * .11, 0, 0).rotation.z = Math.PI / 2;
    add(new THREE.CylinderGeometry(.22, .22, .02, 24), satin, spin, side * .03, 0, 0).rotation.z = Math.PI / 2;
    add(new RoundedBoxGeometry(.06, .13, .2, 2, .02), new THREE.MeshStandardMaterial({ color: P.cyan, emissive: P.cyan, emissiveIntensity: .35 }), pivot, side * .06, .1, z < 0 ? .1 : -.1);
    wheels.push({ pivot, spin, front: z < 0 });
  }

  // Headlights reach down the road; a soft glow sits under the car.
  const headlights: THREE.SpotLight[] = [];
  for (const side of [-1, 1]) {
    const light = new THREE.SpotLight('#cff6ff', 0, 46, .36, .6, 1.3); light.position.set(side * .58, .62, -2.3);
    light.target.position.set(side * 1.4, 0, -24); group.add(light, light.target); headlights.push(light);
  }
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const glowContext = glowCanvas.getContext('2d')!, glowGradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  glowGradient.addColorStop(0, 'rgba(255,255,255,.9)'); glowGradient.addColorStop(.55, 'rgba(255,255,255,.25)'); glowGradient.addColorStop(1, 'rgba(255,255,255,0)'); glowContext.fillStyle = glowGradient; glowContext.fillRect(0, 0, 64, 64);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3, 6), new THREE.MeshBasicMaterial({ color: P.cyan, map: new THREE.CanvasTexture(glowCanvas), transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = .03; bodywork.add(glow);

  // Tail-light trails: a ribbon through recent rear positions, fading with age.
  const TRAIL = 46, trailPositions = new Float32Array(TRAIL * 2 * 3), trailAlpha = new Float32Array(TRAIL * 2);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3)); trailGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(trailAlpha, 1));
  const trailIndex: number[] = []; for (let i = 0; i < TRAIL - 1; i++) { const p = i * 2; trailIndex.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); } trailGeometry.setIndex(trailIndex);
  const trail = new THREE.Mesh(trailGeometry, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float aAlpha; varying float vAlpha; void main(){ vAlpha = aAlpha; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vAlpha; void main(){ gl_FragColor = vec4(vec3(1.0, .16, .34) * vAlpha * 1.4, vAlpha); }' }));
  trail.frustumCulled = false; trail.name = 'tail-trails';
  const history: THREE.Vector3[] = [];
  const rear = new THREE.Vector3(), side = new THREE.Vector3();

  // Static parts are merged by material, so about a hundred small meshes become a handful of draw
  // calls. Animated or toggled parts (tail bar, roof panel, glass, wheels, steering wheel, driver) stay separate.
  const keep = new Set<THREE.Object3D>([tailBar, roofMesh, shell, rearMirror]);
  for (const part of [exterior, cabin, cockpit]) {
    const groups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
    for (const child of [...part.children]) {
      if (!(child instanceof THREE.Mesh) || keep.has(child) || child.children.length || Array.isArray(child.material)) continue;
      child.updateMatrix();
      const geometry = child.geometry.clone().applyMatrix4(child.matrix);
      const key = (child.material as THREE.Material).uuid + '/' + Object.keys(geometry.attributes).sort().join(',') + '/' + !!geometry.index;
      if (!groups.has(key)) groups.set(key, { material: child.material as THREE.Material, geometries: [], meshes: [] });
      groups.get(key)!.geometries.push(geometry); groups.get(key)!.meshes.push(child);
    }
    for (const item of groups.values()) {
      if (item.meshes.length < 2) { item.geometries.forEach(geometry => geometry.dispose()); continue; }
      const merged = mergeGeometries(item.geometries, false);
      item.geometries.forEach(geometry => geometry.dispose());
      if (!merged) continue;
      item.meshes.forEach(mesh => { part.remove(mesh); mesh.geometry.dispose(); });
      const mesh = new THREE.Mesh(merged, item.material); mesh.castShadow = true; part.add(mesh);
    }
  }

  let lightPower = 1, brake = 0, roll = 0, squat = 0, lastSpeed = 0, visible = true;
  return {
    group, bodywork, trail, driver, screenCanvas, clusterCanvas, screen, cluster,
    // Keep light membership stable across journey/roam handoffs; visibility changes otherwise
    // recompile every lit city shader on the first interactive frame.
    setVisible(value: boolean) { visible = value; bodywork.visible = value; trail.visible = value; headlights.forEach(light => { light.visible = true; light.intensity = value ? 32 * lightPower : 0; }); },
    setLights(power: number) { lightPower = power; headlamp.color.setScalar(.2 + 2.8 * power); },
    /** Portrait screens see too much ceiling from the seat, so the roof panel slides open there. */
    setRoofOpen(open: boolean) { roofMesh.visible = !open; },
    /** distance in metres, steer in radians, inside 0..1 for the cockpit, speed in m/s. */
    update(distance: number, steer: number, inside: number, speed: number, dt: number, time: number) {
      wheels.forEach(w => { w.spin.rotation.x = -distance / .365; w.pivot.rotation.y = w.front ? steer : 0; });
      wheelSpin.rotation.z = -steer * 4.2;
      const accel = dt > 0 ? (speed - lastSpeed) / dt : 0; lastSpeed = speed;
      brake += ((accel < -1.2 || speed < .2 ? 1 : 0) - brake) * Math.min(1, dt * 6);
      tail.color.setRGB(1.6 + brake * 2.4, (.14 + brake * .1) * 1.6, .34 * 1.6 * (1 + brake));
      tailBar.scale.y = 1 + brake * .4;
      roll += (THREE.MathUtils.clamp(-steer * speed * .05, -.035, .035) - roll) * Math.min(1, dt * 4);
      squat += (THREE.MathUtils.clamp(-accel * .004, -.02, .02) - squat) * Math.min(1, dt * 5);
      for (const part of [exterior, cabin, cockpit, driver]) part.rotation.set(squat, 0, roll);
      headlights.forEach(light => { light.intensity = visible ? 32 * lightPower : 0; });
      glassUniforms.uTime.value = time; glassUniforms.uTravel.value = distance; glassUniforms.uSpeed.value = Math.min(1, speed / 18); glassUniforms.uInside.value = inside;
      // From inside, the driver is the camera: keep the gloves and wheel, hide the head and body.
      driver.visible = true; driver.children.forEach((child, i) => { child.visible = inside < .5 || i >= driver.children.length - 6; });
      cockpit.visible = inside > .02 || bodywork.visible;
      arms.forEach((arm, i) => {
        const angle = arm.grip - steer * 4.2;
        hand.set(Math.cos(angle) * .19, Math.sin(angle) * .19, 0).applyEuler(wheelPivot.rotation).add(wheelPivot.position).sub(driver.position);
        a.copy(arm.shoulder); elbow.copy(a).lerp(hand, .5).add(new THREE.Vector3((i ? 1 : -1) * .07, -.08, .05));
        bone(arm.upper, a, elbow); bone(arm.fore, elbow, hand); arm.hand.position.copy(hand);
      });
      // Trail through the rear lamp position, resampled every 0.6 m of travel.
      group.updateMatrixWorld();
      rear.set(0, .8, 2.34).applyMatrix4(group.matrixWorld);
      if (!history.length || history[0].distanceTo(rear) > .6) { history.unshift(rear.clone()); if (history.length > TRAIL) history.pop(); }
      if (history.length && history[0].distanceTo(rear) > 30) history.length = 0;
      side.set(1, 0, 0).applyQuaternion(group.quaternion).multiplyScalar(.72);
      const moving = Math.min(1, speed / 6);
      for (let i = 0; i < TRAIL; i++) {
        const p = history[Math.min(i, history.length - 1)] || rear;
        trailPositions.set([p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z], i * 6);
        const fade = (1 - i / TRAIL) ** 2 * moving * .55 * (i < history.length ? 1 : 0);
        trailAlpha[i * 2] = trailAlpha[i * 2 + 1] = fade;
      }
      (trailGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (trailGeometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    },
    resetTrail() { history.length = 0; },
  };
}
export type DriveCar = ReturnType<typeof createDriveCar>;
