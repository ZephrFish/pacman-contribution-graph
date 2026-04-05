import { type Config, type StoreType } from '../types';

export const Store: StoreType = {
	frameCount: 0,
	aliveSteps: 0,
	contributions: [],
	pacman: {
		x: 0,
		y: 0,
		direction: 'right',
		points: 0,
		totalPoints: 0,
		deadRemainingDuration: 0,
		powerupRemainingDuration: 0,
		recentPositions: [],
		ghostsEaten: 0
	},
	ghosts: [],
	grid: [],
	monthLabels: [],
	pacmanMouthOpen: true,
	gameInterval: 0,
	gameHistory: [],
	remainingDots: 0,
	config: undefined as unknown as Config,
	useGithubThemeColor: true
};
