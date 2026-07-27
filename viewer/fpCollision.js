const DEFAULT_HASH_CELL_SIZE = 0.45;
const DEFAULT_VOXEL_RESOLUTION = 0.14;
const DEFAULT_SEARCH_RADIUS = 3;
const DEFAULT_HEAD_CLEARANCE = 1.65;
const DEFAULT_SPAWN_SPHERE_RADIUS = 0.18;
const FLOOR_NORMAL_MIN_Y = 0.45;
const MIN_LOOK_DISTANCE = 0.35;
const COLLISION_EPSILON = 1e-5;
const COLLISION_LOAD_TIMEOUT_MS = 15000;

const collisionCache = new Map();
const MAX_COLLISION_CACHE_ENTRIES = 4;
const DEBUG_COLLISION = false;

function debugCollision(...args) {
  if (DEBUG_COLLISION) console.log(...args);
}

function getCachedCollision(url) {
  const cached = collisionCache.get(url);
  if (!cached) return null;
  collisionCache.delete(url);
  collisionCache.set(url, cached);
  return cached;
}

function cacheCollision(url, loadPromise) {
  collisionCache.set(url, loadPromise);
  while (collisionCache.size > MAX_COLLISION_CACHE_ENTRIES) {
    collisionCache.delete(collisionCache.keys().next().value);
  }
}

function getVectorLength(x, y, z) {
  return Math.hypot(x, y, z);
}

function normalizeVector(x, y, z, fallback = [0, 0, 1]) {
  const length = getVectorLength(x, y, z);
  if (length <= COLLISION_EPSILON) {
    return [...fallback];
  }

  return [x / length, y / length, z / length];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function closestPointOnTriangle(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;

  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) {
    return { x: ax, y: ay, z: az };
  }

  const bpx = px - bx;
  const bpy = py - by;
  const bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) {
    return { x: bx, y: by, z: bz };
  }

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return {
      x: ax + abx * v,
      y: ay + aby * v,
      z: az + abz * v,
    };
  }

  const cpx = px - cx;
  const cpy = py - cy;
  const cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) {
    return { x: cx, y: cy, z: cz };
  }

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return {
      x: ax + acx * w,
      y: ay + acy * w,
      z: az + acz * w,
    };
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const edgeX = cx - bx;
    const edgeY = cy - by;
    const edgeZ = cz - bz;
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return {
      x: bx + edgeX * w,
      y: by + edgeY * w,
      z: bz + edgeZ * w,
    };
  }

  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return {
    x: ax + abx * v + acx * w,
    y: ay + aby * v + acy * w,
    z: az + abz * v + acz * w,
  };
}

function intersectRayTriangle(
  ox, oy, oz,
  dx, dy, dz,
  ax, ay, az,
  bx, by, bz,
  cx, cy, cz
) {
  const edge1x = bx - ax;
  const edge1y = by - ay;
  const edge1z = bz - az;
  const edge2x = cx - ax;
  const edge2y = cy - ay;
  const edge2z = cz - az;

  const px = dy * edge2z - dz * edge2y;
  const py = dz * edge2x - dx * edge2z;
  const pz = dx * edge2y - dy * edge2x;
  const determinant = edge1x * px + edge1y * py + edge1z * pz;

  if (Math.abs(determinant) < 1e-8) {
    return null;
  }

  const inverseDeterminant = 1 / determinant;
  const tx = ox - ax;
  const ty = oy - ay;
  const tz = oz - az;
  const u = (tx * px + ty * py + tz * pz) * inverseDeterminant;
  if (u < 0 || u > 1) {
    return null;
  }

  const qx = ty * edge1z - tz * edge1y;
  const qy = tz * edge1x - tx * edge1z;
  const qz = tx * edge1y - ty * edge1x;
  const v = (dx * qx + dy * qy + dz * qz) * inverseDeterminant;
  if (v < 0 || u + v > 1) {
    return null;
  }

  const distance = (edge2x * qx + edge2y * qy + edge2z * qz) * inverseDeterminant;
  if (distance < 0) {
    return null;
  }

  const nx = edge1y * edge2z - edge1z * edge2y;
  const ny = edge1z * edge2x - edge1x * edge2z;
  const nz = edge1x * edge2y - edge1y * edge2x;
  const [normalX, normalY, normalZ] = normalizeVector(nx, ny, nz, [0, 1, 0]);

  return {
    distance,
    x: ox + dx * distance,
    y: oy + dy * distance,
    z: oz + dz * distance,
    nx: normalX,
    ny: normalY,
    nz: normalZ,
  };
}

