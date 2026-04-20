const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');
const isMinify = process.argv.includes('--minify');

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  platform: 'node',
  sourcemap: !isMinify,
  minify: isMinify,
  logLevel: 'info',
};

if (isWatch) {
  esbuild.context(config).then(ctx => ctx.watch());
} else {
  esbuild.build(config).catch(() => process.exit(1));
}
