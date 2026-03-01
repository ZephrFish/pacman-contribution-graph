import * as core from '@actions/core';
import * as fs from 'fs';
import { PacmanRenderer } from 'pacman-contribution-graph';
import * as path from 'path';

const STATS_ENDPOINT = 'https://elec.abozanona.me/pacman-leaderboard/receive_stats.php';

const reportStats = async (username, platform, stats) => {
	try {
		await fetch(STATS_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username,
				platform,
				score: stats.totalScore,
				steps: stats.steps,
				ghosts_eaten: stats.ghostsEaten
			})
		});
		console.log('📊 Stats reported to leaderboard');
	} catch (e) {
		console.warn('⚠️  Could not report stats:', e.message);
	}
};

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
		let svgContent = '';
		const userName = core.getInput('github_user_name');
		const githubToken = core.getInput('github_token');
		const playerStyle = core.getInput('player_style') || 'oportunista';
		// TODO: Check active users
		fetch('https://elec.abozanona.me/github-action-analytics.php?username=' + userName);

		const lightResult = await generateSvg(userName, githubToken, 'github', playerStyle);
		svgContent = lightResult.svg;
		console.log(`💾 writing to dist/pacman-contribution-graph.svg`);
		fs.mkdirSync(path.dirname('dist/pacman-contribution-graph.svg'), { recursive: true });
		fs.writeFileSync('dist/pacman-contribution-graph.svg', svgContent);

		const darkResult = await generateSvg(userName, githubToken, 'github-dark', playerStyle);
		svgContent = darkResult.svg;
		console.log(`💾 writing to dist/pacman-contribution-graph-dark.svg`);
		fs.mkdirSync(path.dirname('dist/pacman-contribution-graph-dark.svg'), { recursive: true });
		fs.writeFileSync('dist/pacman-contribution-graph-dark.svg', svgContent);

		// Pick the best stats across both runs
		const allStats = [lightResult.stats, darkResult.stats].filter(Boolean);
		if (allStats.length > 0) {
			const bestStats = {
				totalScore: Math.max(...allStats.map((s) => s.totalScore)),
				steps: Math.min(...allStats.map((s) => s.steps)),
				ghostsEaten: Math.max(...allStats.map((s) => s.ghostsEaten))
			};
			await reportStats(userName, 'github', bestStats);
		}
	} catch (e) {
		core.setFailed(`Action failed with "${e.message}"`);
	}
})();
