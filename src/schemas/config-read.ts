import { DeepReadonly, KnownError, linux_case_hyphen } from '@idlebox/common';
import { loadJsonFile, writeJsonFile, writeJsonFileBack } from '@idlebox/node-json-edit';
import { ValidateFunction } from 'ajv';
import { fileURLToPath } from 'url';
import { inject, registerAuto } from '../helpers/fs/dependency-injection/di';
import {
	IGlobalAssetsHelper,
	IGpgManager,
	ILogger,
	IProgramEnvironment,
	IProject,
} from '../helpers/fs/dependency-injection/tokens.generated';
import { IBuildConfig, IBuildSecrets } from './schemaType.generated';
import { allSchemas, validateBuildConfig, validateBuildSecrets } from './schemaValidator.generated';

export interface IConfigJson extends IBuildConfig {
	$schema: string;
}

abstract class SchemaReader {
	@inject(IGlobalAssetsHelper)
	protected declare readonly assets: IGlobalAssetsHelper;
	@inject(ILogger)
	protected declare readonly logger: ILogger;

	private static configEmitted?: Readonly<Record<string, string>>;
	protected async emitConfigSchemas() {
		if (!SchemaReader.configEmitted) {
			const map: Record<string, string> = {};
			for (const { $id, ...item } of allSchemas) {
				const name = fileURLToPath($id!);
				map[name] = await this.assets.writeJson('config/' + name, item);
			}
			SchemaReader.configEmitted = map;
		}
		return SchemaReader.configEmitted;
	}

	protected async requireSchema(fname: string) {
		const schemaFiles = await this.emitConfigSchemas();
		if (!schemaFiles['/' + fname]) this.logger.die('missing schema file: /' + fname);
		return schemaFiles['/' + fname];
	}

	protected async ensureSchema(json: any, fname: string) {
		const want = await this.requireSchema(fname);
		if (json.$schema === want) {
			return true;
		} else {
			json.$schema = want;
			return false;
		}
	}

	protected verifyJson(schema: ValidateFunction, json: any, file: string) {
		const success = schema(json);
		if (!success) {
			for (const error of schema.errors ?? []) {
				this.logger.warn(`[validator].%s: %s: %s`, error.instancePath, error.message, error.params);
			}
			delete schema.errors;
			throw new KnownError(`failed validate input file: "${file}"`);
		}
	}
}

@registerAuto()
export class ConfigReader extends SchemaReader {
	public declare readonly raw: DeepReadonly<IConfigJson>;

	@inject(IProject)
	private declare readonly proj: IProject;
	@inject(IProgramEnvironment)
	private declare readonly env: IProgramEnvironment;

	get projectName() {
		return linux_case_hyphen(this.raw.publish.name).toLowerCase();
	}

	async init() {
		const config: IBuildConfig = await loadJsonFile(this.proj.configFile);

		if (!this.env.IS_CI) {
			if (!(await this.ensureSchema(config, 'build-config.schema.json'))) {
				const ch = await writeJsonFileBack(config);
				if (ch) {
					this.logger.warn('modify $schema in %s', this.proj.configFile);
				}
			}
		}

		this.verifyJson(validateBuildConfig, config, this.proj.configFile);

		return { raw: config };
	}
}

@registerAuto()
export class SecretReader extends SchemaReader {
	private declare readonly _json: IBuildSecrets;

	@inject(IProject)
	private declare readonly proj: IProject;
	@inject(IProgramEnvironment)
	private declare readonly env: IProgramEnvironment;
	@inject(IGpgManager)
	private declare readonly gpg: IGpgManager;

	async init() {
		const content: IBuildSecrets = await this.gpg.load(this.proj.secretFile);

		if (!this.env.IS_CI) {
			if (!(await this.ensureSchema(content, 'build-secrets.schema.json'))) {
				const ch = await writeJsonFile(this.proj.secretFile, content);
				if (ch) {
					this.logger.warn('modify $schema in %s', this.proj.secretFile);
				}
			}
		}

		this.verifyJson(validateBuildSecrets, content, this.proj.secretFile);
		return { _json: content };
	}

	public get(): DeepReadonly<IBuildSecrets> {
		return this._json;
	}

	async changePassword(newPass: string) {
		this._json.self_password = newPass;
		this.logger.warn('generated new passphrase to json file: ' + this.proj.secretFile);
		await writeJsonFile(this.proj.secretFile, this._json);
	}
}
