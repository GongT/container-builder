import { DeepReadonly, KnownError } from '@idlebox/common';
import { loadJsonFile, writeJsonFile, writeJsonFileBack } from '@idlebox/node-json-edit';
import { ValidateFunction } from 'ajv';
import { randomBytes } from 'crypto';
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
		return this.raw.publish.name;
	}

	async init() {
		const config: IBuildConfig = await loadJsonFile(this.proj.configFile);

		if (!this.env.IS_CI) {
			if (!(await this.ensureSchema(config, 'build-config.schema.json'))) {
				const ch = await writeJsonFileBack(config);
				this.logger.note('write json file %s (%s)', this.proj.configFile, ch ? 'ok' : 'not change');
			}
		}

		this.verifyJson(validateBuildConfig, config, this.proj.configFile);

		return { raw: config };
	}
}

@registerAuto()
export class SecretReader extends SchemaReader {
	private secretsContent?: IBuildSecrets;

	@inject(IProject)
	private declare readonly proj: IProject;
	@inject(IProgramEnvironment)
	private declare readonly env: IProgramEnvironment;
	@inject(IGpgManager)
	private declare readonly gpg: IGpgManager;

	async loadSecret(): Promise<DeepReadonly<IBuildSecrets>> {
		if (this.secretsContent) return this.secretsContent;
		const secrets: IBuildSecrets = await this.gpg.load(this.proj.secretFile);

		if (!this.env.IS_CI) {
			if (!(await this.ensureSchema(secrets, 'build-secrets.schema.json'))) {
				const ch = await writeJsonFile(this.proj.secretFile, secrets);
				this.logger.note('write json file %s (%s)', this.proj.secretFile, ch ? 'ok' : 'not change');
			}
		}

		this.verifyJson(validateBuildSecrets, secrets, this.proj.secretFile);
		this.secretsContent = secrets;
		return this.secretsContent;
	}

	async ensurePassword() {
		const secrets = this.secretsContent!;
		if (!secrets.self_password) {
			secrets.self_password = randomBytes(64).toString('hex');
			this.logger.warn('generated new passphrase to json file: ' + this.proj.secretFile);
			await writeJsonFile(this.proj.secretFile, secrets);
		}
	}
}
