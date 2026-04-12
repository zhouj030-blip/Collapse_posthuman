/**
 * textTrace.js — 文字痕迹系统
 * 在长方体六个内壁上动态生成文字，带各种"不完美"效果
 */
import * as THREE from 'three';
import { addEdgeBreaks } from './cubeGroup.js';

// ─── 文字列表 ───
const TEXTS = [
  'Hello world',
  'Can you stay a little longer?',
  'Take care',
  '故郷の桜が咲きました。',
  '天乐，下楼吃饭啦！',
  '等我一下啦',
  "You'd never know it, but I miss you everyday and hope everyday you're doing okay.",
  'I still think about you.',
  'I hope our story isn\'t over yet.',
  'Life is just a single sheet of lined paper so don\'t just sit on a line go and fetch more.',
  'I\'m sorry...',
];

// ─── 字体列表 ───
const FONT_LIST = [
  'Source Code Pro',
  'JetBrains Mono',
  'Indie Flower',
  'Annie Use Your Telescope',
  'Press Start 2P',
  'ZCOOL KuaiLe',
  'monospace',
];

// ─── 乱码字符池 ───
const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:<>?/~░▒▓█▄▀■□▪▫●○◆◇♦♠♣♥♢';

// ─── 文字颜色池（黑色/深灰） ───
const COLOR_POOL = [
  'rgba(0, 0, 0, 0.85)',
  'rgba(30, 30, 30, 0.80)',
  'rgba(50, 50, 50, 0.75)',
  'rgba(20, 20, 20, 0.90)',
  'rgba(40, 40, 40, 0.70)',
];

// ─── 永久痕迹颜色池（红/黄/绿/紫/蓝） ───
const PERMANENT_COLOR_POOL = [
  'rgba(220, 40, 40, 0.92)',
  'rgba(230, 190, 30, 0.92)',
  'rgba(40, 180, 60, 0.92)',
  'rgba(160, 50, 210, 0.92)',
  'rgba(40, 100, 240, 0.92)',
];

// ─── 六个内壁定义（本地坐标，Box = 1×1.55×1） ───
const FACES = [
  { name: 'front',  pos: [0, 0, 0.499],  rot: [0, Math.PI, 0],       w: 1, h: 1.55 },
  { name: 'back',   pos: [0, 0, -0.499], rot: [0, 0, 0],             w: 1, h: 1.55 },
  { name: 'right',  pos: [0.499, 0, 0],  rot: [0, -Math.PI / 2, 0],  w: 1, h: 1.55 },
  { name: 'left',   pos: [-0.499, 0, 0], rot: [0, Math.PI / 2, 0],   w: 1, h: 1.55 },
  { name: 'top',    pos: [0, 0.774, 0],  rot: [Math.PI / 2, 0, 0],   w: 1, h: 1 },
  { name: 'bottom', pos: [0, -0.774, 0], rot: [-Math.PI / 2, 0, 0],  w: 1, h: 1 },
];

// ─── 常量 ───
const SPAWN_MIN = 500;
const SPAWN_MAX = 1500;
const CLEAR_INTERVAL = 90000; // 每 90 秒清理一次
const PERMANENT_RATIO = 0.05; // 每次清理保留 5%
const MAX_LOCAL_FONT_SIZE = 0.086; // 再缩小 1/3
const MIN_LOCAL_FONT_SIZE = 0.05;
const CANVAS_PX_PER_UNIT = 200;

const FIX_DURATION = 3000; // 全屏 FIX 持续 3 秒

// ─── 模块状态 ───
let traces = [];
let nextSpawnTime = 0;
let nextClearTime = 0;
let fontsReady = false;
let fixPending = false; // 是否正在播放 FIX 全屏动画
let fixEndTime = 0;
let fixCount = 0;
let noiseInterval = null;

// ─── 公共接口 ───

export async function initTextTraces() {
  await document.fonts.ready;
  fontsReady = true;
  const now = performance.now();
  nextSpawnTime = now + randomRange(SPAWN_MIN, SPAWN_MAX);
  nextClearTime = now + CLEAR_INTERVAL;
}


