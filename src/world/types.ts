export type WorldPhase =
  | 'loading'
  | 'cloud-reveal'
  | 'island-ready'
  | 'character-select'
  | 'camera-descent'
  | 'exploring'
  | 'hall-confirm'
  | 'hall-transition';

export type QualityTier = 'high' | 'medium' | 'low';

export interface WorldStateV2 {
  version: 2;
  selectedCharacterId: 'arthur';
  playerPosition: [number, number, number];
  introSeen: boolean;
  lastLandmark: 'hall-of-fame' | null;
}
