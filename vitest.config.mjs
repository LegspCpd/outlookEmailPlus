import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.toml' },
			},
		},
		include: ['tests/worker/**/*.test.{js,ts}', 'tests/worker/**/*.spec.{js,ts}'],
	},
});
