/**
 * cubeGroup.js — AI Space 长方体 Group
 * 半透明玻璃体 + 黑色细线框，比例 1:1.7:1（竖直放置，长边朝上）
 */
import * as THREE from 'three';

const DEG15 = 15 * Math.PI / 180;
const TILT_RESTORE_SPEED = 0.02;

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

  return group;
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
