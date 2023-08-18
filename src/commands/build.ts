import { Command, Option } from '@commander-js/extra-typings';
import { resolveService } from '../helpers/fs/dependency-injection/di';
import { IConfigReader } from '../helpers/fs/dependency-injection/tokens.generated';
import { mainProjectArg } from '../helpers/program/arg.project';

const tagOpt = new Option('-t, --tag <tag>', 'override result image tag');
export const command = new Command()
	.description('build an image')
	.addOption(mainProjectArg)
	.addOption(tagOpt)
	.action(execute);

export async function execute() {
	const config = await resolveService(IConfigReader);
	console.log('config file:', config.raw);
}
