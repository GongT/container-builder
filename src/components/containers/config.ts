import { registerGlobalLifecycle } from '@idlebox/common';
import { readFileIfExists, writeFileIfChange } from '@idlebox/node';
import { mkdir, rm } from 'fs/promises';
import { dirname, resolve } from 'path';
import { IProgramEnvironment } from '../../helpers/fs/dependency-injection/tokens.generated';
import { inject, registerAuto } from '../../helpers/fs/dependency-injection/di';
import { writeJson } from '../../helpers/fs/helper';
import { IBuildSecrets } from '../../schemas/schemaType.generated';

export type IRegistryConfigs = Exclude<Required<IBuildSecrets>['registry'][number], undefined>;
export type IContainerConfig = Exclude<Required<IBuildSecrets>['registry'][number], undefined>;

const store = '/etc/containers/registries.conf.d';
export async function makeRegistryConfig(name: string, config: IContainerConfig) {
	const file = resolve(store, name + '.conf');
	const data = ['[[registry]]'];
	data.push('prefix = ' + config.prefix);
	// if (config.location) data.push('location = ' + config.location);
	// if (config.insecure) data.push('insecure = true');
	if (config.blocked) data.push('blocked = true');
	data.push('');

	if (config.mirrors) {
		for (const item of config.mirrors) {
			data.push('[[registry.mirror]]');
			data.push('location = ' + item.location);
			if (item.insecure) data.push('insecure = true');
		}
	}
	data.push('\n');

	await writeFileIfChange(file, data.join('\n'));
}

@registerAuto()
export class PodmanRegistry {
	protected declare readonly exe: string;

	@inject(IProgramEnvironment)
	private declare readonly env: IProgramEnvironment;

	async init() {
		const exe = this.env.requireCommand('podman');
		if (this.env.IS_CI) {
			registerGlobalLifecycle(this);
		}
		return { exe };
	}

	async dispose() {
		await rm(this.env.REGISTRY_AUTH_FILE, { force: true });
	}

	async login(registry: string, username: string, password: string) {
		await mkdir(dirname(this.env.REGISTRY_AUTH_FILE), { recursive: true, mode: 0o700 });
		let data: ICredFile = {};
		try {
			data = JSON.parse(await readFileIfExists(this.env.REGISTRY_AUTH_FILE, 'utf-8'));
		} catch {}

		if (!data.auths) data.auths = {};

		data.auths[registry] = { auth: Buffer.from(`${username}:${password}`).toString('base64') };
		await writeJson(this.env.REGISTRY_AUTH_FILE, data);
	}
}

interface ICredFile {
	auths?: {
		[registry: string]: {
			auth: string;
		};
	};
}
