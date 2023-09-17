import { Command } from '@commander-js/extra-typings';

export const command = new Command()
	.description('push cache result images to registry')

	.action(execute);

export async function execute() {}
