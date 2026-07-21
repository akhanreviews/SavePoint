import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { DEFAULT_POSITION } from './data';
import type { WorldStateV2 } from './types';

const STORAGE_KEY = 'savepoint:world:v2';
const LEGACY_KEY = 'savepoint:world:v1';
const fallback: WorldStateV2 = { version: 2, selectedCharacterId: 'arthur', playerPosition: DEFAULT_POSITION, introSeen: false, lastLandmark: null };

function readState(): WorldStateV2 {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (current?.version === 2 && current.selectedCharacterId === 'arthur' && Array.isArray(current.playerPosition)) return { ...fallback, ...current };
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (legacy?.version === 1) return { ...fallback, introSeen: false, playerPosition: DEFAULT_POSITION };
  } catch { /* storage is optional */ }
  return fallback;
}

function persist(state: WorldStateV2) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private browsing */ }
}

export interface WorldStore extends WorldStateV2 {
  beginIntro: () => void;
  selectArthur: () => void;
  setPosition: (position: [number, number, number]) => void;
  setLandmark: (landmark: WorldStateV2['lastLandmark']) => void;
  resetWorld: () => void;
}

export const worldStore = createStore<WorldStore>((set) => ({
  ...readState(),
  beginIntro: () => set((state) => { const next = { ...state, introSeen: true }; persist(next); return next; }),
  selectArthur: () => set((state) => { const next = { ...state, selectedCharacterId: 'arthur' as const }; persist(next); return next; }),
  setPosition: (playerPosition) => set((state) => { const next = { ...state, playerPosition }; persist(next); return next; }),
  setLandmark: (lastLandmark) => set((state) => { const next = { ...state, lastLandmark }; persist(next); return next; }),
  resetWorld: () => set(() => { persist(fallback); return fallback; }),
}));

export const useWorldStore = <T,>(selector: (state: WorldStore) => T) => useStore(worldStore, selector);
