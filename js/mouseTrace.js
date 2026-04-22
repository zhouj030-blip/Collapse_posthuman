/**
 * mouseTrace.js — 鼠标拖拽笔触（Stroke）
 * 每条笔触由一根连续黑色 Line + 两组彩色 LineSegments 组成：
 *   - 主体黑色（和长方体线框同级细度）
 *   - 极少数段随机染红/青（点缀，坏掉感）
 *   - 画完后每 5~7 秒独立闪烁 1~2 下，不同步
 * 作为 cubeGroup 子物体，跟随长方体旋转。
 * FIX 触发时按 5% 规则保留永久笔触（颜色不变）。
 */
import * as THREE from 'three';

// ─── 常量 ───
const COLORED_PROB = 0.06;            // 每段有 6% 概率被染色
const RED_HEX  = 0xff2244;
const CYAN_HEX = 0x22ffee;

const MAX_POINTS_PER_STROKE = 1000;        // 必须偶数（LineSegments）
const MAX_COLORED_POINTS_PER_STROKE = 200;  // 必须偶数（LineSegments）

const MAX_STROKES = 100;

const MAX_JUMP = 0.3; // 相邻采样点跨度阈值：超过视为断笔

// 断断续续：每条笔触启动时随机出的 p_draw 落在此区间
const P_DRAW_MIN = 0.88;
const P_DRAW_MAX = 0.97;
// 连续跳过这么多段后，强制画一段，避免整条笔触消失
const MAX_SKIP_STREAK = 3;

const FLICKER_MIN_INTERVAL = 3000;
const FLICKER_MAX_INTERVAL = 5000;
const FLICKER_BLINK_MIN_MS = 80;
const FLICKER_BLINK_MAX_MS = 140;
const FLICKER_BLINKS_MIN = 1;
const FLICKER_BLINKS_MAX = 3;

const BASE_OPACITY_BLACK = 0.22;
const BASE_OPACITY_COLOR = 0.55;

// ─── 状态 ───
const strokes = [];

export function initMouseTraces() {
  // 占位
}

// ─── 内部工具 ───

function createBufferGeometry(maxPoints) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(maxPoints * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setDrawRange(0, 0);
  return geo;
}

function writePoint(line, index, v) {
  const arr = line.geometry.attributes.position.array;
  arr[index * 3]     = v.x;
  arr[index * 3 + 1] = v.y;
  arr[index * 3 + 2] = v.z;
}

function disposeStroke(s, cubeGroup) {
  for (const line of [s.blackLine, s.redLine, s.cyanLine]) {
    cubeGroup.remove(line);
    line.geometry.dispose();
    line.material.dispose();
  }
}

// ─── 公开接口 ───

/**
 * 开始一条新笔触
 * @returns {object} stroke 引用（传给 addPointToStroke / endStroke）
 */
export function startStroke(cubeGroup) {
  const blackGeo = createBufferGeometry(MAX_POINTS_PER_STROKE);
  const blackMat = new THREE.LineBasicMaterial({
    color: 0x000000, transparent: true, opacity: BASE_OPACITY_BLACK,
    linewidth: 1, depthWrite: false,
  });
  const blackLine = new THREE.LineSegments(blackGeo, blackMat);
  cubeGroup.add(blackLine);

  const redGeo = createBufferGeometry(MAX_COLORED_POINTS_PER_STROKE);
  const redMat = new THREE.LineBasicMaterial({
    color: RED_HEX, transparent: true, opacity: BASE_OPACITY_COLOR,
    linewidth: 1, depthWrite: false,
  });
  const redLine = new THREE.LineSegments(redGeo, redMat);
  cubeGroup.add(redLine);

  const cyanGeo = createBufferGeometry(MAX_COLORED_POINTS_PER_STROKE);
  const cyanMat = new THREE.LineBasicMaterial({
    color: CYAN_HEX, transparent: true, opacity: BASE_OPACITY_COLOR,
    linewidth: 1, depthWrite: false,
  });
  const cyanLine = new THREE.LineSegments(cyanGeo, cyanMat);
  cubeGroup.add(cyanLine);

  const pDraw = P_DRAW_MIN + Math.random() * (P_DRAW_MAX - P_DRAW_MIN);

  const stroke = {
    blackLine, redLine, cyanLine,
    blackCount: 0, redCount: 0, cyanCount: 0,
    lastPoint: null,
    pDraw,
    skipStreak: 0,
    nextFlickerTime: Infinity, // 画完才开始计时
    flickerQueue: 0,
    flickerInterval: 0,
    flickerOn: true, // 显式状态位：true=当前亮，false=当前灭
    active: true,
  };
  strokes.push(stroke);

  // 总量上限：超限丢弃最老的已完成 stroke
  if (strokes.length > MAX_STROKES) {
    for (let i = 0; i < strokes.length && strokes.length > MAX_STROKES; i++) {
      const s = strokes[i];
      if (!s.active && s !== stroke) {
        disposeStroke(s, cubeGroup);
        strokes.splice(i, 1);
        i--;
      }
    }
  }
  return stroke;
}

/**
 * 向笔触追加一个点（local 坐标）
 */
