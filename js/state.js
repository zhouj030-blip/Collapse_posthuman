/**
 * state.js — 全局状态管理
 * 零依赖，纯数据模块
 */

const state = {
  traceCount: 0,
  threshold: 20,
  phase: 'idle', // idle | accumulating | collapsing
  permanentTraces: [],
};

export function addTrace(traceData) {
  state.traceCount++;
  return state.traceCount;
}

export function markPermanent(traceData) {
  state.permanentTraces.push(traceData);
}

export function resetTraces() {
  state.traceCount = 0;
}

export function getState() {
  return state;
}

export function setPhase(phase) {
  state.phase = phase;
}
