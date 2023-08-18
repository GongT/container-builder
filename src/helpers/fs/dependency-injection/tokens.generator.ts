import type { FileBuilder } from '@build-script/heft-plugins';
import { relativePath } from '@idlebox/common';
import { writeFileIfChange } from '@idlebox/node';
import { readFile, stat } from 'fs/promises';
import { resolve } from 'path';
import * as ts from 'typescript';

interface CacheData {
	mtime: number;
	content?: Content;
}
interface Content {
	declaration: string;
	file: string;
}

const cName = Symbol.for('_build_generator_collect_cache');
let cache: Map<string, CacheData>;
if (Object.hasOwn(globalThis, cName)) {
	cache = (globalThis as any)[cName];
} else {
	cache = new Map();
	(globalThis as any)[cName] = cache;
}

export async function generate(builder: FileBuilder) {
	const rootDir = resolve(builder.projectRoot, 'src');
	const host: ts.ParseConfigFileHost = {
		fileExists: ts.sys.fileExists,
		getCurrentDirectory: ts.sys.getCurrentDirectory,
		readDirectory: ts.sys.readDirectory,
		readFile: ts.sys.readFile,
		onUnRecoverableConfigFileDiagnostic(diagnostic: ts.Diagnostic) {
			const r = ts.formatDiagnostics([diagnostic], {
				getCanonicalFileName: (e) => e,
				getCurrentDirectory: ts.sys.getCurrentDirectory,
				getNewLine: () => ts.sys.newLine,
			});
			throw new Error(r);
		},
		useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
	};
	const cmdline = ts.getParsedCommandLineOfConfigFile(resolve(rootDir, 'tsconfig.typecheck.json'), undefined, host);
	if (!cmdline) throw new Error('failed read tsconfig file');

	builder.append(`import {createToken} from "./di";
	// console.log('================= start loading');
	
	`);

	const imports: string[] = [];
	for (const file of cmdline.fileNames) {
		const s = await stat(file);
		const c = cache.get(file);
		let content: Content | undefined;
		if (c?.mtime === s.mtimeMs) {
			content = c.content;
		} else {
			content = await parseOne(file);
			cache.set(file, {
				mtime: s.mtimeMs,
				content,
			});
		}
		if (content) {
			builder.append(content.declaration);
			imports.push(content.file);
		}
	}

	const importFile = resolve(__dirname, 'registry.generated.ts');
	let imp = '/// register imports\n';
	for (const spec of imports) {
		imp += `import ${spec};\n`;
	}
	await writeFileIfChange(importFile, imp);
}

interface IClassInfo {
	name: string;
	template: {
		passing: string;
		declaration: string;
		any: string;
	};
}

async function parseOne(file: string) {
	let classes: IClassInfo[] = [];
	const code = await readFile(file, 'utf-8');
	const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.ESNext);
	sourceFile.forEachChild((node) => {
		if (!ts.isClassDeclaration(node)) return;
		if (!node.name?.text) return;

		const r = ts.getDecorators(node);
		if (!r || r.length === 0) return;

		let decorator: undefined | ts.Decorator;
		for (const dec of r) {
			if (!ts.isCallExpression(dec.expression)) continue;
			if (!ts.isIdentifier(dec.expression.expression)) continue;
			if (dec.expression.expression.text !== 'registerAuto') continue;
			decorator = dec;
			break;
		}
		if (!decorator) return;

		const info: IClassInfo = {
			name: node.name.text,
			template: {
				passing: '',
				declaration: '',
				any: '',
			},
		};

		const templates = ts.getEffectiveTypeParameterDeclarations(node);
		if (templates.length) {
			const passIn = templates.map((tpl) => ts.idText(tpl.name)).join(', ');
			const args = templates.map((tpl) => tpl.getText(sourceFile)).join(', ');
			const any = templates.map(() => 'any').join(', ');

			info.template = {
				passing: `<${passIn}>`,
				declaration: `<${args}>`,
				any: `<${any}>`,
			};
		}

		classes.push(info);

		return;
	});
	if (!classes.length) return;

	let r = `/// file: ${file}`;
	const spec = JSON.stringify(relativePath(__dirname, file).replace(/\.ts$/, ''));
	for (const { name: className, template } of classes) {
		const ifName = 'I' + className;

		r += `\nimport type {${className}} from ${spec};
export interface ${ifName}${template.declaration} extends ${className}${template.passing} {};
export const ${ifName} = createToken<${ifName}${template.any}>('${ifName}');`;
	}
	return {
		declaration: r,
		file: spec,
	};
}
