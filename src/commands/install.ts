import { Command } from '@commander-js/extra-typings';
import { OptionOf } from '../helpers/program/arguments';

export function execute(args: OptionOf<typeof command>) {
	console.log(args);
}

export const command = new Command().description('install systemd service').action(execute);
