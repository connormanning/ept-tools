export const Pool = { all }

type F<T> = () => Promise<T>
async function all<T>(list: F<T>[], limit = Infinity) {
  const results: Promise<T>[] = []
  const running: Promise<void>[] = []
  for (const f of list) {
    const execution = f()
    results.push(execution)

    const watcher: Promise<void> = execution
      .then(() => {
        running.splice(running.indexOf(watcher), 1)
      })
      .catch(() => {})
    running.push(watcher)

    if (running.length >= limit) await Promise.race(running)
  }
  return Promise.all(results)
}