export function updateTextTraces(cubeGroup, time, delta) {
  if (!fontsReady) return;

  // FIX 全屏动画播放中：暂停文字生成
  if (fixPending) {
    if (time >= fixEndTime) {
      hideFixOverlay();
      fixPending = false;
    }
    return;
  }

  // 120 秒周期清理
  if (time >= nextClearTime) {
    triggerFix(cubeGroup, time);
    nextClearTime = time + CLEAR_INTERVAL;
    return;
  }

  // 生成新文字
  if (time >= nextSpawnTime) {
    spawnTrace(cubeGroup, time);
    nextSpawnTime = time + randomRange(SPAWN_MIN, SPAWN_MAX);
  }

  // 更新所有文字效果
  for (let i = traces.length - 1; i >= 0; i--) {
    const trace = traces[i];
    for (const effect of trace.effects) {
      effect.update(trace, time, delta);
    }
  }
}

export function clearTraces(cubeGroup) {
  periodicClear(cubeGroup);
}

// ─── FIX 全屏动画 ───

const FIX_FONTS = ['Impact', 'Corbel', 'Courier New', 'Bernard MT Condensed'];
const FIX_FONT_WEIGHTS = { 'Impact': '400', 'Corbel': '300', 'Courier New': '300', 'Bernard MT Condensed': '400' };
const FIX_SIZES = ['8vw', '50vw'];
let fontInterval = null;
let sizeInterval = null;
let glitchInterval = null;
let blockInterval = null;

function triggerFix(cubeGroup, time) {
  periodicClear(cubeGroup);
  fixCount++;
  updateFixCounter();
  addEdgeBreaks(cubeGroup);
  showFixOverlay();
  fixPending = true;
  fixEndTime = time + FIX_DURATION;
}

function updateFixCounter() {
  const el = document.getElementById('fix-counter');
  if (el) el.textContent = String(fixCount).padStart(3, '0');
}

