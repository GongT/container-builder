import { Command } from '@commander-js/extra-typings';

export const command = new Command()
	.description('pull previous cache images from registry')

	.action(execute);

export async function execute() {}
