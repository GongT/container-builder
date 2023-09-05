import { Option } from '@commander-js/extra-typings';
import { KnownError, disposeGlobal, prettyFormatError, prettyPrintError } from '@idlebox/common';
import { ExitError, runMain } from '@idlebox/node';
import { CommanderError } from 'commander';
import { Console } from 'console';
import { format } from 'util';
import { parseBooleanEnv } from './boolean-env';

const disabledCalls = ['debug', 'log', 'error', 'warn', 'info'] as const;
const __exit = process.exit;

export const isDebug = process.argv.includes('--verbose') || parseBooleanEnv(process.env.BUILD_DEBUG);
export const debugOption = new Option('--verbose', 'show debug output').env('BUILD_DEBUG').argParser(parseBooleanEnv);

KnownError.debug(isDebug);

export function myTrace(txt: string, ...params: any[]) {
	const message = format(txt, ...params);
	const stack = new Error('aaa').stack!.split('\n');
	const stackPretty = prettyFormatError({ message: '', stack: stack.slice(3).join('\n') } as any, true);

	process.stderr.write(`[TRACE] ${message}\n${stackPretty}\n`);
}

export function startLifecycle() {
	process.exit = (code: number) => {
		debugger;
		myTrace('\x1B[38;5;9mCall to process.exit:\x1B[0m');
		return __exit(code);
	};

	const console = global.console;
	const wrappedConsole = new Console(process.stderr, process.stderr);
	for (const item of disabledCalls) {
		const original = wrappedConsole[item];
		wrappedConsole[item] = (msg: string, ...args) => {
			original(msg, ...args);
			if (!msg.startsWith('[')) {
				throw new Error('console.' + item + ' is called anonymously.');
			}
		};
	}
	wrappedConsole.trace = myTrace;
	global.console = wrappedConsole;

	process.on('unhandledRejection', (reason) => {
		console.error(
			'\x1b[38;5;9;7mUnhandledRejection\x1B[0m',
			(reason as any)?.constructor?.name ?? 'UnknownError',
			reason instanceof Error ? prettyFormatError(reason) : reason
		);
		gracefullExit(1);
	});
	process.on('uncaughtException', (error) => {
		if (error instanceof ExitError) {
			console.error('[uncaughtException] %s', error.message);
			gracefullExit(error.code);
		} else {
			prettyPrintError('\x1b[38;5;9;7mUncaughtException\x1B[0m', error);
			gracefullExit(1);
		}
	});
	process.on('beforeExit', () => {
		console.log('[beforeExit] event loop complete.');
		gracefullExit(0);
	});
	process.on('SIGINT', () => {
		finishLifecycle();
		console.error('\n^C');
		gracefullExit(1);
	});
}
export function finishLifecycle() {
	process.exit = __exit;
	global.console = new Console(process.stderr, process.stderr);
}

export function handleCommandError(e: Error): never {
	if (e instanceof CommanderError) {
		// process.stderr.write(`CommanderError: ${e.code}, exit ${e.exitCode}\n`);
		if (e.code === 'commander.help') {
			throw new ExitError('', e.exitCode);
		} else {
			throw new ExitError(e.message, e.exitCode);
		}
	} else {
		// console.trace('Other ' + e.message + '\n');
		throw e;
	}
}

export function runMainWithErrorHandle(main: () => Promise<any>) {
	runMain(main, () => {
		finishLifecycle();
		return disposeGlobal();
	});
}

function gracefullExit(code: number) {
	process.exitCode = code;
	disposeGlobal().finally(() => {
		if (process.exitCode)
			process.stderr.write('quit with code: ' + process.exitCode + '\n', () => {
				process.exit();
			});
	});
}
