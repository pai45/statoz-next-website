/** Small, deterministic collision layer shared by keyboard, touch and gamepad input. */
export type CitySolid = { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number };
export const ROAM_BOUNDS = { minX: -116, maxX: 116, minZ: -96, maxZ: 164 };
export const ROAM_SPAWN = { x: -17, z: 70, heading: 0 };

export function createRoamSpace(solids: CitySolid[]) {
  const cells = new Map<string, CitySolid[]>(), cellSize = 8;
  for (const solid of solids) {
    if (solid.maxX - solid.minX > 240 || solid.maxZ - solid.minZ > 260) continue;
    for (let x = Math.floor(solid.minX / cellSize); x <= Math.floor(solid.maxX / cellSize); x++) for (let z = Math.floor(solid.minZ / cellSize); z <= Math.floor(solid.maxZ / cellSize); z++) {
      const key = x + '/' + z; if (!cells.has(key)) cells.set(key, []); cells.get(key)!.push(solid);
    }
  }
  function clear(x: number, z: number, radius: number, height = 1.8) {
    if (x - radius < ROAM_BOUNDS.minX || x + radius > ROAM_BOUNDS.maxX || z - radius < ROAM_BOUNDS.minZ || z + radius > ROAM_BOUNDS.maxZ) return false;
    for (let gx = Math.floor((x - radius) / cellSize); gx <= Math.floor((x + radius) / cellSize); gx++) for (let gz = Math.floor((z - radius) / cellSize); gz <= Math.floor((z + radius) / cellSize); gz++) {
      for (const solid of cells.get(gx + '/' + gz) || []) {
        if (solid.minY > height || solid.maxY < .48) continue;
        const dx = x - Math.max(solid.minX, Math.min(x, solid.maxX)), dz = z - Math.max(solid.minZ, Math.min(z, solid.maxZ));
        if (dx * dx + dz * dz < radius * radius) return false;
      }
    }
    return true;
  }
  function carClear(x: number, z: number, heading: number) {
    for (const offset of [-1.25, 0, 1.25]) if (!clear(x + Math.sin(heading) * offset, z + Math.cos(heading) * offset, 1.05, 1.5)) return false;
    return true;
  }
  function move(position: { x: number; z: number }, dx: number, dz: number, heading: number, car: boolean) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .25));
    let blocked = false;
    const free = (x: number, z: number) => car ? carClear(x, z, heading) : clear(x, z, .36);
    for (let step = 0; step < steps; step++) {
      const nx = position.x + dx / steps, nz = position.z + dz / steps;
      if (free(nx, nz)) { position.x = nx; position.z = nz; }
      else if (!car) {
        if (free(nx, position.z)) position.x = nx;
        if (free(position.x, nz)) position.z = nz;
        blocked = true;
      } else { blocked = true; break; }
    }
    return blocked;
  }
  // Collision spring arm: sample the view segment against the same authored solids.
  function cameraDistance(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) {
    const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    for (let distance = .8; distance < length; distance += .3) {
      const t = distance / length, x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t, z = from.z + (to.z - from.z) * t;
      for (const solid of cells.get(Math.floor(x / cellSize) + '/' + Math.floor(z / cellSize)) || []) {
        if (x >= solid.minX - .3 && x <= solid.maxX + .3 && z >= solid.minZ - .3 && z <= solid.maxZ + .3 && y > solid.minY - .2 && y < solid.maxY + .25) return Math.max(.65, distance - .5) / length;
      }
    }
    return 1;
  }
  return { clear, carClear, move, cameraDistance, count: solids.length };
}
