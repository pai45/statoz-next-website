import * as THREE from 'three';
import { CITY_LOCATIONS, CITY_PALETTE as P, type CityLocationId } from './city-config';
import { createDriveCar } from './city-drive-car';
import { createRoamSpace, ROAM_SPAWN, type CitySolid } from './city-roam-physics';

export type RoamAction = 'forward' | 'back' | 'left' | 'right' | 'boost' | 'brake';
export type RoamCommand = 'vehicle' | 'visit' | 'reset' | 'camera';
export type RoamStatus = { vehicle: 'car' | 'avatar'; speed: number; x: number; z: number; carX: number; carZ: number; heading: number; near: CityLocationId | null; canEnter: boolean; blocked: boolean };
const BINDINGS: Record<string, RoamAction> = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'boost', ShiftRight: 'boost', Space: 'brake' };
const COMMANDS: Record<string, RoamCommand> = { KeyE: 'vehicle', KeyF: 'visit', KeyR: 'reset', KeyC: 'camera' };
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** One controller owns player input and the chase camera only while free roam is active. */
export function createCityRoam(scene: THREE.Scene, camera: THREE.PerspectiveCamera, host: HTMLElement, options: { onStatus: (status: RoamStatus) => void; onVisit: (id: CityLocationId) => void; onExit: () => void }) {
  const canvas = host.querySelector('canvas')!;
  const car = createDriveCar(); car.group.name = 'free-roam-car'; scene.add(car.group, car.trail); car.setLights(1);
  const avatar = new THREE.Group(); avatar.name = 'free-roam-avatar'; scene.add(avatar);
  const skin = new THREE.MeshStandardMaterial({ color: '#b87e60', roughness: .82 });
  const jacket = new THREE.MeshStandardMaterial({ color: '#21394f', roughness: .7, metalness: .15 });
  const pants = new THREE.MeshStandardMaterial({ color: P.building, roughness: .85 });
  const trim = new THREE.MeshStandardMaterial({ color: P.cyan, emissive: P.cyan, emissiveIntensity: .6, roughness: .4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#081421', roughness: .5 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = avatar) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  add(new THREE.CapsuleGeometry(.28, .46, 4, 10), jacket, 0, 1.28, 0);
  add(new THREE.SphereGeometry(.23, 12, 10), skin, 0, 1.94, 0).scale.y = 1.12;
  add(new THREE.SphereGeometry(.242, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55), dark, 0, 2.01, 0);
  add(new THREE.BoxGeometry(.38, .085, .09), trim, 0, 1.97, -.21);
  add(new THREE.BoxGeometry(.34, .45, .18), jacket, 0, 1.28, .32);
  add(new THREE.BoxGeometry(.24, .045, .04), trim, 0, 1.39, .43);
  add(new THREE.BoxGeometry(.4, .06, .05), trim, 0, 1.48, -.26);
  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .15, .91, 0); avatar.add(leg);
    add(new THREE.CapsuleGeometry(.105, .57, 3, 8), pants, 0, -.34, 0, leg);
    add(new THREE.BoxGeometry(.23, .15, .38), dark, 0, -.76, -.07, leg);
    add(new THREE.BoxGeometry(.235, .035, .38), trim, 0, -.83, -.07, leg);
    const arm = new THREE.Group(); arm.position.set(side * .34, 1.57, 0); avatar.add(arm);
    add(new THREE.CapsuleGeometry(.09, .33, 3, 8), jacket, 0, -.23, 0, arm);
    add(new THREE.SphereGeometry(.085, 8, 6), skin, 0, -.51, 0, arm); limbs.push(leg, arm);
  }
  const ring = add(new THREE.RingGeometry(.42, .47, 32), new THREE.MeshBasicMaterial({ color: P.cyan, transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }), 0, .015, 0);
  ring.rotation.x = -Math.PI / 2;
  const position = new THREE.Vector3(ROAM_SPAWN.x, .16, ROAM_SPAWN.z), parked = position.clone();
  const target = new THREE.Vector3(), desired = new THREE.Vector3(), look = new THREE.Vector3();
  const waypoint = new THREE.Vector3(), waypointView = new THREE.Vector3();
  const shell = host.closest<HTMLElement>('[data-scene-status]')!;
  let space = createRoamSpace([]), active = false, suspended = false, driving = true, speed = 0, heading = 0, parkedHeading = 0;
  let distance = 0, phase = 0, yaw = 0, pitch = .38, lastLook = 0, reportAt = 0, blocked = false, near: CityLocationId | null = null;
  let drag: { id: number; x: number; y: number } | null = null, started = false, closeCamera = false;
  const keys = new Set<string>(), touch = new Set<RoamAction>();
  const clearInput = () => { keys.clear(); touch.clear(); drag = null; speed = 0; };
  const held = (action: RoamAction) => touch.has(action) || [...keys].some(code => BINDINGS[code] === action);
  const canEnter = () => !driving && Math.hypot(position.x - parked.x, position.z - parked.z) < 4.4;
  function report() {
    const status: RoamStatus = { vehicle: driving ? 'car' : 'avatar', speed: Math.round(Math.abs(speed) * 3.6), x: position.x, z: position.z, carX: parked.x, carZ: parked.z, heading, near, canEnter: canEnter(), blocked };
    options.onStatus(status);
    host.dataset.roamVehicle = status.vehicle; host.dataset.roamPosition = `${position.x.toFixed(2)},${position.z.toFixed(2)}`;
    host.dataset.roamSpeed = String(status.speed); host.dataset.roamBlocked = String(blocked); host.dataset.roamNear = near || '';
  }
  function reset() { clearInput(); parked.set(ROAM_SPAWN.x, .16, ROAM_SPAWN.z); position.copy(parked); if (!driving) position.x -= 2.8; heading = ROAM_SPAWN.heading; parkedHeading = heading; yaw = heading; pitch = .38; speed = 0; blocked = false; car.group.position.copy(parked); car.group.rotation.y = heading; car.resetTrail(); report(); }
  function command(command: RoamCommand) {
    if (!active || suspended) return;
    if (command === 'reset') { reset(); return; }
    if (command === 'camera') { closeCamera = !closeCamera; return; }
    if (command === 'visit') { if (near) { clearInput(); options.onVisit(near); } return; }
    if (driving) {
      speed = 0;
      const candidates = [[-2.8, 0], [2.8, 0], [0, 3.8], [0, -3.8]];
      const exit = candidates.map(([x, z]) => ({ x: position.x + x * Math.cos(heading) + z * Math.sin(heading), z: position.z - x * Math.sin(heading) + z * Math.cos(heading) })).find(point => space.clear(point.x, point.z, .4));
      if (!exit) { blocked = true; report(); return; }
      parked.copy(position); parkedHeading = heading; position.set(exit.x, .16, exit.z); driving = false;
    } else if (canEnter()) { position.copy(parked); heading = parkedHeading; driving = true; }
    speed = 0; report();
  }
  function keyDown(event: KeyboardEvent) {
    if (!active || suspended || event.altKey || event.metaKey || event.ctrlKey || (event.target instanceof Element && event.target.closest('input,textarea,select,dialog,[contenteditable=true]'))) return;
    if (event.target instanceof HTMLButtonElement && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return;
    if (BINDINGS[event.code]) { event.preventDefault(); event.stopPropagation(); keys.add(event.code); }
    else if (COMMANDS[event.code]) { event.preventDefault(); if (!event.repeat) command(COMMANDS[event.code]); }
    else if (event.code === 'Escape') { event.preventDefault(); options.onExit(); }
  }
  const keyUp = (event: KeyboardEvent) => { keys.delete(event.code); };
  const blur = () => clearInput();
  const pointerDown = (event: PointerEvent) => { if (!active || suspended || event.button !== 0) return; canvas.focus({ preventScroll: true }); drag = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); };
  const pointerMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    yaw -= (event.clientX - drag.x) * .006; pitch = THREE.MathUtils.clamp(pitch + (event.clientY - drag.y) * .004, .12, .85);
    drag.x = event.clientX; drag.y = event.clientY; lastLook = performance.now();
  };
  const pointerUp = (event: PointerEvent) => { if (drag?.id === event.pointerId) { drag = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } };
  const lostPointer = () => { drag = null; };
  const visibility = () => { if (document.hidden) clearInput(); };
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp); canvas.addEventListener('lostpointercapture', lostPointer);
  car.setVisible(false); avatar.visible = false;
  return {
    warmup() {
      const saved: { object: THREE.Object3D; visible: boolean; culled: boolean }[] = [];
      for (const root of [car.group, car.trail, avatar]) root.traverse(object => { saved.push({ object, visible: object.visible, culled: object.frustumCulled }); object.visible = true; object.frustumCulled = false; });
      return () => saved.forEach(({ object, visible, culled }) => { object.visible = visible; object.frustumCulled = culled; });
    },
    setSolids(solids: CitySolid[]) { space = createRoamSpace(solids); host.dataset.roamSolids = String(space.count); },
    setActive(value: boolean, paused: boolean) {
      if (active !== value || suspended !== paused) clearInput();
      if (value && !active) { if (!started) { reset(); started = true; } yaw = heading; camera.fov = 58; camera.updateProjectionMatrix(); canvas.focus({ preventScroll: true }); }
      active = value; suspended = paused; car.setVisible(value); avatar.visible = value && !driving;
      host.dataset.roamActive = String(value); canvas.style.touchAction = value ? 'none' : 'pan-y pinch-zoom';
    },
    input(action: RoamAction, pressed: boolean) { if (!active || suspended) return; if (pressed) touch.add(action); else touch.delete(action); },
    command,
    position: () => ({ x: position.x, z: position.z }),
    /** Place the visit affordance over its destination, or on the matching screen edge. */
    projectWaypoint(width: number, height: number) {
      const marker = shell.querySelector<HTMLElement>('[data-roam-waypoint]');
      if (!marker) return;
      const place = CITY_LOCATIONS.find(place => place.id === near);
      if (!active || suspended || !place || marker.dataset.target !== place.id) { marker.style.visibility = 'hidden'; return; }
      camera.updateMatrixWorld();
      waypoint.set(place.position[0], place.category === 'sport' ? 4 : 5.5, place.position[2]);
      waypointView.copy(waypoint).applyMatrix4(camera.matrixWorldInverse);
      waypoint.project(camera);
      const halfW = marker.offsetWidth / 2 + 16, halfH = marker.offsetHeight / 2 + 12;
      const mobile = width <= 700, touch = !!shell.querySelector('[data-roam-touch-controls]');
      const left = halfW, right = Math.max(left, width - halfW);
      const top = Math.min(height * .4, 108 + halfH);
      const bottom = Math.max(top, height - (height < 540 ? 120 : mobile && touch ? 285 : 165) - halfH);
      let x = (waypoint.x + 1) * width / 2, y = (1 - waypoint.y) * height / 2;
      let dx = x - width / 2, dy = y - height / 2;
      const behind = waypointView.z >= -.1;
      if (behind) { dx = -dx; dy = -dy; if (Math.hypot(dx, dy) < 1) dy = 1; }
      const offscreen = behind || waypoint.z < -1 || waypoint.z > 1 || x < left || x > right || y < top || y > bottom;
      if (offscreen) {
        const cx = width / 2, cy = THREE.MathUtils.clamp(height / 2, top, bottom);
        const tx = dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity;
        const ty = dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity;
        const t = Math.min(tx, ty);
        x = cx + dx * t; y = cy + dy * t;
      }
      marker.style.left = x.toFixed(1) + 'px'; marker.style.top = y.toFixed(1) + 'px';
      marker.style.setProperty('--waypoint-angle', Math.atan2(dy, dx).toFixed(4) + 'rad');
      marker.dataset.offscreen = String(offscreen); marker.dataset.location = place.id;
      marker.style.visibility = 'visible';
    },
    update(dt: number, time: number) {
      if (!active) return;
      dt = Math.min(dt, .05);
      let forward = Number(held('forward')) - Number(held('back')), steer = Number(held('left')) - Number(held('right'));
      const pad = navigator.getGamepads?.()[0];
      if (pad && !suspended) { const dead = (v: number) => Math.abs(v) < .18 ? 0 : v; forward ||= -dead(pad.axes[1] || 0); steer ||= -dead(pad.axes[0] || 0); }
      if (suspended) { forward = 0; steer = 0; speed = 0; }
      if (driving) {
        const goal = forward * (forward < 0 ? 6 : held('boost') ? 20 : 14);
        const rate = held('brake') ? 12 : forward ? 2 : 3;
        speed += ((held('brake') ? 0 : goal) - speed) * (1 - Math.exp(-rate * dt));
        if (Math.abs(speed) < .035) speed = 0;
        const nextHeading = heading + steer * THREE.MathUtils.clamp(speed / 7, -1.1, 1.1) * dt;
        if (space.carClear(position.x, position.z, nextHeading)) heading = nextHeading;
        blocked = space.move(position, -Math.sin(heading) * speed * dt, -Math.cos(heading) * speed * dt, heading, true);
        if (blocked) speed = 0;
        distance += speed * dt; parked.copy(position); parkedHeading = heading;
        car.group.position.copy(position); car.group.rotation.y = heading;
        if (!suspended) car.update(distance, steer * .4, 0, Math.abs(speed), dt, time);
        if (!drag && performance.now() - lastLook > 1800 && Math.abs(speed) > .5) yaw += wrap(heading - yaw) * (1 - Math.exp(-dt * 2.2));
      } else {
        const norm = Math.max(1, Math.hypot(forward, steer)), pace = held('boost') ? 7 : 3.5;
        const dx = (-Math.sin(yaw) * forward - Math.cos(yaw) * steer) / norm * pace * dt;
        const dz = (-Math.cos(yaw) * forward + Math.sin(yaw) * steer) / norm * pace * dt;
        const beforeX = position.x, beforeZ = position.z;
        blocked = space.move(position, dx, dz, heading, false);
        const px = position.x - parked.x, pz = position.z - parked.z;
        // The parked coupe is still solid when the visitor steps out.
        if (Math.abs(px * Math.cos(parkedHeading) - pz * Math.sin(parkedHeading)) < 1.35 && Math.abs(px * Math.sin(parkedHeading) + pz * Math.cos(parkedHeading)) < 2.7) { position.x = beforeX; position.z = beforeZ; blocked = true; }
        speed = dt ? Math.hypot(position.x - beforeX, position.z - beforeZ) / dt : 0;
        if (speed > .1) heading += wrap(Math.atan2(-dx, -dz) - heading) * (1 - Math.exp(-dt * 14));
        if (!suspended) phase += speed * dt * 2.4;
        avatar.position.copy(position); avatar.rotation.y = heading;
        limbs.forEach((limb, i) => { limb.rotation.x = Math.sin(phase + (i < 2 ? 0 : Math.PI)) * (i % 2 ? -.45 : .55) * Math.min(1, speed); });
        avatar.position.y += Math.abs(Math.sin(phase)) * .035 * Math.min(1, speed);
      }
      avatar.visible = !driving;
      car.driver.visible = driving;
      // Pull the follow camera in before it crosses a building or a stand.
      target.set(position.x, driving ? 1.5 : 1.6, position.z);
      const boom = closeCamera ? driving ? 7 : 4.5 : driving ? 12 : 7;
      desired.set(target.x + Math.sin(yaw) * Math.cos(pitch) * boom, target.y + Math.sin(pitch) * boom + (driving ? 1 : .4), target.z + Math.cos(yaw) * Math.cos(pitch) * boom);
      desired.sub(target).multiplyScalar(space.cameraDistance(target, desired)).add(target);
      // Follow the desired boom directly after collision; smoothing a blocked pose can cross walls.
      const blend = 1 - Math.exp(-dt * 9);
      camera.position.lerp(desired, blend);
      const safe = space.cameraDistance(target, camera.position); if (safe < 1) camera.position.sub(target).multiplyScalar(safe).add(target);
      look.copy(target); if (driving) { look.x -= Math.sin(heading) * Math.abs(speed) * .12; look.z -= Math.cos(heading) * Math.abs(speed) * .12; }
      camera.lookAt(look);
      near = null; let best = Infinity;
      for (const place of CITY_LOCATIONS) { const distance = Math.hypot(position.x - place.position[0], position.z - place.position[2]); const reach = place.category === 'sport' ? 36 : 16; if (distance < reach && distance / reach < best) { near = place.id; best = distance / reach; } }
      if (performance.now() > reportAt) { report(); reportAt = performance.now() + 120; }
    },
    dispose() {
      clearInput(); window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp); canvas.removeEventListener('lostpointercapture', lostPointer);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      for (const root of [car.group, car.trail, avatar]) { root.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const mat of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(mat); for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value); } } }); root.removeFromParent(); }
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); canvas.style.touchAction = 'pan-y pinch-zoom';
    },
  };
}
