/**
 * The answers for the names that `groups` stands for, each true. The groups are separated by a space:
 * `head:a,b` stands for `heada` and `headb`, an empty tail for `head` itself, and a name with no colon
 * for itself. The tails follow the last colon, so a name that holds one is written with a second:
 * `xlink::href,role` stands for `xlink:href` and `xlink:role`.
 */
export function expandNames(groups: string): Map<string, boolean> {
  const answers = new Map<string, boolean>()
  for (const group of groups.split(' ')) {
    const split = group.lastIndexOf(':')
    if (split < 0) answers.set(group, true)
    else {
      const head = group.slice(0, split)
      for (const tail of group.slice(split + 1).split(',')) answers.set(head + tail, true)
    }
  }
  return answers
}

/**
 * A predicate that is true for the names `groups` stands for (`expandNames`) and for a name that
 * `prefixed` matches, and false for any other. The groups are expanded at its first call, not when its
 * module is loaded. A name it answers false for is kept with the others, so that it is looked up once
 * the next time; a name that `prefixed` matches is not kept, because those are the names an app makes
 * at run time (`data-row-${id}`), and keeping them would grow the map with every one. The names that
 * are kept come from the code of the components, a set that does not grow while the app runs.
 */
export function createPropFilter(groups: string, prefixed: RegExp): (prop: string) => boolean {
  let answers: Map<string, boolean> | undefined
  return (prop) => {
    answers ??= expandNames(groups)
    const known = answers.get(prop)
    if (known !== undefined) return known
    if (prefixed.test(prop)) return true
    answers.set(prop, false)
    return false
  }
}
