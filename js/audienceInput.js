/**
 * audienceInput.js — Audience 交互系统
 * 观众输入文字 → 弹出在网页表面 → 90秒后淡出消失 → 转入 AI 空间作为永久痕迹
 * 独立于 Three.js，不受 FIX 清除影响
 */
import { spawnPermanentTrace } from './textTrace.js';

// ─── 常量 ───

const PLACEHOLDERS = [
  'How are you feeling now?',
  'Say anything to your friends…',
  'Curse at something…',
  'Say something to the one you love…',
  'How is your day going?',
  'The words you swallowed.',
  'Is there anything you miss?',
  'Say something to yourself…',
  'Tell me a lie.',
  'Whisper it here.',
];

const FONTS = [
  "'Courier New', monospace",
  "monospace",
];

const LIFETIME_MS = 90000;
const FADE_DURATION_MS = 2000;
const FLICKER_INTERVAL_MIN = 5000;
const FLICKER_INTERVAL_MAX = 8000;
const JITTER_INTERVAL_MIN = 3000;
const JITTER_INTERVAL_MAX = 5000;
const BAR_GLITCH_INTERVAL_MIN = 3000;
const BAR_GLITCH_INTERVAL_MAX = 4000;

// ─── 状态 ───

let activeTexts = [];
let currentPlaceholderIndex = -1;
let cubeGroupRef = null;

// ─── 公共接口 ───

export function initAudienceInput(cubeGroup) {
  cubeGroupRef = cubeGroup;
  const input = document.getElementById('audience-input');
  const enterLabel = document.getElementById('enter-label');

  if (!input || !enterLabel) return;

  // 设置随机初始 placeholder
  setRandomPlaceholder(input);

  // Enter 键提交（阻止换行）
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitInput(input);
    }
  });

  // 点击 ENTER 按钮提交
  enterLabel.addEventListener('click', () => {
    submitInput(input);
  });
}

// ─── 内部函数 ───

function submitInput(input) {
  const text = input.value.trim();
  if (!text) return;

  spawnPopupText(text);
  input.value = '';
  setRandomPlaceholder(input);
}

function setRandomPlaceholder(input) {
  let idx;
  do {
    idx = Math.floor(Math.random() * PLACEHOLDERS.length);
  } while (idx === currentPlaceholderIndex && PLACEHOLDERS.length > 1);
  currentPlaceholderIndex = idx;
  input.placeholder = PLACEHOLDERS[idx];
}

function spawnPopupText(text) {
  const layer = document.getElementById('audience-text-layer');
  if (!layer) return;

  const el = document.createElement('div');
  el.classList.add('audience-text');
  el.textContent = text;

  // 随机字体
  const font = FONTS[Math.floor(Math.random() * FONTS.length)];
  el.style.fontFamily = font;

  // 随机字重（100 最细 / 500 medium）
  el.style.fontWeight = Math.random() < 0.5 ? '100' : '500';

  // 随机字号（0.8~1.1rem）
  const fontSize = 0.8 + Math.random() * 0.3;
  el.style.fontSize = fontSize + 'rem';

  // 随机位置（屏幕中心正方形区域，避开右下角输入框）
  const regionSize = 55;
  const regionLeft = (100 - regionSize) / 2;
  const regionTop = 20;
  let left, top;
  do {
    left = regionLeft + Math.random() * regionSize;
    top = regionTop + Math.random() * regionSize;
  } while (left > 70 && top > 70); // 避开右下角输入框区域
  el.style.left = left + '%';
  el.style.top = top + '%';

  // 白色背景 bar
  const bar = document.createElement('div');
  bar.classList.add('audience-bar');
  el.appendChild(bar);

  layer.appendChild(el);

  const entry = {
    element: el,
    bar,
    text,
    flickerTimeout: null,
    jitterTimeout: null,
    barGlitchTimeout: null,
    removed: false,
  };

  activeTexts.push(entry);

  // 启动闪烁循环
  startFlickerCycle(entry);

  // 启动间歇抖动循环
  startJitterCycle(entry);

  // 启动白色 bar 故障循环
  startBarGlitchCycle(entry);

  // 启动 90 秒淡出
  scheduleRemoval(entry);
}

function startFlickerCycle(entry) {
  if (entry.removed) return;

  const delay = FLICKER_INTERVAL_MIN + Math.random() * (FLICKER_INTERVAL_MAX - FLICKER_INTERVAL_MIN);
  entry.flickerTimeout = setTimeout(() => {
    if (entry.removed) return;
    const count = 2 + Math.floor(Math.random() * 2); // 2-3 下
    doFlicker(entry, count, () => {
      startFlickerCycle(entry);
    });
  }, delay);
}

