export const cancelJob = {
	name: 'Cancel Previous Runs',
	'runs-on': 'ubuntu-latest',
	needs: 'build',
	steps: [
		{
			name: 'cancel running workflows',
			'timeout-minutes': 5,
			uses: 'GongT/cancel-previous-workflows@6dd7af8389c9434cc893fd33b58609e73db49fbe',
			env: { DELETE: 'yes', GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' },
		},
	],
};

export const steupSteps = [
	{
		name: '设置nodejs',
		uses: 'actions/setup-node@v3',
		'timeout-minutes': 1,
		with: { 'node-version': 'latest', clean: true, 'fetch-depth': 2 },
	},
	{
		name: '安装pnpm',
		uses: 'pnpm/action-setup@v2',
		with: {
			version: 'latest',
			run_install: `- cwd: /tmp\n  args: [--global, https://github.com/GongT/container-builder.git]`,
		},
	},
];
export const checkoutCodeSteps = [
	{
		name: '强制清理项目（如果有）',
		'timeout-minutes': 1,
		shell: 'bash',
		run: 'if [[ -e ".git" ]]; then\n  git reset --hard --recurse-submodule || true\n  git clean -ffdx || true\n  git submodule foreach bash -c "git clean -ffdx" || true\nfi\n',
	},
	{
		name: '获取代码',
		uses: 'actions/checkout@v3',
		'timeout-minutes': 1,
		with: { submodules: 'recursive', clean: true, 'fetch-depth': 2 },
	},
];
