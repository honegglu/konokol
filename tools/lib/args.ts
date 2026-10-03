export const BUILD_GROUPS = ['syllables', 'count', 'ui'] as const
export type BuildGroup = (typeof BUILD_GROUPS)[number]

/**
 * Wertet die Argumente von `build` aus. Ohne `--only` gelten alle Gruppen.
 * `--only` darf mehrfach vorkommen und kommagetrennte Listen enthalten
 * (`--only count --only ui`, `--only syllables,ui`, `--only=count`).
 */
export function parseBuildArgs(args: string[]): { groups: Set<BuildGroup> } {
  const requested: string[] = []
  let only = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    let value: string | undefined
    if (arg === '--only') value = args[++i]
    else if (arg.startsWith('--only=')) value = arg.slice('--only='.length)
    else throw new Error(`Unbekanntes Argument "${arg}". Erlaubt: --only <${BUILD_GROUPS.join('|')}>`)
    only = true
    const names = (value ?? '').split(',').map((name) => name.trim()).filter(Boolean)
    if (names.length === 0) throw new Error(`--only braucht eine Gruppe: ${BUILD_GROUPS.join(', ')}`)
    requested.push(...names)
  }
  if (!only) return { groups: new Set(BUILD_GROUPS) }
  const groups = new Set<BuildGroup>()
  for (const name of requested) {
    if (!(BUILD_GROUPS as readonly string[]).includes(name)) {
      throw new Error(`Unbekannte Gruppe "${name}". Erlaubt: ${BUILD_GROUPS.join(', ')}`)
    }
    groups.add(name as BuildGroup)
  }
  return { groups }
}
