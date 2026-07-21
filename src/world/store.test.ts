import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_POSITION } from './data';
import { worldStore } from './store';

describe('world v2 persistence', () => {
  beforeEach(() => { localStorage.clear(); worldStore.getState().resetWorld(); });

  it('persists Arthur selection and a safe spawn', () => {
    worldStore.getState().selectArthur();
    expect(JSON.parse(localStorage.getItem('savepoint:world:v2') || '{}')).toMatchObject({ version: 2, selectedCharacterId: 'arthur', playerPosition: DEFAULT_POSITION });
  });

  it('tracks the Hall landmark and intro state', () => {
    worldStore.getState().beginIntro();
    worldStore.getState().setLandmark('hall-of-fame');
    expect(worldStore.getState().introSeen).toBe(true);
    expect(worldStore.getState().lastLandmark).toBe('hall-of-fame');
  });
});
