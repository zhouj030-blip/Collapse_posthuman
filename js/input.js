/**
 * input.js — 鼠标/键盘事件监听
 * 本阶段为骨架，预留 raycasting 和交互接口
 */
import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function initInput(camera, cubeGroup, canvas) {
  canvas.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    // TODO: raycasting 检测与长方体的交互
  });

  canvas.addEventListener('click', (e) => {
    raycaster.setFromCamera(mouse, camera);
    // TODO: 检测点击命中，生成 glitch 痕迹
  });

  canvas.addEventListener('mousedown', () => {
    // TODO: 开始拖拽绘制笔刷痕迹
  });

  canvas.addEventListener('mouseup', () => {
    // TODO: 结束拖拽
  });
}
