module.exports = {
  forbidden: [
    {
      name: 'K1-kernel-purity',
      from: { path: '^packages/kernel' },
      to: { path: '^packages/(cognition|builder|protocol|server)|^(ai|colyseus|openai|i18next)' },
      severity: 'error',
    },
    {
      name: 'K2-kernel-no-io',
      from: { path: '^packages/kernel' },
      to: { path: '^(node:fs|node:net|node:http|better-sqlite3|drizzle-orm)' },
      severity: 'error',
    },
    {
      name: 'K3-apps-protocol-only',
      from: { path: '^apps/' },
      to: { path: '^packages/(kernel|cognition|builder)' },
      severity: 'error',
    },
    {
      name: 'K4-metamodel-leaf',
      from: { path: '^packages/metamodel' },
      to: { path: '^packages/(?!metamodel)' },
      severity: 'error',
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
  },
};
