/**
 * main.js — 应用入口，模块编排与动画主循环
 */
import * as TWEEN from '@tweenjs/tween.js';
import { initScene } from './scene.js';
import { initCamera, setupZoom, updateZoom, onResize } from './camera.js';
import { createCubeGroup, rotateCube } from './cubeGroup.js';
import { initInput } from './input.js';
import { initTextTraces, updateTextTraces } from './textTrace.js';

// 背景图轮播：预加载 + 硬切
const BG_IMAGES = [
  'assets/textures/bg11.jpg',
  'assets/textures/bg22.jpg',
  'assets/textures/bg33.jpg',
  'assets/textures/bg44.jpg',
];

const bgLayer = document.getElementById('bg-layer');
let bgIndex = 0;

// 预加载所有图片
BG_IMAGES.forEach((src) => {
  const img = new Image();
  img.src = src;
});

// 初始设置第一张
bgLayer.style.backgroundImage = `url('${BG_IMAGES[0]}')`;

// 每 0.5s 硬切
setInterval(() => {
  bgIndex = (bgIndex + 1) % BG_IMAGES.length;
  bgLayer.style.backgroundImage = `url('${BG_IMAGES[bgIndex]}')`;
}, 500);

// 初始化场景
const container = document.getElementById('canvas-container');
const { scene, renderer } = initScene(container);

// 初始化摄像机
const camera = initCamera(window.innerWidth / window.innerHeight);
setupZoom(camera, renderer.domElement);

// 创建 AI Space 长方体
const cubeGroup = createCubeGroup();
scene.add(cubeGroup);

// 绑定输入事件
initInput(camera, cubeGroup, renderer.domElement);

// 窗口自适应
window.addEventListener('resize', () => onResize(camera, renderer));

// 初始化文字痕迹系统
initTextTraces();

// 动画主循环
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = now - lastTime;
  lastTime = now;

  TWEEN.update();
  rotateCube(cubeGroup);
  updateZoom(camera);
  updateTextTraces(cubeGroup, now, delta);

  renderer.render(scene, camera);
}

animate();
