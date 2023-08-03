import type { FileBuilder } from '@build-script/heft-plugins';
import { writeFileIfChange } from '@idlebox/node';
import ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone';
import { parse } from 'comment-json';
import { readFile } from 'fs/promises';
import { compileFromFile } from 'json-schema-to-typescript';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

// function fileNameToType(name: string) {
// 	name = basename(name, '.schema.json');
// 	name = name.replace(/\./g, '_');
// 	return ucfirst(camelCase(name));
// }

function createLoader(store: string, builder: FileBuilder) {
	return async (uri: string): Promise<any> => {
		// console.error('load schema:', uri);
		if (uri.startsWith('file://')) uri = uri.slice(7);

		const file = resolve(store, uri);
		// console.error('          ->', file);
		builder.watchFiles(file);
		const content = await readFile(file, 'utf-8');
		const json = parse(content, undefined, true) as any;
		json.id = pathToFileURL(file).toString();
		return json;
	};
}

export async function generate(builder: FileBuilder) {
	let r = '';

	const store = resolve(__dirname, 'store');
	const loader = createLoader(store, builder);

	const a = new ajv({
		strict: true,
		strictNumbers: false,
		loadSchema: loader,
		logger: builder.logger,
		schemaId: 'id',
		code: {
			lines: true,
			source: true,
			esm: true,
		},
	});
	a.removeKeyword('id');
	a.addKeyword('id');

	const compiled = await a.compileAsync(await loader('schema.json')).catch((e: Error) => {
		let m = e.message;
		m = m.replace(/file:\/\/(.+)#/, (_m0, file: string) => {
			// console.log('????', _m0);
			file = resolve(store, file.replaceAll('../', '/../../').replaceAll('./', '/../'));
			return `${file}#`;
		});
		builder.logger.warn(m);
		throw new Error('invalid schema');
	});

	let code = `// @ts-nocheck\n"use strict";\n`;
	code += `import type { SchemaObject, ValidateFunction } from 'ajv';\n`;
	code += `export const allSchemas: SchemaObject[] = [];\n`;
	const validator = standaloneCode(a, compiled);
	code += validator
		.replace(/^export /, '')
		.replace(/^const (schema\d+)\s+.+"id"\s*:\s*"file:\/\/\/.+$/gm, (line, vname: string) => {
			return `${line}\nallSchemas.push(${vname});`;
		});
	code += `export const validateFunction = validate as ValidateFunction;`;
	await writeFileIfChange(resolve(__dirname, 'schemaValidator.generated.ts', r), code);

	// const definitions: Record<string, any> = {};
	// for (let [file, schema] of Object.entries(a.schemas)) {
	// 	if (!file.startsWith('file://')) continue;

	// 	schema?.schema
	// 	const base = basename(file);
	// 	const namePrefix = fileNameToType(base);
	// 	content = content.replace(/"\$ref":\s+"([^"]+)"/g, (_m0, url: string) => {
	// 		let r = '';
	// 		if (url.startsWith('#')) {
	// 			r = `#/definitions/${namePrefix}${url.slice(1)}`;
	// 		} else {
	// 			const [file, inside] = url.split('#');
	// 			r = `#/definitions/${fileNameToType(file!)}${inside || ''}`;
	// 		}

	// 		return `"$ref": ${JSON.stringify(r)}`;
	// 	});
	// 	let data;
	// 	try {
	// 		data = parse(content);
	// 	} catch (e: any) {
	// 		console.error('parse fail: %s [%s]', e.message, file);
	// 		throw e;
	// 	}
	// 	definitions[namePrefix] = data;
	// }

	// const mainName = fileNameToType('schema.json');
	// const mainData = definitions[mainName];
	// delete definitions[mainName];
	// mainData.definitions = definitions;

	try {
		r += await compileFromFile(resolve(store, 'schema.json'), {
			additionalProperties: false,
			format: true,
			declareExternallyReferenced: true,
			strictIndexSignatures: true,
			unreachableDefinitions: true,
			cwd: store,
			bannerComment: '',
			ignoreMinAndMaxItems: true,
		});
	} catch (e: any) {
		const { stack, ...ee } = e;
		console.error('compile fail:', ee);
		if (e.footprint) {
			throw new Error(e.footprint);
		} else if (e.source) {
			throw new Error(`${e.message} (${e.source})`);
		}
		throw e;
	}

	r = r.replace(/^export (type|interface)\b/gm, '$1');

	const exportMap: Record<string, string> = {
		BuildConfig: 'IBuildConfig',
		Execute: 'IExecuteConfig',
	};
	const exportI = ['EnvLike', 'CmdLike', 'PrepareDownload', 'BuildStep'];

	for (const { groups } of r.matchAll(/^(?<type>type|interface)\s+(?<name>\S+)\b/gm)) {
		const { name, type } = groups as { name: string; type: string };
		let mapName: string | undefined;

		if (/^(StepKind|PrepareKind|MountKind|NetworkKind)/.test(name)) {
			mapName = name.replace(/^(.+)Kind/, 'IBC$1');
		} else if (/^Container/.test(name)) {
			mapName = 'I' + name;
		} else if (exportMap[name]) {
			mapName = exportMap[name]!;
		} else if (exportI.includes(name)) {
			mapName = 'I' + name;
		}

		if (mapName) {
			if (type === 'type') {
				exportType(name, mapName);
			} else {
				exportInterface(name, mapName);
			}
		}
	}
	r += '\n';

	function exportInterface(name: string, as: string) {
		r += `\nexport interface ${as} extends ${name} {}`;
	}
	function exportType(name: string, as: string) {
		r += `\nexport type ${as} = ${name};`;
	}

	return r;
}