class MeshCollision {
  constructor(positions, indices) {
    this.positions = positions;
    this.indices = indices;
    this.voxelResolution = DEFAULT_VOXEL_RESOLUTION;
    this.hashCellSize = DEFAULT_HASH_CELL_SIZE;
    this.bounds = this.computeBounds();
    this.triangleCount = Math.floor(indices.length / 3);
    this.triangleNormals = new Float32Array(this.triangleCount * 3);
    this.spatialHash = new Map();
    this.buildSpatialHash();
  }

  computeBounds() {
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      minZ: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      maxZ: -Infinity,
    };

    for (let index = 0; index < this.positions.length; index += 3) {
      const x = this.positions[index];
      const y = this.positions[index + 1];
      const z = this.positions[index + 2];
      if (x < bounds.minX) bounds.minX = x;
      if (y < bounds.minY) bounds.minY = y;
      if (z < bounds.minZ) bounds.minZ = z;
      if (x > bounds.maxX) bounds.maxX = x;
      if (y > bounds.maxY) bounds.maxY = y;
      if (z > bounds.maxZ) bounds.maxZ = z;
    }

    return bounds;
  }

  getTriangleVertices(triangleIndex) {
    const base = triangleIndex * 3;
    const ia = this.indices[base] * 3;
    const ib = this.indices[base + 1] * 3;
    const ic = this.indices[base + 2] * 3;

    return {
      ax: this.positions[ia],
      ay: this.positions[ia + 1],
      az: this.positions[ia + 2],
      bx: this.positions[ib],
      by: this.positions[ib + 1],
      bz: this.positions[ib + 2],
      cx: this.positions[ic],
      cy: this.positions[ic + 1],
      cz: this.positions[ic + 2],
    };
  }

  getTriangleNormal(triangleIndex) {
    const base = triangleIndex * 3;
    return {
      x: this.triangleNormals[base],
      y: this.triangleNormals[base + 1],
      z: this.triangleNormals[base + 2],
    };
  }

  hashKey(ix, iy, iz) {
    return `${ix}|${iy}|${iz}`;
  }

  cellIndex(value) {
    return Math.floor(value / this.hashCellSize);
  }

  buildSpatialHash() {
    for (let triangleIndex = 0; triangleIndex < this.triangleCount; triangleIndex += 1) {
      const triangle = this.getTriangleVertices(triangleIndex);
      const normal = normalizeVector(
        (triangle.by - triangle.ay) * (triangle.cz - triangle.az) - (triangle.bz - triangle.az) * (triangle.cy - triangle.ay),
        (triangle.bz - triangle.az) * (triangle.cx - triangle.ax) - (triangle.bx - triangle.ax) * (triangle.cz - triangle.az),
        (triangle.bx - triangle.ax) * (triangle.cy - triangle.ay) - (triangle.by - triangle.ay) * (triangle.cx - triangle.ax),
        [0, 1, 0]
      );

      const normalBase = triangleIndex * 3;
      this.triangleNormals[normalBase] = normal[0];
      this.triangleNormals[normalBase + 1] = normal[1];
      this.triangleNormals[normalBase + 2] = normal[2];

      const minX = Math.min(triangle.ax, triangle.bx, triangle.cx);
      const minY = Math.min(triangle.ay, triangle.by, triangle.cy);
      const minZ = Math.min(triangle.az, triangle.bz, triangle.cz);
      const maxX = Math.max(triangle.ax, triangle.bx, triangle.cx);
      const maxY = Math.max(triangle.ay, triangle.by, triangle.cy);
      const maxZ = Math.max(triangle.az, triangle.bz, triangle.cz);

      for (let ix = this.cellIndex(minX); ix <= this.cellIndex(maxX); ix += 1) {
        for (let iy = this.cellIndex(minY); iy <= this.cellIndex(maxY); iy += 1) {
          for (let iz = this.cellIndex(minZ); iz <= this.cellIndex(maxZ); iz += 1) {
            const key = this.hashKey(ix, iy, iz);
            const bucket = this.spatialHash.get(key);
            if (bucket) {
              bucket.push(triangleIndex);
            } else {
              this.spatialHash.set(key, [triangleIndex]);
            }
          }
        }
      }
    }
  }

  collectCandidateTriangleIds(minX, minY, minZ, maxX, maxY, maxZ) {
    const ids = new Set();

    for (let ix = this.cellIndex(minX); ix <= this.cellIndex(maxX); ix += 1) {
      for (let iy = this.cellIndex(minY); iy <= this.cellIndex(maxY); iy += 1) {
        for (let iz = this.cellIndex(minZ); iz <= this.cellIndex(maxZ); iz += 1) {
          const bucket = this.spatialHash.get(this.hashKey(ix, iy, iz));
          if (!bucket) {
            continue;
          }

          for (const triangleIndex of bucket) {
            ids.add(triangleIndex);
          }
        }
      }
    }

    return ids;
  }

  collectRayCandidateTriangleIds(ox, oy, oz, dx, dy, dz, distance) {
    const ids = new Set();
    const cellSize = this.hashCellSize;
    let ix = this.cellIndex(ox);
    let iy = this.cellIndex(oy);
    let iz = this.cellIndex(oz);
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const stepZ = Math.sign(dz);
    const tDeltaX = stepX ? cellSize / Math.abs(dx) : Infinity;
    const tDeltaY = stepY ? cellSize / Math.abs(dy) : Infinity;
    const tDeltaZ = stepZ ? cellSize / Math.abs(dz) : Infinity;
    let tMaxX = stepX
      ? (((stepX > 0 ? ix + 1 : ix) * cellSize) - ox) / dx
      : Infinity;
    let tMaxY = stepY
      ? (((stepY > 0 ? iy + 1 : iy) * cellSize) - oy) / dy
      : Infinity;
    let tMaxZ = stepZ
      ? (((stepZ > 0 ? iz + 1 : iz) * cellSize) - oz) / dz
      : Infinity;
    tMaxX = Math.max(0, tMaxX);
    tMaxY = Math.max(0, tMaxY);
    tMaxZ = Math.max(0, tMaxZ);

    // Amanatides-Woo traversal visits only the hash cells crossed by the ray.
    // The previous axis-aligned bounding-box scan could visit millions of cells
    // for a long diagonal ray across an outdoor scene.
    const endIx = this.cellIndex(ox + dx * distance);
    const endIy = this.cellIndex(oy + dy * distance);
    const endIz = this.cellIndex(oz + dz * distance);
    const maxSteps =
      Math.abs(endIx - ix) +
      Math.abs(endIy - iy) +
      Math.abs(endIz - iz) +
      6;
    for (let step = 0; step < maxSteps; step += 1) {
      const bucket = this.spatialHash.get(this.hashKey(ix, iy, iz));
      if (bucket) {
        for (const triangleIndex of bucket) ids.add(triangleIndex);
      }

      const nextT = Math.min(tMaxX, tMaxY, tMaxZ);
      if (!Number.isFinite(nextT) || nextT > distance) break;
      const tieEpsilon = 1e-9;
      if (tMaxX <= nextT + tieEpsilon) {
        ix += stepX;
        tMaxX += tDeltaX;
      }
      if (tMaxY <= nextT + tieEpsilon) {
        iy += stepY;
        tMaxY += tDeltaY;
      }
      if (tMaxZ <= nextT + tieEpsilon) {
        iz += stepZ;
        tMaxZ += tDeltaZ;
      }
    }

    return ids;
  }

  queryRay(ox, oy, oz, dx, dy, dz, maxDist = Infinity) {
    const distance = Number.isFinite(maxDist) ? maxDist : 1000;
    const candidates = this.collectRayCandidateTriangleIds(
      ox, oy, oz,
      dx, dy, dz,
      distance
    );

    let bestDistance = distance;
    let bestHit = null;

    for (const triangleIndex of candidates) {
      const triangle = this.getTriangleVertices(triangleIndex);
      const hit = intersectRayTriangle(
        ox, oy, oz,
        dx, dy, dz,
        triangle.ax, triangle.ay, triangle.az,
        triangle.bx, triangle.by, triangle.bz,
        triangle.cx, triangle.cy, triangle.cz
      );

      if (!hit || hit.distance >= bestDistance) {
        continue;
      }

      bestDistance = hit.distance;
      bestHit = hit;
    }

    return bestHit;
  }

  queryClosestPoint(x, y, z, maxDistance = 4) {
    const radius = Math.max(this.hashCellSize, maxDistance);
    const candidates = this.collectCandidateTriangleIds(
      x - radius,
      y - radius,
      z - radius,
      x + radius,
      y + radius,
      z + radius
    );
    let bestDistanceSq = maxDistance * maxDistance;
    let bestPoint = null;

    for (const triangleIndex of candidates) {
      const triangle = this.getTriangleVertices(triangleIndex);
      const closest = closestPointOnTriangle(
        x, y, z,
        triangle.ax, triangle.ay, triangle.az,
        triangle.bx, triangle.by, triangle.bz,
        triangle.cx, triangle.cy, triangle.cz
      );
      const dx = x - closest.x;
      const dy = y - closest.y;
      const dz = z - closest.z;
      const distanceSq = dx * dx + dy * dy + dz * dz;
      if (distanceSq >= bestDistanceSq) continue;

      const normal = this.getTriangleNormal(triangleIndex);
      bestDistanceSq = distanceSq;
      bestPoint = {
        x: closest.x,
        y: closest.y,
        z: closest.z,
        nx: normal.x,
        ny: normal.y,
        nz: normal.z,
        distance: Math.sqrt(distanceSq),
      };
    }

    return bestPoint;
  }

  querySphere(x, y, z, radius, out = { x: 0, y: 0, z: 0 }) {
    let centerX = x;
    let centerY = y;
    let centerZ = z;
    let totalX = 0;
    let totalY = 0;
    let totalZ = 0;
    let collided = false;

    for (let iteration = 0; iteration < 4; iteration += 1) {
      const candidates = this.collectCandidateTriangleIds(
        centerX - radius,
        centerY - radius,
        centerZ - radius,
        centerX + radius,
        centerY + radius,
        centerZ + radius
      );

      let bestPenetration = 0;
      let bestPushX = 0;
      let bestPushY = 0;
      let bestPushZ = 0;

      for (const triangleIndex of candidates) {
        const triangle = this.getTriangleVertices(triangleIndex);
        const closest = closestPointOnTriangle(
          centerX, centerY, centerZ,
          triangle.ax, triangle.ay, triangle.az,
          triangle.bx, triangle.by, triangle.bz,
          triangle.cx, triangle.cy, triangle.cz
        );

        const deltaX = centerX - closest.x;
        const deltaY = centerY - closest.y;
        const deltaZ = centerZ - closest.z;
        const distanceSq = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
        if (distanceSq >= radius * radius) {
          continue;
        }

        const distance = Math.sqrt(Math.max(distanceSq, COLLISION_EPSILON));
        const penetration = radius - distance;
        if (penetration <= bestPenetration) {
          continue;
        }

        let normal = distanceSq <= COLLISION_EPSILON
          ? this.getTriangleNormal(triangleIndex)
          : {
              x: deltaX / distance,
              y: deltaY / distance,
              z: deltaZ / distance,
            };

        const triNormal = this.getTriangleNormal(triangleIndex);
        const dot = normal.x * triNormal.x + normal.y * triNormal.y + normal.z * triNormal.z;
        if (dot < 0) {
          normal = triNormal;
        }

        bestPenetration = penetration;
        bestPushX = normal.x * (penetration + 0.001);
        bestPushY = normal.y * (penetration + 0.001);
        bestPushZ = normal.z * (penetration + 0.001);
      }

      if (bestPenetration <= COLLISION_EPSILON) {
        break;
      }

      centerX += bestPushX;
      centerY += bestPushY;
      centerZ += bestPushZ;
      totalX += bestPushX;
      totalY += bestPushY;
      totalZ += bestPushZ;
      collided = true;
    }

    out.x = totalX;
    out.y = totalY;
    out.z = totalZ;
    return collided;
  }

  isFreeAt(x, y, z) {
    return !this.querySphere(x, y, z, Math.max(0.035, this.voxelResolution * 0.35), { x: 0, y: 0, z: 0 });
  }

  querySurfaceNormal(x, y, z) {
    const candidates = this.collectCandidateTriangleIds(
      x - this.hashCellSize,
      y - this.hashCellSize,
      z - this.hashCellSize,
      x + this.hashCellSize,
      y + this.hashCellSize,
      z + this.hashCellSize
    );

    let bestDistanceSq = Infinity;
    let bestNormal = { x: 0, y: 1, z: 0 };

    for (const triangleIndex of candidates) {
      const triangle = this.getTriangleVertices(triangleIndex);
      const closest = closestPointOnTriangle(
        x, y, z,
        triangle.ax, triangle.ay, triangle.az,
        triangle.bx, triangle.by, triangle.bz,
        triangle.cx, triangle.cy, triangle.cz
      );

      const deltaX = x - closest.x;
      const deltaY = y - closest.y;
      const deltaZ = z - closest.z;
      const distanceSq = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
      if (distanceSq >= bestDistanceSq) {
        continue;
      }

      bestDistanceSq = distanceSq;
      bestNormal = this.getTriangleNormal(triangleIndex);
    }

    return bestNormal;
  }

  findSphereSpawnNear(origin, options = {}) {
    const radius = options.radius ?? DEFAULT_SPAWN_SPHERE_RADIUS;
    const searchRadius = options.searchRadius ?? DEFAULT_SEARCH_RADIUS;
    const step = options.step ?? Math.max(this.voxelResolution, radius * 0.5, 0.08);
    const maxCells = Math.max(1, Math.ceil(searchRadius / step));
    let bestDistanceSq = Infinity;
    let bestSpawn = null;

    for (let ring = 0; ring <= maxCells; ring += 1) {
      for (let dyCell = -ring; dyCell <= ring; dyCell += 1) {
        for (let dzCell = -ring; dzCell <= ring; dzCell += 1) {
          for (let dxCell = -ring; dxCell <= ring; dxCell += 1) {
            if (
              ring > 0 &&
              Math.abs(dxCell) !== ring &&
              Math.abs(dyCell) !== ring &&
              Math.abs(dzCell) !== ring
            ) {
              continue;
            }

            const x = origin[0] + dxCell * step;
            const y = origin[1] + dyCell * step;
            const z = origin[2] + dzCell * step;
            const distanceSq =
              (x - origin[0]) ** 2 +
              (y - origin[1]) ** 2 +
              (z - origin[2]) ** 2;

            if (distanceSq >= bestDistanceSq || distanceSq > searchRadius * searchRadius) {
              continue;
            }

            if (this.querySphere(x, y, z, radius, { x: 0, y: 0, z: 0 })) {
              continue;
            }

            bestDistanceSq = distanceSq;
            bestSpawn = { x, y, z };
          }
        }
      }
    }

    return bestSpawn;
  }

  findCameraSpawnNear(origin, options = {}) {
    debugCollision("[Collision debug] findCameraSpawnNear called with origin:", origin, "bounds:", this.bounds);
    const searchRadius = options.searchRadius ?? DEFAULT_SEARCH_RADIUS;
    const headClearance = options.headClearance ?? DEFAULT_HEAD_CLEARANCE;
    const step = options.step ?? Math.max(this.voxelResolution, 0.1);
    const maxCells = Math.max(1, Math.ceil(searchRadius / step));
    const desiredY = origin?.[1] ?? (this.bounds.minY + this.bounds.maxY) * 0.5;
    const rayStartY = clamp(
      desiredY + 1.0,
      this.bounds.minY + 0.5,
      this.bounds.maxY - 0.05
    );
    debugCollision("[Collision debug] rayStartY calculated:", rayStartY);
    const sphereRadius = options.radius ?? DEFAULT_SPAWN_SPHERE_RADIUS;
    let bestSpawn = null;
    let bestDistanceSq = Infinity;

    for (let ring = 0; ring <= maxCells; ring += 1) {
      for (let dzCell = -ring; dzCell <= ring; dzCell += 1) {
        for (let dxCell = -ring; dxCell <= ring; dxCell += 1) {
          if (ring > 0 && Math.abs(dxCell) !== ring && Math.abs(dzCell) !== ring) {
            continue;
          }

          const x = origin[0] + dxCell * step;
          const z = origin[2] + dzCell * step;
          const distanceSq = (x - origin[0]) ** 2 + (z - origin[2]) ** 2;
          if (distanceSq >= bestDistanceSq || distanceSq > searchRadius * searchRadius) {
            continue;
          }

          const floorHit = this.queryRay(x, rayStartY, z, 0, -1, 0, rayStartY - this.bounds.minY + 5);
          if (!floorHit || floorHit.ny < FLOOR_NORMAL_MIN_Y) {
            continue;
          }

          const ceilingOriginY = floorHit.y + 0.05;
          const ceilingHit = this.queryRay(x, ceilingOriginY, z, 0, 1, 0, this.bounds.maxY - ceilingOriginY + 5);
          if (ceilingHit && ceilingHit.y - floorHit.y < headClearance) {
            continue;
          }

          const cameraY = floorHit.y + Math.max(headClearance * 0.88, desiredY - floorHit.y, 1.25);
          if (this.querySphere(x, cameraY, z, sphereRadius, { x: 0, y: 0, z: 0 })) {
            continue;
          }

          bestDistanceSq = distanceSq;
          bestSpawn = {
            x,
            y: cameraY,
            z,
            floorY: floorHit.y,
          };
        }
      }
    }

    debugCollision("[Collision debug] bestSpawn found:", bestSpawn);
    return bestSpawn;
  }
}

