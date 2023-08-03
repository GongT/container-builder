import type { Options } from 'execa';
import { startProgram, startProgramJson } from '../../helpers/functions/exec';
import { IContainerInspect } from './inspect.container.type';
import { IImageInspect } from './inspect.image.type';

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

export const containerToolExecOptions: Options = {
	all: false,
	stderr: 'pipe',
	stdout: 'pipe',
	stdin: 'ignore',
	shell: false,
	stripFinalNewline: true,
	encoding: 'utf-8',
};

export abstract class ContainerTool {
	protected abstract readonly exe: string;

	protected run(args: string[]) {
		return startProgram(this.exe, args, containerToolExecOptions);
	}
	protected runJson(args: string[]) {
		return startProgramJson(this.exe, [...args, '--format=json'], containerToolExecOptions);
	}

	ps() {
		return this.runJson(['ps', '--all']);
	}

	async listImageIds() {
		const result = await this.run(['images', '--all', '--format={{.ID}}']);
		return result.stdout.trim().split('\n');
	}

	private readonly _inspectImageCache = new Map<string, ImageInspectHelper>();
	private readonly _inspectContainerCache = new Map<string, IContainerInspect>();
	async inspect(kind: TargetKind.container, id: string): Promise<IContainerInspect>;
	async inspect(kind: TargetKind.image, id: string): Promise<ImageInspectHelper>;
	async inspect(kind: TargetKind, id: string) {
		const cache = kind === TargetKind.image ? this._inspectImageCache : this._inspectContainerCache;
		if (cache.has(id)) return cache.get(id)!;

		const ret = await this.runJson(['inspect', `--type=${kind}`, id]);
		if (!ret[0]) throw new Error(`missing ${kind} "${id}"`);

		const helper = kind === TargetKind.image ? new ImageInspectHelper(ret[0]) : ret[0];

		cache.set(id, helper);

		return helper;
	}

	async pull(nameOrId: string) {
		return startProgram(this.exe, ['pull', nameOrId], {
			...containerToolExecOptions,
			stdout: 'inherit',
			stderr: 'inherit',
		});
	}
}

export function shortId(id: string) {
	if (id.length === 12) return id;
	if (id.length === 64) return id.slice(0, 12);
	throw new Error(`invalid id length: ${id}`);
}
