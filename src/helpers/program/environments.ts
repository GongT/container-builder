import { commandInPathSync, findUpUntil } from '@idlebox/node';
import { config as configEnv } from 'dotenv';
import { resolve } from 'path';
import { random } from '../fs/temp';
import { bail } from '../functions/stdio';

export const isTTY = process.stderr.isTTY;

const TMPDIR = ensureEnv('TMPDIR', '/tmp');
export const TEMP_DIR = resolve(TMPDIR, 'builder' + random());
export const CONTAINERS_DATA_PATH = ensureEnv('CONTAINERS_DATA_PATH', '/data/AppData');
export const SYSTEM_COMMON_CACHE = ensureEnv('SYSTEM_COMMON_CACHE', '/var/cache');
export const SYSTEM_FAST_CACHE = ensureEnv('SYSTEM_FAST_CACHE', SYSTEM_COMMON_CACHE);
export const REGISTRY_AUTH_FILE = ensureEnv('REGISTRY_AUTH_FILE', '/etc/containers/auth.json');
export const FEDORA_VERSION = ensureEnv('FEDORA_VERSION', '38');
export const BUILD_JSON_NAME = 'container.json';
export const INIT_CWD = process.cwd();
export const ANNOID_CACHE_PREV_STAGE = 'me.gongt.cache.prevstage';
export const ANNOID_CACHE_HASH = 'me.gongt.cache.hash';
export const LABELID_RESULT_HASH = 'me.gongt.hash';

process.env.BUILDAH_HISTORY = 'false';
process.env.BUILDAH_ISOLATION = 'oci';

export const IS_CI = process.env.GITHUB_ACTIONS;

function ensureEnv(field: string, defVal: string) {
	if (!process.env[field]) {
		process.env[field] = defVal;
	}
	return process.env[field]!;
}

const cmdMap = new Map<string, string>();
export function requireCommand(cmd: string) {
	if (cmdMap.has(cmd)) return cmdMap.get(cmd)!;

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
	cmdMap.set(cmd, found);
	return found;
}

export const ASSETS_PATH = '/usr/share/scripts/pods';

async function loadEnvironments() {
	const path = await findUpUntil(resolved, '.environment');
	if (path) configEnv({ path });
}

export let GIT_PROJECT_ROOT = '/not/initialize/path';
export async function initGitProject(from: string) {
	const pc = await findUpUntil(from, '.git/config');
	if (!pc) throw new Error(`can't find any .git folder from "${from}" to root.`);
	GIT_PROJECT_ROOT = resolve(pc, '../..');
}
