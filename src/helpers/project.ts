import { findUpUntil } from '@idlebox/node';
import { stat } from 'fs/promises';
import { dirname, resolve } from 'path';
import { IConfigReader, readConfigFile } from '../schemas/config-read';
import { AssetsHelper } from './fs/assets';
import { KnownError } from './functions/errors';
import { ProgramArgs } from './program/arguments';
import { INIT_CWD } from './program/environments';

class Project {
	constructor(
		public readonly root: string,
		public readonly config: IConfigReader,
		public readonly assets: AssetsHelper
	) {}
}

export interface IProject extends Project {}
export async function createProject(dir: string = ProgramArgs.job): Promise<IProject> {
	const inPath = resolve(INIT_CWD, dir);
	let resolved: string;
	try {
		let s = await stat(inPath);
		if (s.isFile()) {
			resolved = inPath;
		} else {
			resolved = resolve(inPath, 'container.json');
			s = await stat(resolved);
			if (!s.isFile()) {
				throw new KnownError('can not read config file at: ' + resolved);
			}
		}
	} catch (e: any) {
		if (e.code !== 'ENOENT') throw e;
		throw new KnownError('missing config file at: ' + inPath);
	}
	if (!resolved) {
		const r = await findUpUntil(inPath, 'container.json');
		if (!r) throw new Error('container.json not found');
		resolved = r;
	}

	await initGitProject(resolved)

	const config = await readConfigFile(resolved);
	const assets = new AssetsHelper(config.projectName);

	const self = new Project(dirname(resolved), config, assets);

	return self;
}
