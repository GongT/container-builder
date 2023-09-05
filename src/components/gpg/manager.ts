import { readFileIfExists, writeFileIfChange } from '@idlebox/node';
import { parse } from 'comment-json';
import { createReadStream, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { Readable, Writable } from 'stream';
import { createInstance, inject, registerAuto } from '../../helpers/fs/dependency-injection/di';
import {
	IExecutable,
	IGitGlobal,
	ILogger,
	IProgramEnvironment,
} from '../../helpers/fs/dependency-injection/tokens.generated';
import { isDebug } from '../../helpers/functions/lifecycle';

@registerAuto()
export class GpgManager {
	@inject(IProgramEnvironment)
	protected declare readonly env: IProgramEnvironment;
	@inject(ILogger)
	protected declare readonly logger: ILogger;
	@inject(IGitGlobal)
	protected declare readonly git: IGitGlobal;

	private declare readonly exe: IExecutable;
	async init() {
		const exe = await createInstance(IExecutable, 'gpg');
		return { exe };
	}

	private async run(args: string[], password: string, input?: string | Buffer | Readable) {
		if (!isDebug) {
			args.push('--quiet');
		}
		args.push('--passphrase-fd', '3');

		const process = this.exe.executeRaw(args, {
			stdio: [undefined, 'pipe', 'inherit', 'pipe'],
			input: input,
		});
		const passwdFd = process.stdio[3] as Writable;
		passwdFd.write(Buffer.from(password, 'utf-8'));
		passwdFd.end();

		const result = await process;
		this.exe.handleRaw(args, result);
		return result;
	}

	async encrypt(file: string, password: string) {
		await this.git.ensureIgnore(file);
		const data = await this.gpgEnc(file, password);
		const encFile = file + '.gpg';
		this.logger.debug('encrypt file: %s', encFile);
		return await writeFileIfChange(encFile, data);
	}

	async decrypt(jsonFile: string, password: string) {
		const encFile = jsonFile + '.gpg';
		const data = await this.gpgDec(encFile, password);
		this.logger.debug('decrypt file: %s', jsonFile);
		return await writeFileIfChange(jsonFile, data);
	}

	private async gpgDec(file: string, password: string) {
		const raw = await readFile(file);
		const result = await this.run(['--batch', '--yes', '--decrypt'], password, raw);
		return result.stdout.toString('utf-8');
	}
	private async gpgEnc(file: string, password: string) {
		const raw = createReadStream(file);
		const result = await this.run(
			['--batch', '--yes', '--pinentry-mode', 'loopback', '--cipher-algo', 'AES256', '--symmetric'],
			password,
			raw
		);
		return result.stdout;
	}

	async load(jsonFile: string) {
		const data = await readFileIfExists(jsonFile, 'utf-8');
		if (data) {
			this.logger.debug('using plain-text secret file: %s', jsonFile);
			return parse(data);
		}

		const encrypted = jsonFile + '.gpg';
		this.logger.debug('using encrypted secret file: %s', encrypted);
		const pass = process.env.SECRET_PASSWORD;
		if (!pass) {
			if (this.env.IS_CI) {
				throw new Error('missing environment: SECRET_PASSWORD');
			} else if (existsSync(encrypted)) {
				throw new Error('secrets file not decrypted: ' + jsonFile);
			} else {
				throw new Error('secrets file is missing: ' + jsonFile);
			}
		}

		const decrypted = await this.gpgDec(encrypted, pass);
		const output = parse(decrypted, undefined, true) as any;
		return output;
	}
}
