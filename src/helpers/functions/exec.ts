import { execa, Options } from 'execa';

export class ExecuteError extends Error {
	constructor(
		message: string,
		readonly command: string,
		readonly code: number = -1,
		readonly stderr: string = ''
	) {
		super(`${message} (execute ${command})`);
	}
}

function fmt(cmd: string, args: string[]) {
	return [cmd, ...args].map((e) => JSON.stringify(e)).join(' ');
}

export async function startProgram(cmd: string, args: string[], opt: Options) {
	let p;

	console.error('\x1B[2m + \x1B[0m')
	p = await execa(cmd, args, { ...opt, reject: false });

	if (p.signal) {
		throw new ExecuteError('program killed by signal ' + p.signal, fmt(cmd, args), p.exitCode, p.stderr);
	}
	if (p.exitCode !== 0) {
		throw new ExecuteError('program exit with code ' + p.exitCode, fmt(cmd, args), p.exitCode, p.stderr);
	}
	if (p.failed) {
		throw new ExecuteError('can not execute', fmt(cmd, args), p.exitCode, p.stderr);
	}
	return p;
}

export async function startProgramJson(cmd: string, args: string[], opt: Options) {
	const r = await startProgram(cmd, args, opt);
	try {
		return JSON.parse(r.stdout);
	} catch {
		throw new ExecuteError('invalid json output', fmt(cmd, args), r.exitCode, r.stdout);
	}
}