async function loadMeshCollisionFromGlb(app, pc, url, transformOptions = {}) {
  if (!url) {
    return null;
  }

  const cachedCollision = getCachedCollision(url);
  if (cachedCollision) return cachedCollision;

  const loadPromise = new Promise((resolve, reject) => {
    const asset = new pc.Asset(url, "container", { url });
    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      try {
        app.assets.remove(asset);
        asset.unload();
      } catch {}
    };

    const finishResolve = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(value);
    };

    const finishReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      cleanup();
      collisionCache.delete(url);
      reject(error);
    };

    asset.on("load", () => {
      try {
        const resource = asset.resource;
        if (!resource) {
          finishReject(new Error("GLB container resource not found."));
          return;
        }

        const rootEntity = resource.instantiateRenderEntity();
        if (!rootEntity) {
          finishReject(new Error("Failed to instantiate render entity from GLB."));
          return;
        }

        rootEntity.setLocalPosition(...(transformOptions.position || [0, 0, 0]));
        const rot = transformOptions.rotation || [0, 0, 0, 1];
        rootEntity.setLocalRotation(rot[0], rot[1], rot[2], rot[3]);
        rootEntity.setLocalScale(...(transformOptions.scale || [1, 1, 1]));

        rootEntity.syncHierarchy();

        const allPositions = [];
        const allIndices = [];
        let vertexOffset = 0;

        const meshInstances = [];
        rootEntity.forEach((entity) => {
          if (entity.render && entity.render.meshInstances) {
            meshInstances.push(...entity.render.meshInstances);
          }
        });

        if (!meshInstances.length) {
          finishReject(new Error("GLB contains no renderable mesh instances."));
          rootEntity.destroy();
          return;
        }

        const localPos = new pc.Vec3();
        const worldPos = new pc.Vec3();

        for (const meshInstance of meshInstances) {
          const mesh = meshInstance.mesh;
          const node = meshInstance.node;
          if (!mesh || !node) {
            continue;
          }

          const vb = mesh.vertexBuffer;
          const ib = mesh.indexBuffer?.[0];
          if (!vb || !ib) {
            continue;
          }

          let posElement = null;
          for (const element of vb.format.elements) {
            if (element.name === pc.SEMANTIC_POSITION) {
              posElement = element;
              break;
            }
          }

          if (!posElement) {
            continue;
          }

          const transform = node.getWorldTransform();
          const data = new Float32Array(vb.storage);
          const stride = vb.format.size / 4;
          const offset = posElement.offset / 4;
          const numVerts = vb.numVertices;

          for (let vertex = 0; vertex < numVerts; vertex += 1) {
            const base = vertex * stride + offset;
            localPos.set(data[base], data[base + 1], data[base + 2]);
            transform.transformPoint(localPos, worldPos);
            allPositions.push(worldPos.x, worldPos.y, worldPos.z);
          }

          const indexData = ib.format === pc.INDEXFORMAT_UINT32
            ? new Uint32Array(ib.storage)
            : new Uint16Array(ib.storage);

          for (const primitive of mesh.primitive || []) {
            for (let index = 0; index < primitive.count; index += 1) {
              allIndices.push(indexData[primitive.base + index] + vertexOffset);
            }
          }

          vertexOffset += numVerts;
        }

        rootEntity.destroy();

        if (!allIndices.length) {
          finishReject(new Error("GLB meshes contain no triangle data."));
          return;
        }

        cleanup();
        finishResolve(new MeshCollision(new Float32Array(allPositions), new Uint32Array(allIndices)));
      } catch (error) {
        finishReject(error);
      }
    });

    asset.on("error", (error) => {
      finishReject(new Error(typeof error === "string" ? error : error?.message || "Failed to load FP collision GLB."));
    });

    timeoutId = setTimeout(() => {
      finishReject(new Error(`Timed out while loading FP collision GLB: ${url}`));
    }, COLLISION_LOAD_TIMEOUT_MS);

    app.assets.add(asset);
    app.assets.load(asset);
  });

  cacheCollision(url, loadPromise);
  return loadPromise;
}

