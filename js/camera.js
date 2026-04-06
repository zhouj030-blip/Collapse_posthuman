/**
 * camera.js — 摄像机 + 滚轮平滑缩放
 */
import * as THREE from 'three';

// 摄像机初始方向向量（右斜上方俯视）
const INITIAL_POS = new THREE.Vector3(3, 2.5, 3.5);
const LOOK_AT = new THREE.Vector3(0, 0, 0);

export function initCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  camera.position.copy(INITIAL_POS);
  camera.lookAt(LOOK_AT);
  return camera;
}

/**
 * 滚轮缩放：沿摄像机朝向原点的方向，用 lerp 平滑过渡
 */
const zoomState = {
  distance: INITIAL_POS.length(),
  target: INITIAL_POS.length(),
  min: 3,
  max: 12,
  speed: 0.005,
  lerp: 0.08,
};

const direction = INITIAL_POS.clone().normalize();

export function setupZoom(camera, domElement) {
  domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomState.target += e.deltaY * zoomState.speed;
    zoomState.target = Math.max(zoomState.min, Math.min(zoomState.max, zoomState.target));
  }, { passive: false });
}

export function updateZoom(camera) {
  zoomState.distance += (zoomState.target - zoomState.distance) * zoomState.lerp;
  camera.position.copy(direction.clone().multiplyScalar(zoomState.distance));
  camera.lookAt(LOOK_AT);
}

export function onResize(camera, renderer) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
