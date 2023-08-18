export function random(length = 8) {
	return Math.random()
		.toString(36)
		.slice(2, 2 + length);
}