function buildCollisionAdjustedViewPreset(collision, viewPreset = {}, fallbackTarget = [0, 0, 1]) {
  const desiredCameraPosition = viewPreset.cameraPosition || fallbackTarget;
  const spawn = collision.findCameraSpawnNear(desiredCameraPosition);
  if (!spawn) {
    return viewPreset;
  }

  const rawDirection = viewPreset.target
    ? [
        viewPreset.target[0] - desiredCameraPosition[0],
        viewPreset.target[1] - desiredCameraPosition[1],
        viewPreset.target[2] - desiredCameraPosition[2],
      ]
    : [0, 0, 1];
  const direction = normalizeVector(rawDirection[0], rawDirection[1], rawDirection[2], [0, 0, 1]);
  const lookDistance = Math.max(getVectorLength(rawDirection[0], rawDirection[1], rawDirection[2]), MIN_LOOK_DISTANCE);

  return {
    ...viewPreset,
    cameraPosition: [spawn.x, spawn.y, spawn.z],
    target: [
      spawn.x + direction[0] * lookDistance,
      spawn.y + direction[1] * lookDistance,
      spawn.z + direction[2] * lookDistance,
    ],
  };
}

/**
 * Build a MeshCollision from a live PlayCanvas entity already placed in the
 * scene graph. Extracts world-space vertices/indices using each mesh node's
 * current world transform, so the resulting collision matches EXACTLY what is
 * rendered on screen. Use this to rebuild collision after the user moves the
 * visible collision preview.
 */
