import { DeepReadonly } from '@idlebox/common';
import { loadJsonFile, writeJsonFileBack } from '@idlebox/node-json-edit';
import { IBuildConfig } from './schemaType.generated';
import { allSchemas, validateFunction } from './schemaValidator.generated';

const validate = validateFunction;

export interface IConfigJson extends IBuildConfig {
	$schema: string;
}

class ConfigReader {
	public readonly allSchemas = allSchemas;

	constructor(
		public readonly file: string,
		private readonly cfg: IConfigJson
	) {}

	get raw(): DeepReadonly<IConfigJson> {
		return this.cfg;
	}

	get projectName() {
		return this.cfg.publish.name;
	}

	async writeConfig(apply: (config: IConfigJson) => void | Promise<void>) {
		// if (this.config.$schema !== schemaUrl) {
		// 	this.config.$schema = dataUrl;
		//
		// }
		await apply(this.cfg);
		await writeJsonFileBack(this.cfg);
	}
}

export interface IConfigReader extends ConfigReader {}
export async function readConfigFile(file: string): Promise<IConfigReader> {
	console.log(allSchemas);

	const input = await loadJsonFile(file);

	const success = validate(input);
	if (!success) {
		console.log(validate.errors);
		throw new Error('failed validate input file: ' + file);
	}

	return new ConfigReader(file, input as any);
}
