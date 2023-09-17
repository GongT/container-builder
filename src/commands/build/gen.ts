import { Command, Option } from '@commander-js/extra-typings';
import { resolve } from 'path';
import { resolveService } from '../../helpers/fs/dependency-injection/di';
import { IConfigReader, IProgramArgs, IProject } from '../../helpers/fs/dependency-injection/tokens.generated';

const outArg = new Option('-O, --out <folder-path>', 'output file directory').default('', '.github at project root');
export const command = new Command().addOption(outArg).description('generate github ci yml').action(execute);

interface IGenerateArgs {
	out: string;
}

export async function execute() {
	const proj = await resolveService(IProject);
	const config = await resolveService(IConfigReader);
	const args: IProgramArgs<IGenerateArgs> = await resolveService(IProgramArgs);
	let outDir = args.get(outArg);
	if (outDir) {
		outDir = resolve(process.cwd(), outDir);
	} else {
		outDir = resolve(proj.rootDir, '.github/workflows');
	}

	const fname = `generated-build-${config.projectName}.yaml`;
	const fabs = resolve(outDir, fname);

	console.log('[output] %s', fabs);
}
