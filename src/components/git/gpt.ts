import { requireCommand } from '../../helpers/program/environments';

export class Gpg {
	private readonly exe = requireCommand('gpg');
}
