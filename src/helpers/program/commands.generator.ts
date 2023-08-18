import type { FileBuilder } from '@build-script/heft-plugins';
import { camelCase, lcfirst, relativePath, ucfirst } from '@idlebox/common';
import { readdir, stat } from 'fs/promises';
import { basename, dirname, resolve } from 'path';

export async function generate(builder: FileBuilder) {
	const target = resolve(builder.projectRoot, 'src/commands');
	const dir = dirname(builder.filePath);

	const commands = [];
	const subCommands = [];

	let r = `import { Command } from '@commander-js/extra-typings';
`;
	for (const file of await readdir(target)) {
		const path = resolve(target, file);
		const s = await stat(path);

		const prefix = lcfirst(camelCase(basename(file, '.ts')));
		commands.push(`${prefix}Command`);
		if (s.isDirectory()) {
			let sub = `export const ${prefix}Command = new Command("${basename(file, '.ts')}")\n`;
			for (const file of await readdir(path)) {
				const p = resolve(path, file);
				const pfx = prefix + ucfirst(camelCase(basename(file, '.ts')));

				const importSpec = relativePath(dir, p).replace(/\.ts$/, '');
				r += `import { command as ${pfx}Command } from "${importSpec}";\n`;
				r += `${pfx}Command.name("${basename(file, '.ts')}");\n`;
				r += `export { command as ${pfx}Command } from "${importSpec}";\n`;
				sub += `\t.addCommand(${pfx}Command)\n`;
				subCommands.push(`${pfx}Command`);
			}
			r += sub.trim() + ';\n';
		} else {
			const importSpec = relativePath(dir, path).replace(/\.ts$/, '');
			r += `export { command as ${prefix}Command } from "${importSpec}";\n`;
			r += `import { command as ${prefix}Command } from "${importSpec}";\n`;
			r += `${prefix}Command.name("${basename(file, '.ts')}");\n`;
		}
	}

	r += '\n';

	r += `export function applyCommanderCommands(program: Command) {\n`;
	for (const cmd of [...commands, ...subCommands]) {
		r += `\t${cmd}.copyInheritedSettings(program);\n`;
	}
	for (const cmd of commands) {
		r += `\tprogram.addCommand(${cmd});\n`;
	}
	r += `\treturn program;\n`;
	r += `}\n`;

	return r;
}
