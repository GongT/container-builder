import { registerAuto } from '../../helpers/fs/dependency-injection/di';
import { IContainerTool } from '../../helpers/fs/dependency-injection/tokens.generated';

@registerAuto()
export class Podman {
	protected declare readonly podman: IContainerTool;

	protected async init() {
		// const podman = await resolveService(IContainerTool);
		// return { podman };
	}

	stopContainer(kill = false, timeout?: number) {
		const act = [kill ? 'kill' : 'stop'];
		if (timeout !== undefined) {
			act.push('--timeout=' + timeout);
		}
		return this.podman.run(act);
	}

	systemInfo() {
		return this.podman.runJson(['system', 'info']);
	}
}
