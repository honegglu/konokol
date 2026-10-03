import type { DetectorParams, FrameStat, Onset } from './detector'

export const WORKLET_NAME = 'onset-detector'

/** Grösse der Audio-Blöcke, die das Worklet an die Seite schickt (Vielfaches von 128). */
export const WORKLET_BLOCK = 2048

export type WorkletInMessage =
  | { type: 'params'; params: Partial<DetectorParams> }
  /** `epoch` beschriftet alle folgenden Nachrichten des Worklets, damit die Seite Nachzügler vor dem Reset erkennt. */
  | { type: 'reset'; epoch: number; params?: Partial<DetectorParams> }
  | { type: 'flush' }

/** `epoch` ist die Epoche des letzten `reset` (anfangs 0). */
export type WorkletOutMessage =
  | { type: 'block'; epoch: number; startFrame: number; samples: Float32Array; frames: FrameStat[] }
  | { type: 'onsets'; epoch: number; onsets: Onset[] }
