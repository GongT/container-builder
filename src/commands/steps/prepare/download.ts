import { Command } from '@commander-js/extra-typings';

export const command = new Command()
	.description('download files required by later steps, and pull base image if needed')

	.action(execute);

export async function execute() {}
