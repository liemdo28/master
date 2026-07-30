# Asynchronous JavaScript — Promises, async/await, and the Event Loop

## The Event Loop

JavaScript is single-threaded. The event loop is the mechanism that lets it perform non-blocking I/O operations despite having only one thread. The runtime maintains a **call stack**, a **callback queue** (macrotasks), and a **microtask queue**.

When the call stack is empty, the event loop first drains all microtasks (Promise callbacks), then picks one macrotask (setTimeout, I/O callback) from the queue, runs it, then drains microtasks again, and repeats.

Microtasks include: resolved Promise `.then` handlers, `queueMicrotask`, `MutationObserver` callbacks.
Macrotasks include: `setTimeout`, `setInterval`, `setImmediate` (Node.js), I/O events.

```
while (true) {
  run all microtasks until queue is empty
  if (macrotask queue not empty) run ONE macrotask
  render (browser only)
}
```

## Callbacks

The original async pattern in JavaScript is the callback: a function passed as an argument that is called when the operation completes.

```js
fs.readFile('/etc/hosts', 'utf8', (err, data) => {
  if (err) throw err;
  console.log(data);
});
```

Nested callbacks lead to "callback hell" — deeply indented, hard-to-read code that is error-prone.

## Promises

A Promise is an object representing the eventual completion or failure of an asynchronous operation. A Promise is in one of three states: **pending**, **fulfilled**, or **rejected**.

```js
const p = new Promise((resolve, reject) => {
  setTimeout(() => resolve('done'), 1000);
});

p.then((value) => console.log(value))   // 'done'
 .catch((err) => console.error(err));
```

Key methods:
- `Promise.all([...])` — waits for all promises, rejects on first failure
- `Promise.allSettled([...])` — waits for all, never rejects, returns status array
- `Promise.race([...])` — settles with the first promise that settles
- `Promise.any([...])` — fulfils with first success, rejects only if all fail

## async / await

`async`/`await` is syntactic sugar over Promises. An `async` function always returns a Promise. `await` suspends execution of the current async function until the awaited Promise settles.

```js
async function fetchUser(id) {
  try {
    const res  = await fetch(`/api/users/${id}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Failed:', err);
    throw err;
  }
}
```

**Parallel execution with async/await:**

```js
// Sequential — slow, each awaits the previous
const a = await fetchA();
const b = await fetchB();

// Parallel — both start immediately
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

## Error Handling

Unhandled Promise rejections crash Node.js in modern versions. Always use try/catch inside async functions or `.catch()` on Promise chains.

Node.js provides the `unhandledRejection` process event for a last-resort handler:

```js
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at', promise, 'reason:', reason);
  process.exit(1);
});
```

## Streams and Async Iteration

Node.js Readable streams implement the async iterator protocol:

```js
const readable = fs.createReadStream('bigfile.txt');
for await (const chunk of readable) {
  process(chunk);
}
```

This is more memory-efficient than buffering the entire file.

## Common Pitfalls

1. **Floating Promises** — calling an async function without `await` or `.catch()` drops errors silently.
2. **Sequential await in loops** — using `await` inside a `for` loop makes requests sequential. Use `Promise.all(arr.map(async ...))` for parallelism.
3. **try/catch does not catch async errors outside await** — a thrown error inside a `.then()` callback that isn't returned becomes a floating rejection.
4. **Returning vs awaiting in finally** — `return await value` inside a try/catch keeps the function frame alive during finally execution; plain `return value` does not.

## Sources

- MDN Web Docs: Using Promises — CC BY-SA 2.5 (Mozilla Contributors)
- Node.js Documentation: Asynchronous I/O — MIT License
