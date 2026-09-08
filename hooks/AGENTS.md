# Tests beside hooks

Before adding or changing a test, read [Choosing and writing tests](../docs/component-testing.md), especially the [jsdom rules](../docs/component-testing.md#jsdom-rules).

- Use `*.dom.test.ts` or `*.dom.test.tsx`; both run in the jsdom project. Choose `.tsx` only when the test needs JSX.
- Ordinary `hooks/**/*.test.ts` and `hooks/**/*.test.tsx` are not collected. Confirm a focused run finds the intended test when introducing a new file or location.
- Mount the real hook with `renderHook`. Keep React state/effects real and replace only external boundaries such as transport or navigation.
- Assert observable values, callback arguments, request cancellation and cleanup. Use controlled promises for stale-response races and fake timers for debounce; restore timers and await updates.
- Verify actual scrolling, layout, media-query behavior across viewports and browser navigation in Playwright. Do not simulate dimensions to make a geometry assertion pass in jsdom.
- Delete obsolete browser behavior checks when their responsibility moves here.

See [the search lookup test](use-search-lookup.dom.test.tsx) for an example. Run it with `pnpm test:components hooks/use-search-lookup.dom.test.tsx`.
