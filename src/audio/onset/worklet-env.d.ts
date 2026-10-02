// Globale Namen im AudioWorkletGlobalScope (nicht Teil der DOM-Typen von TypeScript).
declare const sampleRate: number
declare const currentFrame: number

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor(options?: unknown)
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
}

declare function registerProcessor(name: string, processorCtor: new (options?: unknown) => AudioWorkletProcessor): void
