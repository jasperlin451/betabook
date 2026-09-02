import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: [
    "eslint",
    "typescript",
    "unicorn",
    "oxc",
    "react",
    "nextjs",
    "jsx-a11y",
    "vitest",
    "import",
    "promise",
    "node",
  ],
  jsPlugins: ["oxlint-tailwindcss"],
  categories: {
    // Automatically enforces correctness, performance, and suspicious bug-prevention rules.
    correctness: "error",
    perf: "error",
    suspicious: "error",
  },
  options: {
    // Run high-performance type-aware linting via oxlint-tsgolint
    typeAware: true,
    // Zero-warning policy: any warning fails the lint check
    denyWarnings: true,
  },
  settings: {
    tailwindcss: {
      entryPoint: "app/globals.css",
      callees: ["clsx"],
    },
  },
  env: {
    builtin: true,
    browser: true,
    node: true,
  },
  ignorePatterns: [
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "worker-configuration.d.ts",
    ".open-next/**",
    ".wrangler/**",
    "climbs_data/**",
    ".claude/**",
    "drizzle/migrations/**",
  ],
  rules: {
    // Enforce strict equality (=== / !==) while permitting standard nullish (== null) comparisons.
    eqeqeq: ["error", "always", { null: "ignore" }],

    // Comprehensive import plugin rule suite:
    // Allow CSS side-effect imports (e.g. globals.css) while forbidding unassigned JS imports.
    "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
    "import/no-cycle": "error",
    "import/no-self-import": "error",
    "import/no-duplicates": "error",
    "import/no-mutable-exports": "error",
    "import/no-named-as-default": "error",
    "import/no-named-as-default-member": "error",
    "import/default": "error",
    "import/named": "error",
    "import/namespace": "error",
    "import/export": "error",
    "import/extensions": "error",
    "import/first": "error",
    "import/no-relative-parent-imports": "error",
    "import/no-dynamic-require": "error",
    "import/no-anonymous-default-export": "error",

    // Ensure tests have assertions while recognizing custom assertion helpers (e.g. expectCycleRejection).
    "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "expect*"] }],

    // Tailwind CSS (oxlint-tailwindcss): allow design tokens defined in @heroui/styles.
    "tailwindcss/no-unknown-classes": ["error", { allowlist: ["link", "popover"] }],

    // --- Rules intentionally disabled globally ---

    // React 17+ / Next.js uses the automatic JSX runtime (jsx-runtime); requiring React import is obsolete.
    "react/react-in-jsx-scope": "off",

    // Oxlint's experimental effect-deps variant; standard react/exhaustive-deps is active and enforced.
    "react/exhaustive-effect-dependencies": "off",

    // HeroUI and React Aria hooks (useDisclosure) return un-bound function records ({ onOpen, onClose }).
    "typescript/unbound-method": "off",

    // Cloudflare D1 SQL query rows and DOM event targets require explicit type assertions (as T).
    "typescript/no-unsafe-type-assertion": "off",

    // React useEffect hooks return undefined on early exits and cleanup functions on active runs.
    "typescript/consistent-return": "off",

    // Custom composite accessible widgets (e.g. <div role="progressbar">) cannot be native elements due to styling limits.
    "jsx-a11y/prefer-tag-over-role": "off",

    // Composite interactive containers (comboboxes, radiogroups) manage roving tabindex and keys across children.
    "jsx-a11y/no-noninteractive-element-to-interactive-role": "off",
    "jsx-a11y/click-events-have-key-events": "off",
    "jsx-a11y/interactive-supports-focus": "off",

    // Tests narrowing TypeScript discriminated unions (if (res.kind === "ok") expect(...)) need conditional asserts.
    "vitest/no-conditional-expect": "off",

    // Sequential D1 database seed operations and migrations must execute in strict order, not concurrently.
    "eslint/no-await-in-loop": "off",

    // Variable shadowing is safe and standard in small arrow callbacks (e.g. items.find(item => item.id === id)).
    "eslint/no-shadow": "off",

    // .sort() on freshly mapped/cloned arrays ([...items].sort()) is idiomatic, safe, and avoids extra allocations.
    "unicorn/no-array-sort": "off",

    // Allow keeping small helper functions encapsulated inside local component/test scopes.
    "unicorn/consistent-function-scoping": "off",

    // Immutable object spreading in .map() transformations is idiomatic and clean.
    "oxc/no-map-spread": "off",
  },
  overrides: [
    {
      files: ["components/**"],
      rules: {
        "typescript/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "@/db/client",
                  "@/db/queries",
                  "@/db/queries/**",
                  "@/db/schema",
                  "@/db/schema/**",
                ],
                allowTypeImports: true,
                message:
                  "Components must not access database clients, queries, or schemas directly at runtime. Use Server Actions (@/actions) or page loaders.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["components/ui/**"],
      rules: {
        "typescript/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "@/db/client",
                  "@/db/queries",
                  "@/db/queries/**",
                  "@/db/schema",
                  "@/db/schema/**",
                ],
                allowTypeImports: true,
                message:
                  "Components must not access database clients, queries, or schemas directly at runtime. Use Server Actions (@/actions) or page loaders.",
              },
              {
                group: [
                  "@/components",
                  "@/components/**",
                  "!@/components/ui",
                  "!@/components/ui/**",
                ],
                message: "UI components must not import from other components.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["lib/**"],
      rules: {
        "typescript/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@/components/**", "@/app/**", "@/actions/**"],
                message:
                  "Pure domain logic and utilities in lib/ must not depend on UI components, routes, or Server Actions.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["actions/**"],
      rules: {
        "typescript/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@/components/**", "@/app/**"],
                message: "Server Actions must not depend on UI components or application routes.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["db/**"],
      rules: {
        "typescript/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@/components/**", "@/app/**", "@/actions/**"],
                message:
                  "Database queries and schemas must not depend on UI components, routes, or Server Actions.",
              },
            ],
          },
        ],
      },
    },
  ],
});
