import { KnownError } from '../functions/errors';

const defaultConfig = {
	project: '.',
} as const;

type ArgType = typeof defaultConfig;

class ProgramArgsClass {
	private readonly config: ArgType;
	private readonly argv: string[] = [];

	constructor() {
		const config = { ...defaultConfig } as any;
		const argv = [...process.argv.slice(2)];
		while (argv.length > 0) {
			const item = argv.shift()!;
			if (item.startsWith('--')) {
				let name, value;
				if (item.includes('=')) {
					[name, value] = item.slice(2).split('=', 2) as [string, string];
				} else {
					name = item.slice(2);
					value = argv.shift();
				}

				if (!Object.hasOwn(config, name)) throw new KnownError('unknown argument: ' + item);

				if (typeof config[name] === 'boolean') {
					if (!value || value === 'true') {
						value = true;
					} else {
						value = false;
					}
				} else {
					if (!value || value.startsWith('--')) {
						throw new KnownError('argument require value: ' + name);
					}
				}

				Object.assign(config, { [name]: value });
			} else {
				this.argv.push(item);
				break;
			}
		}

		this.config = config;
	}

	private _cmd?: string;
	get command() {
		if (typeof this._cmd === 'undefined') {
			if (!this.argv[0]) {
				printUsage();
				throw new KnownError('missing main command');
			}
			this._cmd = this.argv.shift()!;
		}
		return this._cmd;
	}

	private _job?: string;
	get job() {
		if (typeof this._cmd === 'undefined') throw new Error('????');
		if (typeof this._job === 'undefined') {
			if (!this.argv[0]) {
				printUsage();
				throw new KnownError('missing job to do');
			}
			this._job = this.argv.shift()!;
		}
		return this._job;
	}

	get<T extends keyof ArgType>(name: T): ArgType[T] {
		return this.config[name];
	}
}

export const ProgramArgs = new ProgramArgsClass();

export function printUsage() {
	console.error(`
pm: build & run containers by podman + buildah

	Usage: pm COMMAND [OPTIONS]

Common options:
	* --project=[path]	path to container.json (defaults to .)

Available commands:
	* build [path] [--options...]		build image
	* install [path]		build service
	* start <path-or-name>		debug start container

Internal commands:
	* prepare		prepare execute in PreExecStart
	* service		service commands
	  * pull-image		pull all image to local
	  * wait-network		wait network (especially for dns) ready
	  * wait-disk		wait disk (fstab) ready
`);
}
