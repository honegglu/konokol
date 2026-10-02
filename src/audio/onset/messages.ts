import type { DetectorParams, FrameStat, Onset } from './detector'

export const WORKLET_NAME = 'onset-detector'

/** Grösse der Audio-Blöcke, die das Worklet an die Seite schickt (Vielfaches von 128). */
export const WORKLET_BLOCK = 2048

export type WorkletInMessage =
  | { type: 'params'; params: Partial<DetectorParams> }
  | { type: 'reset'; params?: Partial<DetectorParams> }
  | { type: 'flush' }

export type WorkletOutMessage =
  | { type: 'block'; startFrame: number; samples: Float32Array; frames: FrameStat[] }
  | { type: 'onsets'; onsets: Onset[] }
