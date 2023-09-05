import type { FileBuilder } from '@build-script/heft-plugins';
import { camelCase, lcfirst } from '@idlebox/common';
import { relativePath } from '@idlebox/node';
import { readdir, stat } from 'fs/promises';
import { dirname, resolve } from 'path';

class Generator {
	private readonly dirStack: string[] = [];
	private readonly nameStack: string[] = ['program'];
	private readonly imports: string[] = [];
	private readonly body: string[] = [];

	constructor(
		private readonly ROOT: string,
		private readonly myDir: string
	) {}

	string() {
		return {
			imports: this.imports.join('\n'),
			body: this.body.join('\n'),
		};
	}

	async genDir() {
		const abs = resolve(this.ROOT, ...this.dirStack);
		// console.log('genDir: %s %s (%s)', this.ROOT, this.dirStack, this.nameStack);
		for (const file of await readdir(abs)) {
			// console.log('  -> %s', file);
			const s = await stat(resolve(abs, file));

			if (s.isDirectory()) {
				const rel = this.dirStack.concat([file]).join('/');
				const name = lcfirst(camelCase(rel));
				const vName = `${name}Command`;
				this.imports.push(`const ${vName} = new Command("${file}");`);
				this.addTo(vName, file);

				this.nameStack.unshift(vName);
				this.dirStack.push(file);
				await this.genDir();
				this.nameStack.shift();
				this.dirStack.pop();
			} else {
				await this.genFile(file);
			}
		}
	}

	async genFile(file: string) {
		// console.log('genFile: %s (%s)', file, this.dirStack);
		const base = file.replace(/\.ts$/, '');
		const rel = this.dirStack.concat([base]).join('/');
		const importSpec = this.resolveRel(rel);
		const name = lcfirst(camelCase(rel));
		const vName = `${name}Command`;
		// r += `export { command as ${vName} } from "${importSpec}";\n`;
		this.imports.push(`import { command as ${vName} } from "${importSpec}";`);

		this.addTo(vName, base);
	}

	resolveRel(rel: string) {
		const abs = resolve(this.ROOT, rel);
		return relativePath(this.myDir, abs);
	}

	addTo(sub: string, subName: string) {
		const parent = this.nameStack[0]!;
		let r = '';
		r += `${parent}.addCommand(${sub}.name("${subName}").copyInheritedSettings(${parent}));`;
		this.body.push(r);
	}
}

export async function generate(builder: FileBuilder) {
	const cmdDir = resolve(builder.projectRoot, 'src/commands');
	const outDir = dirname(builder.filePath);
	const g = new Generator(cmdDir, outDir);
	await g.genDir();
	const { body, imports } = g.string();

	const r = `import { Command } from '@commander-js/extra-typings';

${imports}

export function applyCommanderCommands(program: Command) {
${body.replace(/^/gm, '\t')}
}
`;

	return r;
}
