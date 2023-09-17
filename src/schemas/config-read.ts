import { DeepReadonly, KnownError, linux_case_hyphen } from '@idlebox/common';
import { loadJsonFile, writeJsonFile, writeJsonFileBack } from '@idlebox/node-json-edit';
import { ValidateFunction } from 'ajv';
import { fileURLToPath } from 'url';
import { v5 as uuidV5 } from 'uuid';
import { inject, registerAuto } from '../helpers/fs/dependency-injection/di';
import {
	IGlobalAssetsHelper,
	IGpgManager,
	ILogger,
	IProgramEnvironment,
	IProject,
} from '../helpers/fs/dependency-injection/tokens.generated';
import { APPLICATION_UUID } from '../helpers/misc/constants';
import { IBuildConfig, IBuildSecrets, IBuildStep, IContainerMirror } from './schemaType.generated';
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

export interface IStep {
	uuid: string;
	step: DeepReadonly<IBuildStep>;
	index: number;
}

@registerAuto()
export class ConfigReader extends SchemaReader {
	public declare readonly raw: DeepReadonly<IConfigJson>;
	private stepIds = new Map<string, IBuildStep>();

	@inject(IProject)
	private declare readonly proj: IProject;
	@inject(IProgramEnvironment)
	private declare readonly env: IProgramEnvironment;

	get projectName() {
		return linux_case_hyphen(this.raw.publish.name).toLowerCase();
	}

	get steps(): IStep[] {
		const r = [];
		for (const [uuid, step] of this.stepIds.entries()) {
			const index = this.raw.build.steps.indexOf(step);
			r.push({ uuid, step, index });
		}
		return r;
	}

	getStepById(id: string): DeepReadonly<IBuildStep> {
		const step = this.stepIds.get(id);
		if (!step) {
			console.log('[missing step] require "%s", but only theses steps are defined:');
			for (const [uuid, step] of this.stepIds) {
				console.log('[%d] %s - %s', this.raw.build.steps.indexOf(step), uuid, step.title);
			}
			throw new Error(`missing step with id: ${id}`);
		}
		return step;
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

		let ch = false;
		for (let [index, step] of config.build.steps.entries()) {
			if (!step.uuid) {
				ch = true;
				config.build.steps[index] = {
					uuid: uuidV5(JSON.stringify(step), APPLICATION_UUID),
					...step,
				};
				step = config.build.steps[index]!;
			}
			this.stepIds.set(step.uuid!, step);
		}
		if (ch) {
			await writeJsonFileBack(config);
		}

		return { raw: config };
	}
}

interface IRegistryEndpoint extends IContainerMirror {
	path: string;
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

		const cacheLoc = content.cache.split('/', 1)[0]!;

		let found: IContainerMirror | undefined;
		for (const registry of content.registry) {
			for (const mirror of registry.mirrors) {
				if (cacheLoc.startsWith(mirror.location)) {
					found = mirror;
					break;
				}
			}
		}
		if (!found) {
			throw new Error(`missing cache registry in all registries: ${cacheLoc}`);
		}
		const cacheRegistry: IRegistryEndpoint = {
			...found,
			path: cacheLoc.slice(found.location.length + 1),
		};

		return { _json: content, cacheRegistry };
	}

	public get(): DeepReadonly<IBuildSecrets> {
		return this._json;
	}

	public declare readonly cacheRegistry: IRegistryEndpoint;

	async changePassword(newPass: string) {
		this._json.self_password = newPass;
		this.logger.warn('generated new passphrase to json file: ' + this.proj.secretFile);
		await writeJsonFile(this.proj.secretFile, this._json);
	}
}
