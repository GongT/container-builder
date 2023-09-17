import { Command, Option } from '@commander-js/extra-typings';
import { KnownError } from '@idlebox/common';
import { streamToBuffer } from '@idlebox/node';
import { randomBytes } from 'crypto';
import { createInterface } from 'readline/promises';
import { resolveService } from '../helpers/fs/dependency-injection/di';
import {
	IGpgManager,
	ILogger,
	IProgramArgs,
	IProject,
	ISecretReader,
} from '../helpers/fs/dependency-injection/tokens.generated';

const encryptArg = new Option('-e, --encrypt', 'encrypt file').default(false).conflicts(['decrypt', 'password']);
const decryptArg = new Option('-d, --decrypt', 'decrypt file').default(false).conflicts('encrypt');
encryptArg.mandatory = true;
export const command = new Command()
	.description('secret file process')
	.addOption(encryptArg)
	.addOption(decryptArg)

	.action(execute);

interface ISecretsArgs {
	encrypt: boolean;
	decrypt: boolean;
	password: string;
}

export async function execute() {
	const args: IProgramArgs<ISecretsArgs> = await resolveService(IProgramArgs);
	const encrypt = args.get(encryptArg);
	const decrypt = args.get(decryptArg);

	if (encrypt === decrypt) {
		command.outputHelp();
		throw new KnownError('Bad Input: missing encrypt or decrypt arguments');
	}

	const project = await resolveService(IProject);
	const gpg = await resolveService(IGpgManager);
	const logger = await resolveService(ILogger);

	const file = project.secretFile;
	if (encrypt) {
		const secrets = await resolveService(ISecretReader);

		if (!secrets.get().self_password) {
			await secrets.changePassword(randomBytes(64).toString('hex'));
		}

		const ch = await gpg.encrypt(file, secrets.get().self_password);
		logger.success('encrypt file success%s: %s.gpg', ch ? '' : ' (not change)', file);
	} else {
		let password;
		if (process.env.SECRET_PASSWORD) {
			logger.note('using gpg key from environment');
			password = process.env.SECRET_PASSWORD;
		} else if (process.stdin.isTTY) {
			const rl = createInterface(process.stdin, process.stdout);
			password = await Promise.race([
				rl.question('Password: '),
				new Promise<never>((_, reject) => {
					rl.on('close', () => {
						process.stdout.write('\r\x1B[K');
						reject(new KnownError('missing password: input closed'));
					});
				}),
			]);
		} else {
			password = (await streamToBuffer(process.stdin, false)).trim();
		}
		const ch = await gpg.decrypt(file, password);
		logger.success('decrypt file success%s: %s', ch ? '' : ' (not change)', file);
		await resolveService(ISecretReader);
	}
}
