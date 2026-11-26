import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { dedup, prune, weld, unweld, meshopt, tangents } from '@gltf-transform/functions';
import * as MikkTSpace from 'three/addons/libs/mikktspace.module.js';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Source download and its license are kept in .cache/car-source. No DCC/runtime dependency.
await MeshoptEncoder.ready;
await MikkTSpace.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const source = '.cache/car-source/muscle-car.glb';
const document = await io.read(source);
const body = document.getRoot().listNodes().find(n => n.getName() === 'muscle-car_body');
const original = body.getMesh().listPrimitives()[0];
const position = original.getAttribute('POSITION');
const points = Array.from({ length: position.getCount() }, (_, i) => position.getElement(i, []));
const indices = original.getIndices().getArray();

// Find connected surfaces despite the atlas's UV seams. Remove the source's static cockpit;
// StatOz retains its animated right-hand-drive wheel, instruments, seats and driver.
const parents = points.map((_, i) => i), seen = new Map();
function root(i) { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; }
function join(a, b) { parents[root(a)] = root(b); }
points.forEach((p, i) => { const key = p.map(v => v.toFixed(5)).join(','); if (seen.has(key)) join(i, seen.get(key)); else seen.set(key, i); });
for (let i = 0; i < indices.length; i += 3) { join(indices[i], indices[i + 1]); join(indices[i], indices[i + 2]); }
const bounds = new Map();
points.forEach((p, i) => {
  const id = root(i);
  if (!bounds.has(id)) bounds.set(id, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
  const box = bounds.get(id);
  p.forEach((v, axis) => { box.min[axis] = Math.min(box.min[axis], v); box.max[axis] = Math.max(box.max[axis], v); });
});
const surfaces = { body: [], roof: [], greenhouse: [], headlamps: [], taillamps: [] };
const attributes = Object.fromEntries(original.listSemantics().map(semantic => [semantic, { accessor: original.getAttribute(semantic), values: Array.from(original.getAttribute(semantic).getArray()) }]));
// Open the deck beneath the cabin. The source's display model has a continuous upper
// body surface there, which would intersect the driver's lap in a real cockpit camera.
function interpolate(a, b, t) {
  const index = points.length;
  for (const { accessor, values } of Object.values(attributes)) {
    const width = accessor.getElementSize();
    for (let k = 0; k < width; k++) values.push(values[a * width + k] * (1 - t) + values[b * width + k] * t);
  }
  points.push(attributes.POSITION.values.slice(index * 3, index * 3 + 3)); return index;
}
function clip(polygon, axis, limit, sign) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = (points[a][axis] - limit) * sign, db = (points[b][axis] - limit) * sign;
    if (da <= 0) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) result.push(interpolate(a, b, da / (da - db)));
  }
  return result;
}
function outsideCockpit(triangle) {
  let inside = triangle; const outside = [];
  for (const [axis, limit, sign] of [[0, -.64, -1], [0, .64, 1], [1, .74, -1], [1, 1.24, 1], [2, -1.25, -1], [2, .38, 1]]) {
    if (inside.length < 3) break;
    const piece = clip(inside, axis, limit, -sign);
    if (piece.length >= 3) outside.push(piece);
    inside = clip(inside, axis, limit, sign);
  }
  return outside;
}
for (let i = 0; i < indices.length; i += 3) {
  const triangle = Array.from(indices.slice(i, i + 3)), box = bounds.get(root(triangle[0]));
  if (box.min[0] > -.68 && box.max[0] < .68 && box.min[2] > -1.3 && box.max[2] < .4 && box.min[1] > .89 && box.max[1] < 1.31) continue;
  const lamps = box.min[2] > 2.23 && box.min[1] > .53 && box.max[1] < .69 && box.max[0] - box.min[0] < .18;
  const tail = box.min[2] < -2.3 && box.min[1] > .7 && box.max[1] < .82;
  const roof = triangle.every(index => points[index][1] > 1.15) && Math.abs(triangle.reduce((sum, index) => sum + points[index][0], 0) / 3) < .64;
  const greenhouse = box.min[1] > .8 && box.max[1] > 1.37 && box.min[2] < -1.8 && box.max[2] > .6 && box.max[0] < .75;
  const polygons = !lamps && !tail && !roof ? outsideCockpit(triangle) : [triangle];
  for (const polygon of polygons) for (let k = 1; k < polygon.length - 1; k++) {
    const a = points[polygon[0]], b = points[polygon[k]], c = points[polygon[k + 1]];
    const ab = b.map((v, axis) => v - a[axis]), ac = c.map((v, axis) => v - a[axis]);
    const area = Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]);
    if (area > 1e-9) surfaces[lamps ? 'headlamps' : tail ? 'taillamps' : roof ? 'roof' : greenhouse ? 'greenhouse' : 'body'].push(polygon[0], polygon[k], polygon[k + 1]);
  }
}
const normalValues = attributes.NORMAL.values;
for (let i = 0; i < normalValues.length; i += 3) {
  const length = Math.hypot(...normalValues.slice(i, i + 3));
  for (let k = 0; k < 3; k++) normalValues[i + k] /= length || 1;
}
for (const { accessor, values } of Object.values(attributes)) accessor.setArray(new Float32Array(values));
const buffer = document.getRoot().listBuffers()[0];
const head = document.createMaterial('hero-headlamps').setBaseColorFactor([.8, .96, 1, 1]).setEmissiveFactor([.8, .96, 1]).setRoughnessFactor(.2);
const tail = document.createMaterial('hero-taillamps').setBaseColorFactor([1, .04, .12, 1]).setEmissiveFactor([1, .04, .12]).setRoughnessFactor(.2);
const material = original.getMaterial();
material.setName('hero-petrol-paint').setRoughnessFactor(.72);
const coat = document.createExtension(KHRMaterialsClearcoat);
material.setExtension('KHR_materials_clearcoat', coat.createClearcoat().setClearcoatFactor(.85).setClearcoatRoughnessFactor(.14));
for (const [name, triangles] of Object.entries(surfaces)) {
  const primitive = original.clone().setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(triangles)).setBuffer(buffer));
  primitive.setMaterial(name === 'headlamps' ? head : name === 'taillamps' ? tail : material);
  const node = document.createNode('hero-' + name).setMesh(document.createMesh('hero-' + name).addPrimitive(primitive)).setTranslation(body.getTranslation());
  body.getParentNode().addChild(node);
}
body.dispose();

