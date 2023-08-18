import { definePublicConstant } from '@idlebox/common';
import { commandInPathSync, exists, findUpUntil, osTempDir } from '@idlebox/node';
import { config as configEnv } from 'dotenv';
import { resolve } from 'path';
import { inject, registerAuto } from '../fs/dependency-injection/di';
import { ICiController, ILogger, ITmpFile } from '../fs/dependency-injection/tokens.generated';
import { random } from '../fs/random';
import { bail } from '../functions/logger';

@registerAuto()
export class ProgramEnvironment {
	public readonly isTTY = process.stderr.isTTY;
	public readonly IS_CI = process.env.GITHUB_ACTIONS;
	public readonly BUILD_JSON_NAME: string = 'container.json';
	public readonly ANNOID_CACHE_PREV_STAGE = 'me.gongt.cache.prevstage';
	public readonly ANNOID_CACHE_HASH = 'me.gongt.cache.hash';
	public readonly LABELID_RESULT_HASH = 'me.gongt.hash';
	public readonly INIT_CWD: string = process.cwd();

	public declare readonly TMPDIR: string;
	public declare readonly HOME: string;
	public declare readonly SYSTEM_COMMON_CACHE: string;
	public declare readonly SYSTEM_FAST_CACHE: string;
	public declare readonly CONTAINERS_DATA_PATH: string;
	public declare readonly REGISTRY_AUTH_FILE: string;
	public declare readonly FEDORA_VERSION: string;

	@inject(ILogger)
	protected declare readonly logger: ILogger;
	@inject(ICiController)
	protected declare readonly ci: ICiController;
	@inject(ITmpFile).optional()
	protected declare readonly tmpf: ITmpFile;

	async init() {
		process.env.BUILDAH_HISTORY = 'false';
		process.env.BUILDAH_ISOLATION = 'oci';

		this.ensureEnv('FEDORA_VERSION', () => '38');

		this.ensureEnv('CONTAINERS_DATA_PATH', () => '/data/AppData');
		this.ensureEnv(
			'SYSTEM_COMMON_CACHE',
			() => '/var/cache',
			() => resolve(this.reqEnvOnCI('HOME'), 'cache')
		);
		this.ensureEnv(
			'TMPDIR',
			() => osTempDir('builder' + random()),
			() => this.reqEnvOnCI('RUNNER_TEMP')
		);
		this.ensureEnv(
			'SYSTEM_FAST_CACHE',
			() => this.SYSTEM_COMMON_CACHE,
			() => this.SYSTEM_COMMON_CACHE
		);
		this.ensureEnv(
			'REGISTRY_AUTH_FILE',
			() => resolve(this.TMPDIR, 'auth.json'),
			() => resolve(this.reqEnvOnCI('secrets'), `auth${random(2)}.json`)
		);

		const HOME = resolve(this.TMPDIR, 'HOME');
		process.env.HOME = HOME;

		delete process.env.XDG_RUNTIME_DIR;

		return { HOME };
	}

	private reqEnvOnCI(name: string) {
		if (typeof process.env[name] === 'string') return process.env[name]!;
		throw new Error(`missing required CI environment: ${name}`);
	}

	private ensureEnv(_field: keyof this, onDef: () => string, onCI?: () => string) {
		const field = _field.toString();
		if (this.IS_CI && onCI !== undefined) {
			const d = onCI();
			if (process.env[field] !== d) this.ci.export(field, d);
		}
		if (!process.env[field]) {
			const def = onDef();
			this.ci.export(field, def);
		}
		const value = process.env[field];

		this.logger.debug(`$env:${field} = ${process.env[field]}`);
		definePublicConstant(this, field, value);
	}

	private readonly cmdMap = new Map<string, string>();
	public requireCommand(cmd: string) {
		if (this.cmdMap.has(cmd)) return this.cmdMap.get(cmd)!;

		let found;
		if (process.env['COMMAND_PATH_' + cmd.toUpperCase()]) {
			found = process.env['COMMAND_PATH_' + cmd.toUpperCase()]!;
		} else {
			const p = commandInPathSync(cmd);
			if (!p) {
				bail('Command not found: ' + cmd);
			}
			found = p;
		}
		this.cmdMap.set(cmd, found);
		return found;
	}

	public readonly ASSETS_PATH = '/usr/share/scripts/pods';

	private _GIT_PROJECT_ROOT = '/not/initialize/path';
	public get GIT_PROJECT_ROOT() {
		return this._GIT_PROJECT_ROOT;
	}
	private _PROJECT_ROOT = '/not/initialize/path';
	public get PROJECT_ROOT() {
		return this._PROJECT_ROOT;
	}
	public async initProject(root: string) {
		this._PROJECT_ROOT = root;
		const pc = await findUpUntil(root, '.git/config');
		if (!pc) throw new Error(`can't find any .git folder from "${root}" to root.`);
		this._GIT_PROJECT_ROOT = resolve(pc, '../..');

		this.logger.debug(
			'setting project:\n  cwd=%s\n  project=%s\n  root=%s',
			this.INIT_CWD,
			this._PROJECT_ROOT,
			this._GIT_PROJECT_ROOT
		);

		const path = resolve(this._GIT_PROJECT_ROOT, '.environment');
		if (await exists(path)) {
			this.logger.debug('loading variables from ' + path);
			configEnv({ path });
		} else {
			this.logger.note('no variables file: ' + path);
		}
	}
}
