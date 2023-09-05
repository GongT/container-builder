import { registerAuto } from '../../helpers/fs/dependency-injection/di';
import { ContainerTool, TargetKind } from './container-tool';

@registerAuto()
export class Buildah extends ContainerTool {
	override init() {
		return super.init('buildah');
	}

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
		const list = await this.findByAnnotation({ [this.env.ANNOID_CACHE_HASH]: id });
		return list[0];
	}

	async findByLabel(...labels: string[]) {
		const result = await this.run([
			'images',
			'--all',
			'--format={{.ID}}',
			...labels.map((l) => `--filter=label=${l}`),
		]);
		return result.trim().split('\n');
	}
}
