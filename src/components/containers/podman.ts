import { requireCommand } from '../../helpers/program/environments';
import { ContainerTool } from './share';

class Podman extends ContainerTool {
	protected readonly exe = requireCommand('podman');

	stopContainer(kill = false, timeout?: number) {
		const act = [kill ? 'kill' : 'stop'];
		if (timeout !== undefined) {
			act.push('--timeout=' + timeout);
		}
		return this.run(act);
	}

	systemInfo() {
		return this.runJson(['system', 'info']);
	}
}

export const podman = new Podman();
