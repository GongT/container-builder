import { Command } from '@commander-js/extra-typings';
import { mainProjectArg } from '../../../helpers/program/arg.project';

export const command = new Command()
	.description('prepare secrets and login registry')
	.addOption(mainProjectArg)
	.action(execute);

export async function execute() {}
