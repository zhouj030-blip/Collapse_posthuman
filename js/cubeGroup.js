/**
 * cubeGroup.js — AI Space 长方体 Group
 * 半透明玻璃体 + 黑色细线框，比例 1:1.7:1（竖直放置，长边朝上）
 */
import * as THREE from 'three';

const DEG15 = 15 * Math.PI / 180;
const TILT_RESTORE_SPEED = 0.02;

// ─── 断裂系统 ───
const BREAK_COLORS = [0xffffff, 0xff0000, 0x00ffff, 0xffff00]; // 四色均等随机
const BREAKS_PER_FIX = 4; // 每次 FIX 增加的断裂片段数
let breakFragments = [];

export function createCubeGroup() {
  const group = new THREE.Group();
  group.scale.set(1.5, 1.5, 1.5);

  const geometry = new THREE.BoxGeometry(1, 1.55, 1);

  // 玻璃体：半透明，带光透射和折射
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.06,
    roughness: 0.05,
    metalness: 0.0,
    transmission: 0.95,
    thickness: 0.5,
    ior: 1.5,
    envMapIntensity: 1.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glassMesh = new THREE.Mesh(geometry, glassMaterial);
  group.add(glassMesh);

  // 线框：黑色细线，素描/打印边框感
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
    linewidth: 1,
  });
  const wireframe = new THREE.LineSegments(edgesGeometry, lineMaterial);
  group.add(wireframe);

  // 缓存边框几何数据供伪影使用
  group.userData.edgesGeometry = edgesGeometry;

  return group;
}

/**
 * 每次 FIX 后调用：在边框上新增断裂片段（遮住黑色线框）
 */
export function addEdgeBreaks(group) {
  const srcPositions = group.userData.edgesGeometry.attributes.position;
  const edgeCount = srcPositions.count / 2;

  for (let i = 0; i < BREAKS_PER_FIX; i++) {
    const edgeIdx = Math.floor(Math.random() * edgeCount);
    const i0 = edgeIdx * 2;
    const i1 = edgeIdx * 2 + 1;

    const v0 = new THREE.Vector3().fromBufferAttribute(srcPositions, i0);
    const v1 = new THREE.Vector3().fromBufferAttribute(srcPositions, i1);

    // 1/17 ~ 1/14 长度的随机片段
    const tLen = 1/17 + Math.random() * (1/14 - 1/17);
    const tStart = Math.random() * (1.0 - tLen);
    const tEnd = tStart + tLen;

    const p0 = v0.clone().lerp(v1, tStart);
    const p1 = v0.clone().lerp(v1.clone(), tEnd);

    const fragGeo = new THREE.BufferGeometry();
    fragGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      p0.x, p0.y, p0.z, p1.x, p1.y, p1.z
    ], 3));

    const color = BREAK_COLORS[Math.floor(Math.random() * BREAK_COLORS.length)];
    const fragMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      linewidth: 2,
    });

    const fragLine = new THREE.LineSegments(fragGeo, fragMat);
    group.add(fragLine);

    breakFragments.push({
      mesh: fragLine,
      nextFlickerTime: performance.now() + 5000 + Math.random() * 3000,
      flickerQueue: 0,
      flickerInterval: 0,
    });
  }
}

/**
 * 每帧更新断裂片段闪烁（5-8秒一次，快速闪2-3下）
 */
export function updateBreaks(time) {
  for (const b of breakFragments) {
    if (b.flickerQueue > 0) {
      if (time >= b.flickerInterval) {
        const visible = b.mesh.material.opacity > 0.5;
        b.mesh.material.opacity = visible ? 0.0 : 1.0;
        b.flickerQueue--;
        b.flickerInterval = time + 80 + Math.random() * 60;
        if (b.flickerQueue === 0) {
          b.mesh.material.opacity = 1.0;
          b.nextFlickerTime = time + 5000 + Math.random() * 3000;
        }
      }
    } else if (time >= b.nextFlickerTime) {
      const blinks = 2 + Math.floor(Math.random() * 2);
      b.flickerQueue = blinks * 2;
      b.flickerInterval = time;
    }
  }
}

/**
 * 仅 Y 轴匀速自转，速度为原来的 1/4
 * X/Z 轴允许微小倾斜，超过 10° 缓慢回正
 */
export function rotateCube(group) {
  group.rotation.y += 0.00025;

  if (Math.abs(group.rotation.x) > DEG15) {
    group.rotation.x += -Math.sign(group.rotation.x) * TILT_RESTORE_SPEED;
  }
  if (Math.abs(group.rotation.z) > DEG15) {
    group.rotation.z += -Math.sign(group.rotation.z) * TILT_RESTORE_SPEED;
  }
}
