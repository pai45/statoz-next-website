// Packs the Kenney Mini Characters and Car Kit (CC0) into two self-contained GLBs for the city:
//   public/assets/city/kenney/people.glb    13 civilian characters + the animation clips the city uses
//   public/assets/city/kenney/vehicles.glb  the street vehicles and the two race cars
// Tangents and unused animations are dropped, each kit's colormap is embedded as WebP, geometry is
// Meshopt-compressed (decoded by the loader the city already uses), and provenance is
// written into public/assets/city/manifest.json.
//
// usage: node scripts/build-kenney-assets.mjs <kenney_mini-characters dir> <kenney_car-kit dir>
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [charactersRoot, carsRoot] = process.argv.slice(2);
if (!charactersRoot || !carsRoot) { console.error('usage: node scripts/build-kenney-assets.mjs <mini-characters dir> <car-kit dir>'); process.exit(1); }
const OUT = 'public/assets/city/kenney';
const CHARACTERS = ['male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f', 'male-g', 'female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f', 'worker'].map(name => 'character-' + name);
const CLIPS = ['idle', 'walk', 'sprint', 'sit', 'emote-yes', 'holding-right', 'interact-right', 'attack-melee-right', 'holding-both-shoot', 'crouch', 'drive'];
const VEHICLES = ['sedan', 'sedan-sports', 'hatchback-sports', 'suv', 'suv-luxury', 'taxi', 'police', 'van', 'delivery', 'delivery-flat', 'truck', 'truck-flat', 'ambulance', 'garbage-truck', 'firetruck', 'race', 'race-future'];
const KEEP = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']);
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }, BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

