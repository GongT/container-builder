import { InspectOptions, inspect } from 'util';

interface canJson {
	toJSON(): any;
	[inspect.custom]: any;
}

let inspectCallLevel = 0;
let duplicate: Record<symbol, boolean> = {};

export function attachInspect(Class: new (...aa: any[]) => canJson) {
	const prototype = Class.prototype as canJson;
	const symbol = Symbol('inspect.exists');

	if (Object.hasOwn(prototype, inspect.custom)) return;

	function attachedCustomInspect(this: canJson, level: number, options: InspectOptions, _inspect: typeof inspect) {
		let r = `[Service ${Class.name}]`;
		if (options.colors) {
			r = `\x1B[38;5;6m[Service \x1B[3m${Class.name}\x1B[23m]\x1B[0m`;
		}
		
		inspectCallLevel++;
		if (duplicate[symbol]) {
			return r;
		} else {
			duplicate[symbol] = true;

			let data: any;
			if (this.toJSON) {
				data = this.toJSON();
				data = inspect(data, { ...options, compact: true, depth: level }).trim();
				data = `${r} ${data}`;
			} else {
				data = this;
				Object.defineProperty(this, inspect.custom, {
					value: undefined,
					enumerable: false,
					configurable: true,
					writable: true,
				});
				data = inspect(this, { ...options, compact: false, depth: level }).trim();
				delete this[inspect.custom];
			}

			inspectCallLevel--;

			if (inspectCallLevel === 0) {
				duplicate = {};
			}

			return data;
		}
	}

	// prototype[inspect.custom] = attachedCustomInspect;
	Object.defineProperty(prototype, inspect.custom, {
		enumerable: false,
		configurable: false,
		writable: false,
		value: attachedCustomInspect,
	});
}
