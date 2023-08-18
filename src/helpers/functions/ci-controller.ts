import { registerGlobalLifecycle, toDisposable } from '@idlebox/common';
import { appendFile } from 'fs/promises';
import { inject, registerAuto } from '../fs/dependency-injection/di';
import { ILogger, IProgramEnvironment } from '../fs/dependency-injection/tokens.generated';

@registerAuto()
export class CiController {
	private readonly appendEnv: { name: string; value: string }[] = [];

	@inject(ILogger)
	protected declare readonly logger: ILogger;
	@inject(IProgramEnvironment).optional()
	protected declare readonly env: IProgramEnvironment;

	async init() {
		if (this.env.IS_CI) {
			registerGlobalLifecycle(this);
		} else {
			this.logger.note('not in CI, skip lifecycles');
		}
	}

	emitError(message: string) {
		if (this.env.IS_CI) {
			console.error(`::error ::${message}`);
		} else {
			this.logger.warn(message);
		}
	}

	export(name: string, value: string) {
		process.env[name] = value;
		this.appendEnv.push({ name, value });
	}

	wrapGroup(title: string): MethodDecorator {
		const self = this;
		return (_target: any, _propertyKey, descriptor: PropertyDescriptor) => {
			const prev: any = descriptor.value;

			descriptor.value = async function (...args: any[]) {
				const group = self.group(title);
				try {
					return await prev.apply(this, args);
				} finally {
					group.dispose();
				}
			};

			return descriptor;
		};
	}

	group(title: string) {
		if (this.env.IS_CI) {
			console.error(`::group::${title}`);
		} else {
			this.logger.info(`[Start Group] ${title}`);
			this.logger.indent(title);
		}
		return toDisposable(() => {
			this.groupEnd(title);
		});
	}

	groupEnd(title: string) {
		if (this.env.IS_CI) {
			console.error(`::endgroup::`);
		} else {
			this.logger.dedent(title);
		}
	}

	async dispose() {
		this.logger.note('saving environments: %s items', this.appendEnv.length);
		if (this.appendEnv.length) {
			let text = '';
			for (const { name, value } of this.appendEnv) {
				text += `${name}<<EOF\n${value}\nEOF\n`;
			}
			await appendFile(process.env.GITHUB_ENV!, text);
		}
	}
}
