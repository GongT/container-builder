import { md5 } from '@idlebox/node';

export function hashFolder(path: string) {
	console.log(md5(Buffer.from(path)));
	throw new Error('not impl');
}
