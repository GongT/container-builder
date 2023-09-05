import type { FileBuilder } from '@build-script/heft-plugins';
import { writeFileIfChange } from '@idlebox/node';
import ajv, { ValidateFunction } from 'ajv';
import standaloneCode from 'ajv/dist/standalone';
import { parse } from 'comment-json';
import { readFile } from 'fs/promises';
import { compileFromFile } from 'json-schema-to-typescript';
import { resolve } from 'path';

// function fileNameToType(name: string) {
// 	name = basename(name, '.schema.json');
// 	name = name.replace(/\./g, '_');
// 	return ucfirst(camelCase(name));
// }

function createLoader(path: string, store: Record<string, string>, builder: FileBuilder) {
	return async (uri: string): Promise<any> => {
		// console.error('load schema:', uri);
		if (uri.startsWith('file://')) uri = uri.slice(7);

		const file = resolve(path, uri);
		// console.error('          ->', file);
		builder.watchFiles(file);
		const content = await readFile(file, 'utf-8');
		const json = parse(content, undefined, true) as any;

		try {
			if (json.$combinePropertyNames) {
				const names: Record<string, any> = {};
				for (const item of Object.values(json.definitions) as any) {
					if (!item.properties) continue;
					for (const key of Object.keys(item.properties)) {
						names[key] = {};
					}
				}
				delete json.$combinePropertyNames;
				json.type = 'object';
				json.properties = names;
				json.additionalProperties = false;
			}
		} catch (e: any) {
			console.error('failed combine property:', e.stack);
			throw e;
		}

		json.$id = 'file:///' + uri;
		store[uri] = json;
		return json;
	};
}

export async function generate(builder: FileBuilder) {
	let r = '';

	const store = resolve(__dirname, 'store');
	const registry: Record<string, string> = {};
	const loader = createLoader(store, registry, builder);

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

	function schemaError(e: Error): never {
		let m = e.message;
		m = m.replace(/file:\/\/(.+)#/, (_m0, file: string) => {
			// console.log('????', _m0);
			file = resolve(store, file.replaceAll('../', '/../../').replaceAll('./', '/../'));
			return `${file}#`;
		});
		builder.logger.warn(m);
		throw new Error('invalid schema');
	}

	function addScript(validator: ValidateFunction) {
		let code = '(() => {\n';
		code += standaloneCode(a, validator)
			.replace(/^export default /gm, '// ')
			.replace(/^export /gm, '')
			.replace(
				/^const (schema\d+)\s+.+"\$id"\s*:\s*"file:\/\/\/(.+\.json)".+$/gm,
				(line, vname: string, fname: string) => {
					delete registry[fname];
					return `${line}\nallSchemas.push(${vname});`;
				}
			);
		code += '\nreturn validate;\n';
		code += '})();\n';
		return code;
	}

	const validateBuildConfig = await a.compileAsync(await loader('build-config.schema.json')).catch(schemaError);
	const validateBuildSecrets = await a.compileAsync(await loader('build-secrets.schema.json')).catch(schemaError);

	let code = `// @ts-nocheck\n"use strict";\n`;
	code += `import type { SchemaObject, ValidateFunction } from 'ajv';\n`;
	code += `export const allSchemas: SchemaObject[] = [];\n`;
	code += 'export const validateBuildConfig: ValidateFunction = ';
	code += addScript(validateBuildConfig);
	code += 'export const validateBuildSecrets: ValidateFunction = ';
	code += addScript(validateBuildSecrets);
	for (const [file, json] of Object.entries(registry)) {
		code += `/* EXTRA SCHEMA ${file} */ allSchemas.push(${JSON.stringify(json)});\n`;
	}
	await writeFileIfChange(resolve(__dirname, 'schemaValidator.generated.ts', r), code);

	try {
		r += await compileFromFile(resolve(store, 'build-config.schema.json'), {
			additionalProperties: false,
			format: true,
			declareExternallyReferenced: true,
			strictIndexSignatures: true,
			unreachableDefinitions: true,
			cwd: store,
			bannerComment: '',
			ignoreMinAndMaxItems: true,
		});
		r += await compileFromFile(resolve(store, 'build-secrets.schema.json'), {
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
	const exportI = ['EnvLike', 'CmdLike', 'PrepareDownload', 'BuildStep', 'BuildSecrets'];

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
