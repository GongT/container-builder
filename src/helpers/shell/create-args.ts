import { linux_case_hyphen } from '@idlebox/common';


export function createChildArgs(options: Record<string, string | boolean>) {
	const r = [];
	for (const [k, v] of Object.entries(options)) {
		const n = linux_case_hyphen(k);
		if (v === true) {
			r.push(`--${n}`);
		} else if (v === false || v === undefined) {
			continue;
		} else {
			r.push(`--${n}=${v}`);
		}
	}
	return r;
}
