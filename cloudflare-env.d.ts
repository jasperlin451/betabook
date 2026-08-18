// Declaration merging with @opennextjs/cloudflare's global `CloudflareEnv`
// interface, so `getCloudflareContext().env` is typed with our own bindings.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- required for declaration merging
  interface CloudflareEnv extends Env {}
}

export {};
