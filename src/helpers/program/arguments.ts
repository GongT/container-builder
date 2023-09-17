import { Command, Option } from '@commander-js/extra-typings';
import { KnownError, definePublicConstant } from '@idlebox/common';
import { inject, registerAuto } from '../fs/dependency-injection/di';
import { ILogger } from '../fs/dependency-injection/tokens.generated';
import { debugOption, handleCommandError } from '../functions/lifecycle';
import { mainProjectArg } from './arg.project';
import { applyCommanderCommands } from './commands.generated';

export type OptionOf<Cmd extends Command> = ReturnType<Cmd['opts']>;

@registerAuto()
export class ProgramArgs<OptionType> {
	private readonly argv: readonly string[];
	private readonly program: Command;

	@inject(ILogger)
	private declare readonly logger: ILogger;

	constructor() {
		const program = new Command('pm')
			.addOption(mainProjectArg)
			.addOption(debugOption)
			.description('podman container manager');
		program.exitOverride(handleCommandError);

		program.hook('preAction', (_thisCommand, actionCommand) => {
			const options = actionCommand.optsWithGlobals();
			// if (actionCommand.args.length) {
			// 	actionCommand.outputHelp({ error: true });
			// 	throw new KnownError('unknown arguments: ' + actionCommand.args[0]);
			// }
			definePublicConstant(this, 'options', options);
			this.logger.debug('program arguments:', options);
		});

		program.showHelpAfterError(false);
		program.exitOverride();
		program.combineFlagAndOptionalValue(false);
		// program.enablePositionalOptions();
		program.allowExcessArguments(false);
		program.configureOutput({
			outputError() {},
			writeErr: (str) => this.logger.error(str),
			writeOut: (str) => this.logger.log(str),
		});

		applyCommanderCommands(program);
		this.program = program;
		this.argv = process.argv.slice(2);
	}

	private declare options: OptionType;

	executeCommand() {
		return this.program.parseAsync([...this.argv], { from: 'user' });
	}

	get<T extends Exclude<keyof OptionType, symbol>>(option: Option<`--${T}`>): OptionType[T] | undefined {
		const name = option.name();
		return (this.options as any)[name];
	}
	require<T extends Exclude<keyof OptionType, symbol>>(option: Option<`--${T}`, OptionType[T]>): OptionType[T] {
		const name = option.name();
		const r = (this.options as any)[name];
		if (r === undefined) throw new KnownError('missing argument: ' + name.toString());
		return r;
	}
}