function showFixOverlay() {
  const overlay = document.getElementById('fix-overlay');
  const fixText = document.getElementById('fix-text');
  if (!overlay || !fixText) return;
  overlay.classList.add('active');

  // 字体随机切换：0.3~0.7 秒
  const switchFont = () => {
    const font = FIX_FONTS[Math.floor(Math.random() * FIX_FONTS.length)];
    fixText.style.fontFamily = `"${font}", sans-serif`;
    fixText.style.fontWeight = FIX_FONT_WEIGHTS[font];
  };
  switchFont();
  fontInterval = setInterval(switchFont, randomRange(300, 700));

  // 大小随机切换：0.3~0.7 秒，只有 8vw 和 50vw
  const switchSize = () => {
    fixText.style.fontSize = FIX_SIZES[Math.floor(Math.random() * 2)];
  };
  switchSize();
  sizeInterval = setInterval(switchSize, randomRange(300, 700));

  // 黑白故障：白色 text-shadow 偏移 + 横向震动（幅度小，频率随机）
  glitchInterval = setInterval(() => {
    const dx1 = (Math.random() - 0.5) * 20;
    const dx2 = (Math.random() - 0.5) * 20;
    fixText.style.textShadow = `${dx1}px 0 0 rgba(255,255,255,0.5), ${dx2}px 0 0 rgba(255,255,255,0.3)`;
    // 横向震动，幅度小
    fixText.style.transform = `translateX(${(Math.random() - 0.5) * 8}px)`;
  }, randomRange(100, 250));

  // 方形白色色块（故障感）
  const noiseCanvas = document.getElementById('fix-noise');
  if (noiseCanvas) {
    noiseCanvas.width = window.innerWidth;
    noiseCanvas.height = window.innerHeight;
    const ctx = noiseCanvas.getContext('2d');
    blockInterval = setInterval(() => {
      ctx.clearRect(0, 0, noiseCanvas.width, noiseCanvas.height);
      // 随机 3~8 个白色方块
      const count = Math.floor(Math.random() * 6) + 3;
      for (let i = 0; i < count; i++) {
        const x = Math.random() * noiseCanvas.width;
        const y = Math.random() * noiseCanvas.height;
        const w = Math.random() * 120 + 20;
        const h = Math.random() * 40 + 5;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.4 + 0.1})`;
        ctx.fillRect(x, y, w, h);
      }
    }, 80);
  }
}

function hideFixOverlay() {
  const overlay = document.getElementById('fix-overlay');
  const fixText = document.getElementById('fix-text');
  if (overlay) overlay.classList.remove('active');
  if (fixText) {
    fixText.style.textShadow = '';
    fixText.style.transform = '';
    fixText.style.fontFamily = '';
    fixText.style.fontWeight = '';
    fixText.style.fontSize = '';
  }
  if (noiseInterval) { clearInterval(noiseInterval); noiseInterval = null; }
  if (fontInterval) { clearInterval(fontInterval); fontInterval = null; }
  if (sizeInterval) { clearInterval(sizeInterval); sizeInterval = null; }
  if (glitchInterval) { clearInterval(glitchInterval); glitchInterval = null; }
  if (blockInterval) { clearInterval(blockInterval); blockInterval = null; }
}

export function getTraceCount() {
  return traces.length;
}

// ─── 周期清理：保留 5% 作为永久痕迹 ───

function periodicClear(cubeGroup) {
  const nonPermanent = traces.filter(t => !t.permanent);
  if (nonPermanent.length === 0) return;

  // 随机选 5% 标记为永久，并变色
  const keepCount = Math.max(1, Math.ceil(nonPermanent.length * PERMANENT_RATIO));
  const shuffled = nonPermanent.sort(() => Math.random() - 0.5);
  for (let i = 0; i < keepCount; i++) {
    shuffled[i].permanent = true;
    const newColor = PERMANENT_COLOR_POOL[Math.floor(Math.random() * PERMANENT_COLOR_POOL.length)];
    shuffled[i].color = newColor;
    redrawCanvas(shuffled[i], shuffled[i].text);
  }

  // 删除剩余的非永久文字
  for (let i = traces.length - 1; i >= 0; i--) {
    if (!traces[i].permanent) {
      disposeTrace(traces[i], cubeGroup);
    }
  }
}

// ─── 生成文字 ───

function spawnTrace(cubeGroup, time) {
  const text = TEXTS[Math.floor(Math.random() * TEXTS.length)];
  const font = FONT_LIST[Math.floor(Math.random() * FONT_LIST.length)];
  const localFontSize = randomRange(MIN_LOCAL_FONT_SIZE, MAX_LOCAL_FONT_SIZE);
  const face = FACES[Math.floor(Math.random() * FACES.length)];
  const color = COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
  const effects = pickEffects();

  // 创建 Canvas 纹理（支持自动换行）
  const pxSize = Math.round(localFontSize * CANVAS_PX_PER_UNIT);
  const maxCanvasW = Math.round(face.w * 0.85 * CANVAS_PX_PER_UNIT);
  const { canvas, ctx, texWidth, texHeight } = createTextCanvas(text, font, pxSize, color, maxCanvasW);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // 平面尺寸：从 Canvas 像素映射到本地空间
  const planeW = texWidth / CANVAS_PX_PER_UNIT;
  const planeH = texHeight / CANVAS_PX_PER_UNIT;

  const geometry = new THREE.PlaneGeometry(planeW, planeH);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    alphaTest: 0.01,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // 定位到内壁随机位置
  positionOnFace(mesh, face, planeW, planeH);

  cubeGroup.add(mesh);

  const trace = {
    mesh,
    texture,
    canvas,
    ctx,
    text,
    font,
    fontSize: pxSize,
    color,
    face,
    effects,
    maxCanvasW,
    createdAt: time,
    permanent: false,
    baseOpacity: 0.85,
    basePos: mesh.position.clone(),
    charIndex: 0,
  };

  // 初始化效果
  for (const effect of effects) {
    if (effect.init) effect.init(trace, time);
  }

  traces.push(trace);
}

// ─── Canvas 文字渲染（支持自动换行） ───

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let currentLine = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const testLine = currentLine + ch;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = ch;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function createTextCanvas(text, fontName, fontSize, color, maxWidth) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  ctx.font = `${fontSize}px "${fontName}", sans-serif`;

  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.4;
  const texHeight = Math.ceil(lineHeight * lines.length + fontSize * 0.4);
  let texWidth = 0;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > texWidth) texWidth = w;
  }
  texWidth = Math.ceil(texWidth + fontSize * 0.6);

  canvas.width = texWidth;
  canvas.height = texHeight;

  // 重设字体（resize 后丢失）
  ctx.font = `${fontSize}px "${fontName}", sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], fontSize * 0.3, fontSize * 0.2 + i * lineHeight);
  }

  return { canvas, ctx, texWidth, texHeight };
}

