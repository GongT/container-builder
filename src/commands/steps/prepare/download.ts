import { Command } from '@commander-js/extra-typings';
import { mainProjectArg } from '../../../helpers/program/arg.project';

export const command = new Command()
	.description('download files required by later steps, and pull base image if needed')
	.addOption(mainProjectArg)
	.action(execute);

export async function execute() {}
