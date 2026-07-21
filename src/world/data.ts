import type { QualityTier } from './types';

export const WORLD_ASSETS = {
  arthurAtlas: `${import.meta.env.BASE_URL || '/'}assets/characters/arthur/arthur-walk-atlas.png`,
};

export const DEFAULT_POSITION: [number, number, number] = [0, 0.08, 2.8];

export const QUALITY_PRESETS: Record<QualityTier, { dpr: number; shadowMap: number; foliage: number; clouds: number; fps: number }> = {
  high: { dpr: 1.75, shadowMap: 2048, foliage: 250, clouds: 24, fps: 60 },
  medium: { dpr: 1.25, shadowMap: 1024, foliage: 120, clouds: 16, fps: 45 },
  low: { dpr: 1, shadowMap: 512, foliage: 50, clouds: 10, fps: 30 },
};

export function chooseQuality(): QualityTier {
  const device = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || device.connection?.saveData) return 'low';
  if (window.matchMedia?.('(pointer: coarse)').matches || (device.deviceMemory != null && device.deviceMemory <= 4)) return 'medium';
  return 'high';
}