function buildMeshCollisionFromEntity(pc, entity) {
  if (!pc || !entity) {
    return null;
  }

  entity.syncHierarchy?.();

  const allPositions = [];
  const allIndices = [];
  let vertexOffset = 0;

  const meshInstances = [];
  entity.forEach((node) => {
    if (node.render && node.render.meshInstances) {
      meshInstances.push(...node.render.meshInstances);
    }
  });

  if (!meshInstances.length) {
    return null;
  }

  const localPos = new pc.Vec3();
  const worldPos = new pc.Vec3();

  for (const meshInstance of meshInstances) {
    const mesh = meshInstance.mesh;
    const node = meshInstance.node;
    if (!mesh || !node) {
      continue;
    }

    const vb = mesh.vertexBuffer;
    const ib = mesh.indexBuffer?.[0];
    if (!vb || !ib) {
      continue;
    }

    let posElement = null;
    for (const element of vb.format.elements) {
      if (element.name === pc.SEMANTIC_POSITION) {
        posElement = element;
        break;
      }
    }
    if (!posElement) {
      continue;
    }

    const transform = node.getWorldTransform();
    const data = new Float32Array(vb.storage);
    const stride = vb.format.size / 4;
    const offset = posElement.offset / 4;
    const numVerts = vb.numVertices;

    for (let vertex = 0; vertex < numVerts; vertex += 1) {
      const base = vertex * stride + offset;
      localPos.set(data[base], data[base + 1], data[base + 2]);
      transform.transformPoint(localPos, worldPos);
      allPositions.push(worldPos.x, worldPos.y, worldPos.z);
    }

    const indexData = ib.format === pc.INDEXFORMAT_UINT32
      ? new Uint32Array(ib.storage)
      : new Uint16Array(ib.storage);

    for (const primitive of mesh.primitive || []) {
      for (let index = 0; index < primitive.count; index += 1) {
        allIndices.push(indexData[primitive.base + index] + vertexOffset);
      }
    }

    vertexOffset += numVerts;
  }

  if (!allIndices.length) {
    return null;
  }

  return new MeshCollision(new Float32Array(allPositions), new Uint32Array(allIndices));
}

export { loadMeshCollisionFromGlb, buildCollisionAdjustedViewPreset, buildMeshCollisionFromEntity };