function redrawCanvas(trace, displayText) {
  const { ctx, canvas, font, fontSize, color, maxCanvasW } = trace;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontSize}px "${font}", sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  const lines = wrapText(ctx, displayText, maxCanvasW);
  const lineHeight = fontSize * 1.4;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], fontSize * 0.3, fontSize * 0.2 + i * lineHeight);
  }
  trace.texture.needsUpdate = true;
}

function redrawCanvasWave(trace, displayText, time) {
  const { ctx, canvas, font, fontSize, color, maxCanvasW } = trace;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontSize}px "${font}", sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  const lines = wrapText(ctx, displayText, maxCanvasW);
  const lineHeight = fontSize * 1.4;
  let charCount = 0;
  for (let li = 0; li < lines.length; li++) {
    let x = fontSize * 0.3;
    const baseY = fontSize * 0.2 + li * lineHeight;
    for (let i = 0; i < lines[li].length; i++) {
      const ch = lines[li][i];
      const yOffset = Math.sin(charCount * 0.5 + time * 0.003) * fontSize * 0.15;
      ctx.fillText(ch, x, baseY + yOffset);
      x += ctx.measureText(ch).width;
      charCount++;
    }
  }
  trace.texture.needsUpdate = true;
}

// ─── 内壁定位 ───

function positionOnFace(mesh, face, planeW, planeH) {
  const margin = 0.05;
  const availW = face.w - planeW - margin * 2;
  const availH = face.h - planeH - margin * 2;

  const u = availW > 0 ? (Math.random() - 0.5) * availW : 0;
  const v = availH > 0 ? (Math.random() - 0.5) * availH : 0;

  mesh.rotation.set(face.rot[0], face.rot[1], face.rot[2]);

  const faceNormal = new THREE.Vector3(face.pos[0], face.pos[1], face.pos[2]).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();

  if (face.name === 'top' || face.name === 'bottom') {
    mesh.position.set(face.pos[0] + u, face.pos[1], face.pos[2] + v);
  } else {
    right.crossVectors(up, faceNormal).normalize();
    mesh.position.set(
      face.pos[0] + right.x * u,
      face.pos[1] + v,
      face.pos[2] + right.z * u
    );
  }
}

// ─── 效果系统 ───

function pickEffects() {
  const allEffects = [
    createJitterEffect,
    createFlickerEffect,
    createTypewriterEffect,
    createIntermittentGlitchEffect,
    createWaveEffect,
  ];

  const count = Math.floor(Math.random() * 3) + 1;
  const shuffled = allEffects.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);

  // 避免同时有打字机+间歇乱码（冲突）
  const hasTypewriter = picked.some(f => f === createTypewriterEffect);
  const hasGlitch = picked.some(f => f === createIntermittentGlitchEffect);
  if (hasTypewriter && hasGlitch) {
    const idx = picked.indexOf(createIntermittentGlitchEffect);
    picked.splice(idx, 1);
  }

  return picked.map(fn => fn());
}

// ── 抖动 ──
function createJitterEffect() {
  const amp = 0.002;
  return {
    type: 'jitter',
    update(trace) {
      trace.mesh.position.x = trace.basePos.x + (Math.random() - 0.5) * amp * 2;
      trace.mesh.position.y = trace.basePos.y + (Math.random() - 0.5) * amp * 2;
      trace.mesh.position.z = trace.basePos.z + (Math.random() - 0.5) * amp * 2;
    },
  };
}

// ── 闪烁（间隔加长） ──
function createFlickerEffect() {
  let nextFlick = 0;
  let visible = true;
  return {
    type: 'flicker',
    update(trace, time) {
      if (time > nextFlick) {
        visible = Math.random() > 0.3;
        nextFlick = time + randomRange(400, 1200);
      }
      trace.mesh.material.opacity = visible ? trace.baseOpacity : 0.05;
    },
  };
}

// ── 打字机 ──
function createTypewriterEffect() {
  let nextChar = 0;
  const charInterval = randomRange(50, 120);
  return {
    type: 'typewriter',
    init(trace, time) {
      trace.charIndex = 0;
      redrawCanvas(trace, '');
      nextChar = time + charInterval;
    },
    update(trace, time) {
      if (trace.charIndex >= trace.text.length) return;
      if (time > nextChar) {
        trace.charIndex++;
        const partial = trace.text.slice(0, trace.charIndex);
        redrawCanvas(trace, partial);
        nextChar = time + charInterval;
      }
    },
  };
}