function readGlb(path) {
  const bytes = readFileSync(path), jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength, binLength = bytes.readUInt32LE(binStart);
  return { json, bin: bytes.subarray(binStart + 8, binStart + 8 + binLength), sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Builds one glTF with a single packed buffer, copying accessors tightly and remapping every index. */
function packer(texturePath) {
  const parts = [], gltf = { asset: { version: '2.0', generator: 'statoz build-kenney-assets' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], skins: [], animations: [], accessors: [], bufferViews: [], buffers: [], images: [], textures: [{ source: 0 }], materials: [] };
  let length = 0;
  const view = data => { const pad = (4 - length % 4) % 4; if (pad) { parts.push(Buffer.alloc(pad)); length += pad; } gltf.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length }); parts.push(data); length += data.length; return gltf.bufferViews.length - 1; };
  const png = readFileSync(texturePath);
  gltf.images.push({ bufferView: view(png), mimeType: 'image/png', name: 'colormap' });
  gltf.materials.push({ name: 'colormap', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } });
  function accessor(source, index) {
    const a = source.json.accessors[index], v = source.json.bufferViews[a.bufferView], size = COMPONENTS[a.type] * BYTES[a.componentType], stride = v.byteStride || size;
    const out = Buffer.alloc(size * a.count), start = (v.byteOffset || 0) + (a.byteOffset || 0);
    for (let i = 0; i < a.count; i++) source.bin.copy(out, i * size, start + i * stride, start + i * stride + size);
    const copy = { bufferView: view(out), componentType: a.componentType, count: a.count, type: a.type };
    for (const key of ['normalized', 'min', 'max']) if (a[key] !== undefined) copy[key] = a[key];
    gltf.accessors.push(copy); return gltf.accessors.length - 1;
  }
  /** Copies a node subtree (with meshes and skins) and returns the new root index plus the node index map. */
  function subtree(source, rootIndex, name) {
    const map = new Map(), order = [];
    (function walk(i) { map.set(i, -1); order.push(i); for (const c of source.json.nodes[i].children || []) walk(c); })(rootIndex);
    for (const i of order) { map.set(i, gltf.nodes.length); gltf.nodes.push({}); }
    const meshMap = new Map(), skinMap = new Map();
    for (const i of order) {
      const n = source.json.nodes[i], copy = { name: i === rootIndex && name ? name : n.name };
      for (const key of ['translation', 'rotation', 'scale', 'matrix']) if (n[key]) copy[key] = n[key];
      if (n.children) copy.children = n.children.map(c => map.get(c));
      if (n.mesh !== undefined) {
        if (!meshMap.has(n.mesh)) {
          const mesh = source.json.meshes[n.mesh];
          gltf.meshes.push({ name: mesh.name, primitives: mesh.primitives.map(p => ({ attributes: Object.fromEntries(Object.entries(p.attributes).filter(([key]) => KEEP.has(key)).map(([key, value]) => [key, accessor(source, value)])), ...(p.indices !== undefined ? { indices: accessor(source, p.indices) } : {}), material: 0, mode: p.mode ?? 4 })) });
          meshMap.set(n.mesh, gltf.meshes.length - 1);
        }
        copy.mesh = meshMap.get(n.mesh);
      }
      if (n.skin !== undefined) {
        if (!skinMap.has(n.skin)) {
          const skin = source.json.skins[n.skin];
          gltf.skins.push({ joints: skin.joints.map(j => map.get(j)), ...(skin.inverseBindMatrices !== undefined ? { inverseBindMatrices: accessor(source, skin.inverseBindMatrices) } : {}), ...(skin.skeleton !== undefined ? { skeleton: map.get(skin.skeleton) } : {}) });
          skinMap.set(n.skin, gltf.skins.length - 1);
        }
        copy.skin = skinMap.get(n.skin);
      }
      gltf.nodes[map.get(i)] = copy;
    }
    gltf.scenes[0].nodes.push(map.get(rootIndex));
    return map;
  }
  function animations(source, map, names) {
    for (const name of names) {
      const clip = source.json.animations.find(a => a.name === name);
      if (!clip) throw new Error('missing clip ' + name);
      gltf.animations.push({ name, samplers: clip.samplers.map(s => ({ input: accessor(source, s.input), output: accessor(source, s.output), interpolation: s.interpolation || 'LINEAR' })), channels: clip.channels.map(c => ({ sampler: c.sampler, target: { node: map.get(c.target.node), path: c.target.path } })) });
    }
  }
  function write(path) {
    const bin = Buffer.concat(parts), padBin = Buffer.alloc((4 - bin.length % 4) % 4);
    gltf.buffers.push({ byteLength: bin.length + padBin.length });
    let json = Buffer.from(JSON.stringify(gltf)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
    const header = Buffer.alloc(12), jsonHead = Buffer.alloc(8), binHead = Buffer.alloc(8);
    const total = 12 + 8 + json.length + 8 + bin.length + padBin.length;
    header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
    jsonHead.writeUInt32LE(json.length, 0); jsonHead.writeUInt32LE(0x4e4f534a, 4);
    binHead.writeUInt32LE(bin.length + padBin.length, 0); binHead.writeUInt32LE(0x004e4942, 4);
    writeFileSync(path, Buffer.concat([header, jsonHead, json, binHead, bin, padBin]));
    return compress(path);
  }
  return { subtree, animations, write };
}

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
async function compress(path) {
  const document = await io.read(path);
  await document.transform(dedup(), prune(), weld(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 92 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(path, document);
  const out = readFileSync(path); return { bytes: out.length, sha256: createHash('sha256').update(out).digest('hex') };
}

mkdirSync(OUT, { recursive: true });
const provenance = [];
// People: every character keeps its own skinned meshes; the clips come from the first one (all share the rig).
{
  const dir = join(charactersRoot, 'Models', 'GLB format'), pack = packer(join(dir, 'Textures', 'colormap.png'));
  for (const [i, name] of CHARACTERS.entries()) {
    const source = readGlb(join(dir, name + '.glb')), root = source.json.scenes[source.json.scene || 0].nodes[0];
    const map = pack.subtree(source, root, name);
    if (i === 0) {
      pack.animations(source, map, CLIPS);
      const moving = new Set(); for (const a of source.json.animations.filter(a => CLIPS.includes(a.name))) for (const c of a.channels) if (c.target.path !== 'rotation') moving.add(source.json.nodes[c.target.node].name + '.' + c.target.path);
      console.log('non-rotation tracks:', [...moving].join(', ') || 'none');
    }
    provenance.push({ id: 'kenney-' + name, sourceFile: 'kenney_mini-characters/Models/GLB format/' + name + '.glb', creator: 'Kenney', source: 'https://kenney.nl/assets/mini-characters', license: 'CC0-1.0', sourceSha256: source.sha256, output: '/assets/city/kenney/people.glb', modifications: 'Packed with the other characters into one GLB; tangents removed; ' + (i === 0 ? 'clips ' + CLIPS.join(', ') + ' kept' : 'animations removed (the city uses the shared rig clips)') + '; colormap embedded. Split into rigid parts and posed from baked clips at runtime.' });
  }
  const result = await pack.write(join(OUT, 'people.glb')); console.log('people.glb', result.bytes, 'bytes');
}
// Vehicles: each model becomes one root (named after the model) holding its body and wheel nodes.
{
  const dir = join(carsRoot, 'Models', 'GLB format'), pack = packer(join(dir, 'Textures', 'colormap.png'));
  for (const name of VEHICLES) {
    const source = readGlb(join(dir, name + '.glb')), scene = source.json.scenes[source.json.scene || 0];
    // Give the model a root node so it travels as one object.
    source.json.nodes.push({ name, children: scene.nodes });
    pack.subtree(source, source.json.nodes.length - 1, name);
    provenance.push({ id: 'kenney-car-' + name, sourceFile: 'kenney_car-kit/Models/GLB format/' + name + '.glb', creator: 'Kenney', source: 'https://kenney.nl/assets/car-kit', license: 'CC0-1.0', sourceSha256: source.sha256, output: '/assets/city/kenney/vehicles.glb', modifications: 'Packed with the other vehicles into one GLB; tangents removed; colormap embedded. Scaled to the streets, wheels spun and lamps lit at runtime.' });
  }
  const result = await pack.write(join(OUT, 'vehicles.glb')); console.log('vehicles.glb', result.bytes, 'bytes');
}
const manifestPath = 'public/assets/city/manifest.json', manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.assets = [...manifest.assets.filter(asset => !asset.id.startsWith('kenney-')), ...provenance];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest entries', provenance.length);
