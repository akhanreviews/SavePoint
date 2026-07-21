import { describe, expect, it } from 'vitest';
import { QUALITY_PRESETS } from './data';

describe('3D quality presets', () => {
  it('keeps lower tiers bounded for mobile devices', () => {
    expect(QUALITY_PRESETS.low.shadowMap).toBeLessThan(QUALITY_PRESETS.high.shadowMap);
    expect(QUALITY_PRESETS.low.foliage).toBeLessThan(QUALITY_PRESETS.high.foliage);
    expect(QUALITY_PRESETS.low.fps).toBe(30);
  });
});
