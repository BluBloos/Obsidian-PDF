import esbuild from "esbuild";
import process from "process";
import builtins from 'builtin-modules';

const banner =
`/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
If you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = (process.argv[2] === 'production');

esbuild.build({
	banner: { js: banner,},
	entryPoints: ['src/main.ts'],
	bundle: true,
    /* Anything marked as external will not be bundled with the build. The import will be preserved. */
	external: [
		'obsidian',
		'electron',
		...builtins],
	format: 'cjs', /* as pertaining to output javascript */
	target: 'es2016', /* as pertaining to output javascript */
	logLevel: "info",
	sourcemap: prod ? false : 'inline',
	treeShaking: true, /* get ride of unused code ... */
	outfile: 'bin/main.js',
}).catch(() => process.exit(1));