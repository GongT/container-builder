export function parseBooleanEnv(value: string | undefined) {
	if (!value) return false;
	value = value.toLowerCase();

	if (value === 'yes' || value === 'on' || value === '1' || value === 'true') return true;
	else if (value === 'no' || value === 'off' || value === '0' || value === 'false') return false;
	else throw new Error('Invalid boolean value: ' + value);
}
