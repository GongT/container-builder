import { writeFileIfChange } from '@idlebox/node';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { inject, registerAuto } from './dependency-injection/di';
import { IConfigReader, ILogger, IProgramEnvironment } from './dependency-injection/tokens.generated';

@registerAuto()
export class GlobalAssetsHelper {
	@inject(IProgramEnvironment)
	protected declare readonly env: IProgramEnvironment;
	@inject(ILogger)
	protected declare readonly logger: ILogger;

	protected logLevel: 'debug' | 'note' = 'debug';

	protected declare readonly root: string;

	async init() {
		return { root: this.env.ASSETS_PATH };
	}

	resolve(name: string) {
		const result = resolve(this.root, name);
		if (!result.startsWith(this.root)) throw new Error('file out of scope: ' + result);
		return result;
	}

	mkdir(name: string) {
		const path = this.resolve(name);
		return mkdir(path, { recursive: true });
	}

	async writeJson(name: string, data: any) {
		const path = this.resolve(name);
		await this.mkdir(dirname(path));
		const change = await writeFileIfChange(path, JSON.stringify(data, null, 2));
		this.logger[this.logLevel]('write json file %s (%s)', path, change ? 'ok' : 'not change');
		return path;
	}
}

@registerAuto()
export class AssetsHelper extends GlobalAssetsHelper {
	@inject(IConfigReader)
	private declare readonly config: IConfigReader;

	protected override logLevel = 'note' as const;

	override async init() {
		const root = resolve(this.env.ASSETS_PATH, this.config.raw.publish.name);
		return { root };
	}
}
