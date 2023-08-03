import { resolve } from 'path';
import { ASSETS_PATH } from '../program/environments';

export class AssetsHelper {
	constructor(private readonly projectName: string) {}

	resolveGlobal(name: string) {
		return resolve(ASSETS_PATH, name);
	}

	resolveCurrent(name: string) {
		return resolve(ASSETS_PATH, this.projectName, name);
	}
}
