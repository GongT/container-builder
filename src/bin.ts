import { KnownError, setErrorLogRoot } from '@idlebox/common';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveService } from './helpers/fs/dependency-injection/di';
import { ICiController, IProgramArgs } from './helpers/fs/dependency-injection/tokens.generated';
import { handleCommandError, runMainWithErrorHandle, startLifecycle } from './helpers/functions/lifecycle';

async function main() {
	await import('./helpers/fs/dependency-injection/registry.generated');
	if (process.getuid!() !== 0) {
		throw new KnownError('this program must run as root.');
	}
	const ci = await resolveService(ICiController);
	const args = await resolveService(IProgramArgs);
	try {
		await args.executeCommand();
	} catch (e: any) {
		ci.emitError(e.message);
		handleCommandError(e);
	}
	return 0;
}

startLifecycle();
setErrorLogRoot(dirname(fileURLToPath(import.meta.url)));
runMainWithErrorHandle(main);
