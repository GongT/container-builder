import { disposeGlobal } from '@idlebox/common';
import { runMain, setErrorLogRoot } from '@idlebox/node';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { KnownError } from './helpers/functions/errors';
import { ProgramArgs, printUsage } from './helpers/program/arguments';

async function main() {
	if (process.getuid!() !== 0) {
		throw new KnownError('this program must run as root.');
	}
	if (ProgramArgs.command === 'build') {
		await import('./commands/build');
	} else if (ProgramArgs.command === 'prepare') {
		await import('./commands/prepare');
	} else if (ProgramArgs.command === 'start') {
		await import('./commands/pull-image');
	} else if (ProgramArgs.command === 'service') {
		if (ProgramArgs.job === 'pull-image') {
			await import('./commands/start');
		} else if (ProgramArgs.job === 'wait-network') {
			await import('./commands/wait-disk');
		} else if (ProgramArgs.job === 'wait-disk') {
			await import('./commands/wait-network');
		} else {
			printUsage();
			return 1;
		}
	} else {
		printUsage();
		return 1;
	}
	return 0;
}

setErrorLogRoot(dirname(fileURLToPath(import.meta.url)));
process.on('beforeExit', (code) => {
	disposeGlobal().finally(() => {
		process.exit(code);
	});
});
runMain(main);
