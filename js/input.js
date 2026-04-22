/**
 * input.js — 鼠标拖拽绘画
 * 只响应拖拽：mousedown 等第一次 mousemove 才开始 stroke；纯点击什么也不产生
 * 命中：先 glassMesh 内壁，后外壳虚拟盒；都不中则跳过
 */
import * as THREE from 'three';
import { startStroke, addPointToStroke, endStroke } from './mouseTrace.js';
import { isFixActive } from './textTrace.js';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const SHELL_SCALE = 2.3;
const SHELL_SIZE = { x: 1, y: 1.55, z: 1 };
const SAMPLE_INTERVAL_MS = 30;

export function initInput(camera, cubeGroup, canvas) {
  // 不可见外壳（长方体周围空间 raycasting 目标）
  const shellGeom = new THREE.BoxGeometry(SHELL_SIZE.x, SHELL_SIZE.y, SHELL_SIZE.z);
  const shellMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const shellMesh = new THREE.Mesh(shellGeom, shellMat);
  shellMesh.scale.setScalar(SHELL_SCALE);
  shellMesh.userData.isShell = true;
  cubeGroup.add(shellMesh);

  const getGlassMesh = () => {
    for (const child of cubeGroup.children) {
      if (child.isMesh && child.material && child.material.isMeshPhysicalMaterial) return child;
    }
    return null;
  };

  let isDown = false;
  let pendingStart = false;      // mousedown 后等第一次 move 才真正开笔触
  let currentStroke = null;
  let lastSampleTime = 0;

  const updateMouseNDC = (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const resolveLocalPoint = () => {
    raycaster.setFromCamera(mouse, camera);
    const glass = getGlassMesh();
    if (glass) {
      const hits = raycaster.intersectObject(glass, false);
      if (hits.length > 0) return cubeGroup.worldToLocal(hits[0].point.clone());
    }
    const shellHits = raycaster.intersectObject(shellMesh, false);
    if (shellHits.length > 0) return cubeGroup.worldToLocal(shellHits[0].point.clone());
    return null;
  };

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (isFixActive()) return;
    updateMouseNDC(e);
    isDown = true;
    pendingStart = true;
    currentStroke = null;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    if (isFixActive()) return;
    updateMouseNDC(e);

    if (pendingStart) {
      currentStroke = startStroke(cubeGroup);
      pendingStart = false;
      lastSampleTime = 0;
      const p = resolveLocalPoint();
      if (p) addPointToStroke(currentStroke, p);
      return;
    }

    const now = performance.now();
    if (now - lastSampleTime < SAMPLE_INTERVAL_MS) return;
    lastSampleTime = now;
    const p = resolveLocalPoint();
    if (p) addPointToStroke(currentStroke, p);
  });

  const finish = () => {
    if (currentStroke) {
      endStroke(currentStroke, performance.now());
    }
    isDown = false;
    pendingStart = false;
    currentStroke = null;
  };

  canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    finish();
  });

  canvas.addEventListener('mouseleave', finish);
}
