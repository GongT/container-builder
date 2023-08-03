import { ANNOID_CACHE_HASH, requireCommand } from '../../helpers/program/environments';
import { ContainerTool, TargetKind } from './share';

export class Buildah extends ContainerTool {
	protected readonly exe = requireCommand('buildah');

	async findByAnnotation(labels: Record<string, string>) {
		const search = Object.entries(labels).map(([key, value]) => {
			return { name: key, value };
		});
		const ret: string[] = [];
		const ids = await this.listImageIds();
		for (const id of ids) {
			const result = await this.inspect(TargetKind.image, id);

			const found = search.every(({ name, value }) => {
				return result.annotation(name) === value;
			});
			if (found) {
				ret.push(id);
			}
		}
		return ret;
	}

	async findCache(id: string) {
		const list = await this.findByAnnotation({ [ANNOID_CACHE_HASH]: id });
		return list[0];
	}

	async findByLabel(...labels: string[]) {
		const result = await this.run([
			'images',
			'--all',
			'--format={{.ID}}',
			...labels.map((l) => `--filter=label=${l}`),
		]);
		return result.stdout.trim().split('\n');
	}
}

export const buildah = new Buildah();
