import { Command } from '@commander-js/extra-typings';

export const command = new Command()
	.description('prepare secrets and login registry')

	.action(execute);

export async function execute() {}