// ── 间歇乱码：大部分时间正常，偶尔短暂变乱码再恢复 ──
function createIntermittentGlitchEffect() {
  let nextGlitchStart = 0;
  let glitchEndTime = 0;
  let isGlitching = false;
  let nextGlitchFrame = 0;
  const ratio = randomRange(0.15, 0.5);

  return {
    type: 'intermittentGlitch',
    init(trace, time) {
      nextGlitchStart = time + randomRange(2000, 5000);
    },
    update(trace, time) {
      if (!isGlitching) {
        // 等待下一次乱码触发
        if (time >= nextGlitchStart) {
          isGlitching = true;
          glitchEndTime = time + randomRange(300, 800);
          nextGlitchFrame = 0;
        }
        return;
      }

      // 正在乱码中
      if (time >= glitchEndTime) {
        // 乱码结束，恢复正常文字
        isGlitching = false;
        nextGlitchStart = time + randomRange(2000, 5000);
        redrawCanvas(trace, trace.text);
        return;
      }

      // 乱码期间：快速切换乱码字符
      if (time >= nextGlitchFrame) {
        nextGlitchFrame = time + randomRange(60, 150);
        const chars = trace.text.split('');
        const count = Math.floor(chars.length * ratio);
        for (let i = 0; i < count; i++) {
          const idx = Math.floor(Math.random() * chars.length);
          chars[idx] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        }
        redrawCanvas(trace, chars.join(''));
      }
    },
  };
}

// ── 波纹 ──
function createWaveEffect() {
  let nextWave = 0;
  return {
    type: 'wave',
    update(trace, time) {
      if (time < nextWave) return;
      nextWave = time + 50;
      const display = trace.charIndex !== undefined && trace.charIndex < trace.text.length
        ? trace.text.slice(0, trace.charIndex)
        : trace.text;
      redrawCanvasWave(trace, display, time);
    },
  };
}

// ─── 清理 ───

function disposeTrace(trace, cubeGroup) {
  cubeGroup.remove(trace.mesh);
  trace.mesh.geometry.dispose();
  trace.mesh.material.dispose();
  trace.texture.dispose();
  const idx = traces.indexOf(trace);
  if (idx !== -1) traces.splice(idx, 1);
}

// ─── 外部调用：将 audience 文字作为永久痕迹添加到长方体 ───

export function spawnPermanentTrace(cubeGroup, customText) {
  const time = performance.now();
  const font = FONT_LIST[Math.floor(Math.random() * FONT_LIST.length)];
  const localFontSize = randomRange(MIN_LOCAL_FONT_SIZE, MAX_LOCAL_FONT_SIZE);
  const face = FACES[Math.floor(Math.random() * FACES.length)];
  const color = PERMANENT_COLOR_POOL[Math.floor(Math.random() * PERMANENT_COLOR_POOL.length)];
  const effects = pickEffects();

  const pxSize = Math.round(localFontSize * CANVAS_PX_PER_UNIT);
  const maxCanvasW = Math.round(face.w * 0.85 * CANVAS_PX_PER_UNIT);
  const { canvas, ctx, texWidth, texHeight } = createTextCanvas(customText, font, pxSize, color, maxCanvasW);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const planeW = texWidth / CANVAS_PX_PER_UNIT;
  const planeH = texHeight / CANVAS_PX_PER_UNIT;

  const geometry = new THREE.PlaneGeometry(planeW, planeH);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    alphaTest: 0.01,
  });

  const mesh = new THREE.Mesh(geometry, material);
  positionOnFace(mesh, face, planeW, planeH);
  cubeGroup.add(mesh);

  const trace = {
    mesh,
    texture,
    canvas,
    ctx,
    text: customText,
    font,
    fontSize: pxSize,
    color,
    face,
    effects,
    maxCanvasW,
    createdAt: time,
    permanent: true,
    baseOpacity: 0.85,
    basePos: mesh.position.clone(),
    charIndex: 0,
  };

  for (const effect of effects) {
    if (effect.init) effect.init(trace, time);
  }

  traces.push(trace);
}

// ─── 工具 ───

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
