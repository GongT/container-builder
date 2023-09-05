import { Command } from '@commander-js/extra-typings';
import { mainProjectArg } from '../../../helpers/program/arg.project';

export const command = new Command()
	.description('push cache result images to registry')
	.addOption(mainProjectArg)
	.action(execute);

export async function execute() {}