export function addPointToStroke(stroke, localPoint) {
  if (!stroke || !stroke.active) return;
  if (stroke.blackCount + 2 > MAX_POINTS_PER_STROKE) return;

  // 第一个点：只记录，不成段
  if (stroke.lastPoint === null) {
    stroke.lastPoint = localPoint.clone();
    return;
  }

  const d = stroke.lastPoint.distanceTo(localPoint);
  if (d > MAX_JUMP) {
    // 跨度过大：丢掉这一段，直接跳到新起点
    stroke.lastPoint.copy(localPoint);
    stroke.skipStreak = 0;
    return;
  }

  // 断断续续：按笔触的 pDraw 随机决定这一段画不画
  const forceDraw = stroke.skipStreak >= MAX_SKIP_STREAK;
  const shouldDraw = forceDraw || Math.random() < stroke.pDraw;

  if (!shouldDraw) {
    stroke.skipStreak++;
    stroke.lastPoint.copy(localPoint);
    return;
  }
  stroke.skipStreak = 0;

  // 画这一段（lastPoint → localPoint）
  writePoint(stroke.blackLine, stroke.blackCount, stroke.lastPoint);
  writePoint(stroke.blackLine, stroke.blackCount + 1, localPoint);
  stroke.blackCount += 2;
  stroke.blackLine.geometry.setDrawRange(0, stroke.blackCount);
  stroke.blackLine.geometry.attributes.position.needsUpdate = true;

  // 6% 概率同时染色一段（红或青）
  if (Math.random() < COLORED_PROB) {
    const useRed = Math.random() < 0.5;
    const target = useRed ? stroke.redLine : stroke.cyanLine;
    const countKey = useRed ? 'redCount' : 'cyanCount';
    if (stroke[countKey] + 2 <= MAX_COLORED_POINTS_PER_STROKE) {
      writePoint(target, stroke[countKey], stroke.lastPoint);
      writePoint(target, stroke[countKey] + 1, localPoint);
      stroke[countKey] += 2;
      target.geometry.setDrawRange(0, stroke[countKey]);
      target.geometry.attributes.position.needsUpdate = true;
    }
  }

  stroke.lastPoint.copy(localPoint);
}

/**
 * 结束笔触：开始排程独立闪烁
 */
export function endStroke(stroke, time) {
  if (!stroke) return;
  stroke.active = false;
  stroke.nextFlickerTime = time + FLICKER_MIN_INTERVAL
    + Math.random() * (FLICKER_MAX_INTERVAL - FLICKER_MIN_INTERVAL);
}

/**
 * 每帧更新：独立闪烁循环
 */
export function updateMouseTraces(time) {
  for (const s of strokes) {
    if (s.active) continue;

    if (s.flickerQueue > 0) {
      if (time >= s.flickerInterval) {
        // 翻转显式状态位（红/青不同步：各自独立随机灭/亮，制造"信号坏掉"感）
        s.flickerOn = !s.flickerOn;
        s.blackLine.material.opacity = s.flickerOn ? BASE_OPACITY_BLACK : 0;
        s.redLine.material.opacity   = (Math.random() < 0.5 ? !s.flickerOn : s.flickerOn) ? BASE_OPACITY_COLOR : 0;
        s.cyanLine.material.opacity  = (Math.random() < 0.5 ? !s.flickerOn : s.flickerOn) ? BASE_OPACITY_COLOR : 0;
        s.flickerQueue--;
        s.flickerInterval = time + FLICKER_BLINK_MIN_MS
          + Math.random() * (FLICKER_BLINK_MAX_MS - FLICKER_BLINK_MIN_MS);
        if (s.flickerQueue === 0) {
          // 闪完：强制恢复，排下一轮
          s.flickerOn = true;
          s.blackLine.material.opacity = BASE_OPACITY_BLACK;
          s.redLine.material.opacity   = BASE_OPACITY_COLOR;
          s.cyanLine.material.opacity  = BASE_OPACITY_COLOR;
          s.nextFlickerTime = time + FLICKER_MIN_INTERVAL
            + Math.random() * (FLICKER_MAX_INTERVAL - FLICKER_MIN_INTERVAL);
        }
      }
    } else if (time >= s.nextFlickerTime) {
      const blinks = FLICKER_BLINKS_MIN
        + Math.floor(Math.random() * (FLICKER_BLINKS_MAX - FLICKER_BLINKS_MIN + 1));
      s.flickerQueue = blinks * 2; // 每次闪 = 灭+亮 两步
      s.flickerInterval = time;
      s.flickerOn = true; // 起点视为亮
    }
  }
}

/**
 * FIX 触发：全部清除（正在画的 active 笔触跳过，等它画完）
 */
export function clearMouseTraces(cubeGroup) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    if (!s.active) {
      disposeStroke(s, cubeGroup);
      strokes.splice(i, 1);
    }
  }
}

/**
 * Reset：强制清除所有笔触（包括正在画的 active）
 * active 笔触的引用在 input.js 里会因 stroke.active=false 后续 add/end 被忽略
 */
export function resetMouseTraces(cubeGroup) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    s.active = false;
    disposeStroke(s, cubeGroup);
  }
  strokes.length = 0;
}

export function getStrokeCount() {
  return strokes.length;
}
