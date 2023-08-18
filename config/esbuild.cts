/// <reference types='@build-script/heft-esbuild-plugin' />

import type { BuildOptions } from 'esbuild';
import { resolve } from 'path';

const outDir = resolve(session.rootDir, 'lib');
const isDebug = process.env.NODE_ENV === 'development';

export const options: BuildOptions[] = [
	{
		entryPoints: [{ in: './src/bin.ts', out: 'bundle' }],
		platform: 'node',
		outdir: './lib',
		format: 'esm',
		external: isDebug ? ['prettier', 'readline/*'] : ['readline/*'],
		loader: {
			'.conf': 'text',
			'.repo': 'text',
			'.sh': 'text',
		},
		sourceRoot: __dirname,
		minifySyntax: !isDebug,
		keepNames: true,
		banner: {
			js: `
				import { fileURLToPath as topLevelFileURLToPath } from 'url';
				import { createRequire as topLevelCreateRequire } from 'module';
				import { dirname as topLevelDirname } from 'path';
				const require = topLevelCreateRequire(import.meta.url);
				const __filename = topLevelFileURLToPath(import.meta.url);
				const __dirname = topLevelDirname(__filename);
			`.replace(/^\s+/gm, ''),
		},
	},
];
