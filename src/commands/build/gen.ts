import { Command, Option } from '@commander-js/extra-typings';
import { writeFileIfChange } from '@idlebox/node';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { stringify } from 'yaml';
import { resolveService } from '../../helpers/fs/dependency-injection/di';
import {
	IConfigReader,
	IProgramArgs,
	IProject,
	ISecretReader,
} from '../../helpers/fs/dependency-injection/tokens.generated';
import { cancelJob, checkoutCodeSteps, steupSteps } from '../../helpers/github-actions/jobs';

const outArg = new Option('-O, --out <folder-path>', 'output file directory').default('', '.github at project root');
export const command = new Command().addOption(outArg).description('generate github ci yml').action(execute);

interface IGenerateArgs {
	out: string;
}

export async function execute() {
	const proj = await resolveService(IProject);
	const secrets = await resolveService(ISecretReader);
	const config = await resolveService(IConfigReader);
	const args: IProgramArgs<IGenerateArgs> = await resolveService(IProgramArgs);
	let outDir = args.get(outArg);
	if (outDir) {
		outDir = resolve(process.cwd(), outDir);
	} else {
		outDir = resolve(proj.rootDir, '.github/workflows');
	}

	const fname = `generated-build-${config.projectName}.yaml`;
	const fabs = resolve(outDir, fname);

	console.log('[output] %s', fabs);
	await mkdir(dirname(fabs), { recursive: true });

	const buildSteps: any[] = [
		...steupSteps,
		...checkoutCodeSteps,
		// {
		// 	name: '缓存下载和软件包数据',
		// 	uses: 'pat-s/always-upload-cache@v3.0.1',
		// 	with: {
		// 		path: '${{ env.SYSTEM_COMMON_CACHE }}/Download\n${{ env.SYSTEM_COMMON_CACHE }}/golang\n${{ env.SYSTEM_COMMON_CACHE }}/pip\n${{ env.SYSTEM_COMMON_CACHE }}/nodejs\n${{ env.SYSTEM_COMMON_CACHE }}/CCACHE\n',
		// 		key: "common-cache-{{PROJ}}-${{ hashFiles('{{PROJ}}') }}",
		// 		'restore-keys': 'common-cache-{{PROJ}}\ncommon-cache-\n',
		// 	},
		// },
		{
			name: `解密配置文件`,
			shell: 'bash',
			'timeout-minutes': 2,
			env: { SECRET_PASSWORD: '${{ secrets.SECRET_PASSWORD }}' },
			run: `pm secrets -d`,
		},
		{
			name: `登陆缓存镜像源(${secrets.cacheRegistry.location})`,
			shell: 'bash',
			'timeout-minutes': 2,
			run: `pm cache login ${secrets.cacheRegistry.location}`,
		},
		{
			name: '从ghcr.io获取上次生成的镜像',
			shell: 'bash',
			if: "github.event.inputs.brandNew == ''",
			'timeout-minutes': 1,
			run: `pm build pull-cache`,
		},
	];

	const yml: any = {
		name: config.projectName,
		on: {
			workflow_dispatch: {
				inputs: {
					brandNew: { type: 'boolean', description: '跳过拉取上次构建结果', required: false, default: false },
					forceDnf: { type: 'boolean', description: '强制运行dnf', required: false, default: false },
					forceRebuild: {
						type: 'boolean',
						description: '强制全部重新构建，无视缓存',
						required: false,
						default: false,
					},
				},
			},
			schedule: [{ cron: '47 4 1 * *' }], // TODO: 47 4 {{cron_day}} * *
			push: { paths: [`${dirname(proj.configFileRelative)}/**`], branches: ['master'] },
		},
		env: {
			PROJECT_PATH: proj.configFileRelative,
			NODE_ENV: 'production',
			PROJECT_NAME: config.projectName,
			GITHUB_ACTOR: '${{ github.actor }}',
		},
		jobs: {
			cancel: cancelJob,
			build: {
				name: '生成镜像',
				'runs-on': 'ubuntu-latest',
				outputs: { DOMAIN_ARRAY: '${{ steps.result.outputs.DOMAIN_ARRAY }}' },
				steps: buildSteps,
			},
			publish: {
				'runs-on': 'ubuntu-latest',
				needs: ['build'],
				strategy: {
					matrix: { domain: '${{ fromJson(needs.pre-publish.outputs.DOMAIN_ARRAY) }}' }, // TODO: local resolve
					'fail-fast': false,
				},
				steps: [
					...steupSteps,
					...checkoutCodeSteps,
					{
						name: '发布镜像到',
						shell: 'bash',
						'timeout-minutes': 2,
						env: {
							GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
							SECRET_PASSWORD: '${{ secrets.SECRET_PASSWORD }}',
						},
						run: `pm publish --dist \${{ matrix.domain }}`,
					},
				],
			},
		},
	};

	for (const { index, uuid, step } of config.steps) {
		const cfg: any = {
			name: `第${index + 1}步: ${step.title}`,
			shell: 'bash',
			'timeout-minutes': 30,
			env: {
				BUILDAH_FORCE: '${{ github.event.inputs.forceRebuild }}',
				FORCE_DNF: '${{ github.event.inputs.forceDnf }}',
				GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
			},
			run: `pm build --step ${uuid}`,
		};

		if (step.id) {
			cfg.name += ` (${step.id})`;
			cfg.id = step.id;
		}

		buildSteps.push(cfg);
	}

	await writeFileIfChange(fabs, stringify(yml, { aliasDuplicateObjects: false }));
}
