import { Pool } from './pool'

test('limit', async () => {
  const limit = 5
  const total = 100

  const min = 5
  const max = 50

  let running = 0
  let runmax = 0
  let runmin = 0

  type F = () => Promise<number>
  const tasks: F[] = []
  for (let i = 0; i < total; ++i) {
    tasks.push(async () => {
      runmax = Math.max(++running, runmax)
      const timeout = Math.random() * (max - min) + min
      await new Promise((resolve) => setTimeout(resolve, timeout))
      runmin = Math.min(--running, runmin)
      return timeout
    })
  }

  {
    const results = await Pool.all(tasks, limit)
    expect(results.every((v) => v >= min && v < max))
    expect(runmax === limit)
    expect(runmin >= 0)
  }

  {
    const results = await Pool.all(tasks)
    expect(results.every((v) => v >= min && v < max))
    expect(runmin >= 0)
  }
})
