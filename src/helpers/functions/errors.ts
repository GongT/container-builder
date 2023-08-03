import { isTTY } from '../program/environments';

export class KnownError extends Error {
	constructor(msg: string) {
		super(isTTY ? `\x1B[38;5;9m${msg}\x1B[0m` : msg);
		this.stack = this.message;
	}
}
