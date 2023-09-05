import { definePublicConstant } from '@idlebox/common';
import type { Options } from 'execa';
import { createInstance, inject, registerAuto } from '../../helpers/fs/dependency-injection/di';
import { IExecutable, IProgramEnvironment } from '../../helpers/fs/dependency-injection/tokens.generated';
import { IContainerInspect } from './inspect.container.type';
import { IImageInspect } from './inspect.image.type';

export function shortId(id: string) {
	if (id.length === 12) return id;
	if (id.length === 64) return id.slice(0, 12);
	throw new Error(`invalid id length: ${id}`);
}

export enum TargetKind {
	container = 'container',
	image = 'image',
}

abstract class InspectHelper {}

export class ImageInspectHelper extends InspectHelper {
	constructor(public readonly rawData: IImageInspect) {
		super();
		if (Array.isArray(rawData)) {
			throw new Error('inspect result must flatten');
		}
	}

	get id(): string {
		return this.rawData.Id;
	}
	get name(): string {
		return this.rawData.RepoTags[0]!;
	}

	label(name: string): string | undefined {
		return this.rawData.Labels[name];
	}
	annotation(name: string): string | undefined {
		return this.rawData.Annotations[name];
	}
}

export const containerToolExecOptions: Options<string> = {
	all: false,
	stderr: 'pipe',
	stdout: 'pipe',
	stdin: 'ignore',
	shell: false,
	stripFinalNewline: true,
	encoding: 'utf-8',
};

const inspectImageCache = new Map<string, ImageInspectHelper>();
const inspectContainerCache = new Map<string, IContainerInspect>();

@registerAuto()
export class ContainerTool {
	protected declare readonly exe: IExecutable<string>;

	@inject(IProgramEnvironment)
	protected declare readonly env: IProgramEnvironment;

	constructor() {}

	async init(execName: string) {
		const exe = await createInstance(IExecutable, execName, containerToolExecOptions);
		// if (env.IS_CI) {
		// 	registerGlobalLifecycle(this);
		// }
		definePublicConstant(this, 'exe', exe);
	}

	run(args: string[]) {
		return this.exe.executeOutput(args);
	}
	runJson(args: string[]) {
		return this.exe.executeJson([...args, '--format=json']);
	}

	ps() {
		return this.runJson(['ps', '--all']);
	}

	async listImageIds() {
		const result = await this.run(['images', '--all', '--format={{.ID}}']);
		return result.trim().split('\n');
	}

	async inspect(kind: TargetKind.container, id: string): Promise<IContainerInspect>;
	async inspect(kind: TargetKind.image, id: string): Promise<ImageInspectHelper>;
	async inspect(kind: TargetKind, id: string) {
		const cache = kind === TargetKind.image ? inspectImageCache : inspectContainerCache;
		if (cache.has(id)) return cache.get(id)!;

		const ret = await this.runJson(['inspect', `--type=${kind}`, id]);
		if (!ret[0]) throw new Error(`missing ${kind} "${id}"`);

		const helper = kind === TargetKind.image ? new ImageInspectHelper(ret[0]) : ret[0];

		cache.set(id, helper);

		return helper;
	}

	async pull(nameOrId: string) {
		await this.exe.execute(['pull', nameOrId], {
			...containerToolExecOptions,
			stdout: 'inherit',
			stderr: 'inherit',
		});
	}
}
