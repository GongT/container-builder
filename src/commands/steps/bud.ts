import { Command } from '@commander-js/extra-typings';
import { mainProjectArg } from '../../helpers/program/arg.project';

export const command = new Command()
	.description('build a Containerfile')
	.addOption(mainProjectArg)
	.action(execute);

export async function execute() {}