// Replace warm yellow paint with a cool petrol-blue finish, retaining baked panel shading,
// charcoal stripes, rubber and chrome. Resize maps to the actual chase-camera coverage.
for (const texture of document.getRoot().listTextures()) {
  if (texture.getName().includes('body_basecolor')) {
    const { data, info } = await sharp(texture.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 95 && g > 85 && r > b * 1.18 && g > b * 1.12 && r < g * 1.3) {
        const shade = (r * .4 + g * .6) / 240;
        data[i] = 46 * shade; data[i + 1] = 99 * shade; data[i + 2] = 119 * shade;
      }
    }
    texture.setImage(await sharp(data, { raw: info }).resize(1024, 1024).png().toBuffer()).setMimeType('image/png');
  } else if (texture.getName().includes('body_')) {
    texture.setImage(await sharp(texture.getImage()).resize(1024, 1024).png().toBuffer()).setMimeType('image/png');
  }
}
await document.transform(prune(), dedup(), unweld(), tangents({ generateTangents: MikkTSpace.generateTangents }));
// Degenerate UVs on tiny source bevels have no unique tangent. Use a stable orthogonal
// basis there so every shipped tangent is unit length, including decoded compression.
for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
  const tangent = primitive.getAttribute('TANGENT'), normal = primitive.getAttribute('NORMAL');
  if (!tangent) continue;
  for (let i = 0; i < tangent.getCount(); i++) {
    const t = tangent.getElement(i, []), length = Math.hypot(t[0], t[1], t[2]);
    if (length > 1e-6) { tangent.setElement(i, [t[0] / length, t[1] / length, t[2] / length, t[3] < 0 ? -1 : 1]); continue; }
    const n = normal.getElement(i, []), a = Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    const v = [a[1] * n[2] - a[2] * n[1], a[2] * n[0] - a[0] * n[2], a[0] * n[1] - a[1] * n[0]], scale = Math.hypot(...v);
    tangent.setElement(i, [...v.map(value => value / scale), 1]);
  }
}
await document.transform(weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const output = await io.writeBinary(document);
await writeFile('public/assets/city/statoz-fastback.glb', output);
await copyFile('.cache/car-source/LICENSE.txt', 'public/assets/city/licenses/Grab3D-Muscle-Car.txt');
const manifestPath = 'public/assets/city/manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.licenses = [...new Set([...manifest.licenses, '/assets/city/licenses/Grab3D-Muscle-Car.txt'])];
manifest.assets = manifest.assets.filter(asset => asset.id !== 'statoz-fastback');
manifest.assets.push({ id: 'statoz-fastback', creator: 'Grab3D', source: 'https://grab3d.com/models/vehicles/muscle-car/', sourceFile: 'https://grab3d.com/dl/muscle-car/muscle-car.glb', license: 'CC0-1.0', sourceSha256: createHash('sha256').update(await readFile(source)).digest('hex'), output: '/assets/city/statoz-fastback.glb', bytes: output.byteLength, modifications: 'Petrol-blue paint atlas; 1024px body maps; removed static cockpit; separated roof/headlights/taillights; deduplicated materials and Meshopt compression. Source authored procedurally in Blender with AI-assisted scripts, as disclosed by its creator. Nose reoriented to -Z at runtime, with animated wheel pivots and StatOz cockpit.' });
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ bytes: output.byteLength, materials: document.getRoot().listMaterials().length, textures: document.getRoot().listTextures().length, surfaces: Object.fromEntries(Object.entries(surfaces).map(([name, list]) => [name, list.length / 3])) }));
