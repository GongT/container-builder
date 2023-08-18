import { Command } from '@commander-js/extra-typings';
import { mainProjectArg } from '../helpers/program/arg.project';
import { OptionOf } from '../helpers/program/arguments';

export function execute(args: OptionOf<typeof command>) {
	console.log(args);
}

export const command = new Command().description('install systemd service').addOption(mainProjectArg).action(execute);
