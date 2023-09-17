import { Command } from '@commander-js/extra-typings';

export const command = new Command()
	.description('build a Containerfile')

	.action(execute);

export async function execute() {}