function doFlicker(entry, count, onDone) {
  if (count <= 0 || entry.removed) {
    if (onDone) onDone();
    return;
  }

  // 灭
  entry.element.classList.add('flickering');
  setTimeout(() => {
    if (entry.removed) return;
    // 亮
    entry.element.classList.remove('flickering');
    setTimeout(() => {
      doFlicker(entry, count - 1, onDone);
    }, 80 + Math.random() * 60);
  }, 80 + Math.random() * 60);
}

function startJitterCycle(entry) {
  if (entry.removed) return;

  const delay = JITTER_INTERVAL_MIN + Math.random() * (JITTER_INTERVAL_MAX - JITTER_INTERVAL_MIN);
  entry.jitterTimeout = setTimeout(() => {
    if (entry.removed) return;
    const count = 2 + Math.floor(Math.random() * 3); // 2-4 下
    doJitter(entry, count, () => {
      startJitterCycle(entry);
    });
  }, delay);
}

function doJitter(entry, count, onDone) {
  if (count <= 0 || entry.removed) {
    entry.element.style.animation = '';
    if (onDone) onDone();
    return;
  }

  const duration = 0.08 + Math.random() * 0.06;
  entry.element.style.animation = `audienceJitter ${duration}s 1`;
  setTimeout(() => {
    entry.element.style.animation = '';
    setTimeout(() => {
      doJitter(entry, count - 1, onDone);
    }, 50 + Math.random() * 50);
  }, duration * 1000);
}

function startBarGlitchCycle(entry) {
  if (entry.removed) return;

  const delay = BAR_GLITCH_INTERVAL_MIN + Math.random() * (BAR_GLITCH_INTERVAL_MAX - BAR_GLITCH_INTERVAL_MIN);
  entry.barGlitchTimeout = setTimeout(() => {
    if (entry.removed) return;
    const count = 2 + Math.floor(Math.random() * 2); // 2-3 下
    doBarGlitch(entry, count, () => {
      startBarGlitchCycle(entry);
    });
  }, delay);
}

function doBarGlitch(entry, count, onDone) {
  if (count <= 0 || entry.removed) {
    if (onDone) onDone();
    return;
  }

  // 生成杂色色块
  const blocks = spawnGlitchBlocks(entry);

  // bar 闪烁灭
  entry.bar.style.opacity = '0.1';
  setTimeout(() => {
    if (entry.removed) return;
    // bar 闪烁亮
    entry.bar.style.opacity = '1';
    // 移除色块
    blocks.forEach(b => b.remove());
    setTimeout(() => {
      doBarGlitch(entry, count - 1, onDone);
    }, 60 + Math.random() * 60);
  }, 80 + Math.random() * 60);
}

function spawnGlitchBlocks(entry) {
  const blocks = [];
  const count = 3 + Math.floor(Math.random() * 4); // 3-6 个色块
  const rect = entry.element.getBoundingClientRect();

  for (let i = 0; i < count; i++) {
    const block = document.createElement('div');
    block.classList.add('glitch-block');

    const w = 4 + Math.random() * 20;
    const h = 2 + Math.random() * 6;
    // 色块位置：在 bar 上及周围（-10px ~ rect宽+10px）
    const x = -10 + Math.random() * (rect.width + 20);
    const y = -6 + Math.random() * (rect.height + 12);

    block.style.width = w + 'px';
    block.style.height = h + 'px';
    block.style.left = x + 'px';
    block.style.top = y + 'px';

    // 黑色/灰色随机
    const gray = Math.floor(Math.random() * 120);
    const alpha = 0.3 + Math.random() * 0.5;
    block.style.background = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;

    entry.element.appendChild(block);
    blocks.push(block);
  }

  return blocks;
}

function scheduleRemoval(entry) {
  // 88 秒后开始淡出
  setTimeout(() => {
    if (entry.removed) return;
    entry.element.classList.add('fading');
  }, LIFETIME_MS - FADE_DURATION_MS);

  // 90 秒后移除，并转入 AI 空间作为永久痕迹
  setTimeout(() => {
    if (entry.removed) return;
    entry.removed = true;
    if (entry.flickerTimeout) clearTimeout(entry.flickerTimeout);
    if (entry.jitterTimeout) clearTimeout(entry.jitterTimeout);
    if (entry.barGlitchTimeout) clearTimeout(entry.barGlitchTimeout);
    const text = entry.text;
    entry.element.remove();
    const idx = activeTexts.indexOf(entry);
    if (idx !== -1) activeTexts.splice(idx, 1);
    // 转入长方体内壁作为永久痕迹
    if (cubeGroupRef) {
      spawnPermanentTrace(cubeGroupRef, text);
    }
  }, LIFETIME_MS);
}
