import * as core from '@actions/core';
import * as fs from 'fs';
import { PacmanRenderer } from 'pacman-contribution-graph';
import * as path from 'path';

const generateSvg = async (userName, githubToken, theme, playerStyle) => {
	return new Promise((resolve, reject) => {
		let generatedSvg = '';
		let gameStats = null;
		const conf = {
			platform: 'github',
			username: userName,
			outputFormat: 'svg',
			gameSpeed: 1,
			gameTheme: theme,
			playerStyle,
			githubSettings: {
				accessToken: githubToken
			},
			svgCallback: (svg) => {
				generatedSvg = svg;
			},
			gameStatsCallback: (stats) => {
				gameStats = stats;
			},
			gameOverCallback: () => {
				resolve({ svg: generatedSvg, stats: gameStats });
			}
		};

		const renderer = new PacmanRenderer(conf);
		renderer.start();
	});
};

(async () => {
	try {
		const userName = core.getInput('github_user_name');
		const githubToken = core.getInput('github_token');
		const playerStyle = core.getInput('player_style') || 'oportunista';

		const lightResult = await generateSvg(userName, githubToken, 'github', playerStyle);
		console.log(`writing to dist/pacman-contribution-graph.svg`);
		fs.mkdirSync(path.dirname('dist/pacman-contribution-graph.svg'), { recursive: true });
		fs.writeFileSync('dist/pacman-contribution-graph.svg', lightResult.svg);

		const darkResult = await generateSvg(userName, githubToken, 'github-dark', playerStyle);
		console.log(`writing to dist/pacman-contribution-graph-dark.svg`);
		fs.mkdirSync(path.dirname('dist/pacman-contribution-graph-dark.svg'), { recursive: true });
		fs.writeFileSync('dist/pacman-contribution-graph-dark.svg', darkResult.svg);
	} catch (e) {
		core.setFailed(`Action failed with "${e.message}"`);
	}
})();
