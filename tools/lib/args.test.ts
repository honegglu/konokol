import { describe, expect, it } from 'vitest'
import { parseBuildArgs } from './args'

describe('parseBuildArgs', () => {
  it('erzeugt ohne Flag alle drei Gruppen', () => {
    expect([...parseBuildArgs([]).groups].sort()).toEqual(['count', 'syllables', 'ui'])
  })
  it('beschränkt mit --only auf die genannte Gruppe', () => {
    expect([...parseBuildArgs(['--only', 'count']).groups]).toEqual(['count'])
  })
  it('akzeptiert --only mehrfach und kommagetrennt', () => {
    expect([...parseBuildArgs(['--only', 'count', '--only', 'ui']).groups].sort()).toEqual(['count', 'ui'])
    expect([...parseBuildArgs(['--only', 'syllables,ui']).groups].sort()).toEqual(['syllables', 'ui'])
    expect([...parseBuildArgs(['--only=count,ui']).groups].sort()).toEqual(['count', 'ui'])
  })
  it('wirft bei einer unbekannten Gruppe einen deutschen Fehler', () => {
    expect(() => parseBuildArgs(['--only', 'drums'])).toThrow('Unbekannte Gruppe "drums"')
    expect(() => parseBuildArgs(['--only', 'drums'])).toThrow('syllables, count, ui')
  })
  it('wirft, wenn --only keinen Wert hat', () => {
    expect(() => parseBuildArgs(['--only'])).toThrow('--only braucht')
    expect(() => parseBuildArgs(['--only='])).toThrow('--only braucht')
  })
  it('wirft bei unbekannten Argumenten', () => {
    expect(() => parseBuildArgs(['--nur', 'count'])).toThrow('Unbekanntes Argument "--nur"')
  })
})
