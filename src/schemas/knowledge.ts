import { IContainerConfig } from './schemaType.generated';

export const schemaConfigUnsupportedKeys: (keyof IContainerConfig)[] = [
	'comment',
	'domainName',
	'healthcheck',
	'hostName',
	'onBuild',
	'shell',
];
