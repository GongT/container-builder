import { ContainerTool } from '../../components/containers/container-tool';
import { inject } from '../fs/dependency-injection/di';
import { ISecretReader } from '../fs/dependency-injection/tokens.generated';

export class BuildStatus extends ContainerTool {
	@inject(ISecretReader)
	private declare readonly secrets: ISecretReader;

	constructor(private readonly cacheName: string) {
		super();
	}

	override async init() {
		await super.init('podman');

		const base = new URL(this.secrets.get().cache);


	}

	
}
