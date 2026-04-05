import { GhostsMovement } from '../movement/ghosts-movement';
import { PacmanMovement } from '../movement/pacman-movement';
import { MusicPlayer, Sound } from '../music-player';
import { Canvas } from '../renderers/canvas';
import { SVG } from '../renderers/svg';
import { GhostName, StoreType } from '../types';
import { Utils } from '../utils/utils';
import { DELTA_TIME, PACMAN_DEATH_DURATION } from './constants';

const DEFAULT_MAX_HISTORY_SIZE = 5000;

/* ---------- positioning helpers ---------- */

const placePacman = (store: StoreType) => {
	store.pacman = {
		x: 0,
		y: 0,
		direction: 'right',
		points: 0,
		totalPoints: 0,
		deadRemainingDuration: 0,
		powerupRemainingDuration: 0,
		recentPositions: [],
		ghostsEaten: 0
	};
};

const placeGhosts = (store: StoreType) => {
	store.ghosts = [
		{
			x: 26,
			y: 2,
			name: 'blinky',
			direction: 'left',
			scared: false,
			target: undefined,
			inHouse: false,
			respawnCounter: 0,
			freezeCounter: 0,
			justReleasedFromHouse: false
		},
		{
			x: 25,
			y: 3,
			name: 'inky',
			direction: 'up',
			scared: false,
			target: undefined,
			inHouse: true,
			respawnCounter: 0,
			freezeCounter: 10,
			justReleasedFromHouse: false
		},
		{
			x: 26,
			y: 3,
			name: 'pinky',
			direction: 'down',
			scared: false,
			target: undefined,
			inHouse: true,
			respawnCounter: 0,
			freezeCounter: 20,
			justReleasedFromHouse: false
		},
		{
			x: 27,
			y: 3,
			name: 'clyde',
			direction: 'up',
			scared: false,
			target: undefined,
			inHouse: true,
			respawnCounter: 0,
			freezeCounter: 30,
			justReleasedFromHouse: false
		}
	];

	// reset extras
	store.ghosts.forEach((g) => {
		g.justReleasedFromHouse = false;
		g.respawnCounter = 0;

		// Set different directions to create an asynchronous motion effect
		if (g.inHouse) {
			// Distribute the initial directions so that everyone is not synchronized
			if (g.name === 'inky') g.direction = 'up';
			else if (g.name === 'pinky') g.direction = 'down';
			else if (g.name === 'clyde') g.direction = 'up';
		}
	});
};

/* ---------- main cycle ---------- */

const stopGame = async (store: StoreType) => {
	clearInterval(store.gameInterval as number);
};

const countRemainingDots = (store: StoreType): number => {
	let count = 0;
	for (const row of store.grid) {
		for (const cell of row) {
			if (cell.commitsCount > 0) count++;
		}
	}
	return count;
};

const startGame = async (store: StoreType) => {
	if (store.config.outputFormat == 'canvas') {
		store.config.canvas = store.config.canvas;
		Canvas.resizeCanvas(store);
		Canvas.listenToSoundController(store);
	}

	store.frameCount = 0;
	store.aliveSteps = 0;
	store.gameHistory = []; // keeps clean
	store.ghosts.forEach((g) => (g.scared = false));

	store.grid = Utils.createGridFromData(store);
	store.remainingDots = countRemainingDots(store);

	if (store.remainingDots > 0) {
		placePacman(store);
		placeGhosts(store);
	}

	if (store.config.outputFormat == 'canvas') Canvas.drawGrid(store);

	if (store.config.outputFormat == 'canvas') {
		if (!store.config.enableSounds) {
			MusicPlayer.getInstance().mute();
		}
		await MusicPlayer.getInstance().preloadSounds();
		MusicPlayer.getInstance().startDefaultSound();
		await MusicPlayer.getInstance().play(Sound.BEGINNING);
	}

	if (store.config.outputFormat === 'svg') {
		while (store.remainingDots > 0) {
			await updateGame(store);
		}
		// snapshot final
		await updateGame(store);
	} else {
		clearInterval(store.gameInterval as number);
		store.gameInterval = setInterval(() => updateGame(store), DELTA_TIME * store.config.gameSpeed) as unknown as number;
	}
};

/* ---------- utilities ---------- */

const resetPacman = (store: StoreType) => {
	store.pacman.x = 27;
	store.pacman.y = 7;
	store.pacman.direction = 'right';
	store.pacman.recentPositions = [];
};

export const determineGhostName = (index: number): GhostName => {
	const names: GhostName[] = ['blinky', 'inky', 'pinky', 'clyde'];
	return names[index % names.length];
};

/* ---------- update per frame ---------- */

const updateGame = async (store: StoreType) => {
	store.frameCount++;

	/* ---- FRAME-SKIP restored ---- */
	if (store.frameCount % store.config.gameSpeed !== 0) {
		pushSnapshot(store);
		return;
	}

	/* -------- pacman timers -------- */
	if (store.pacman.deadRemainingDuration > 0) {
		store.pacman.deadRemainingDuration--;
		if (store.pacman.deadRemainingDuration === 0) {
			resetPacman(store);
			placeGhosts(store);
		}
	}

	if (store.pacman.powerupRemainingDuration > 0) {
		store.pacman.powerupRemainingDuration--;
		if (store.pacman.powerupRemainingDuration === 0) {
			store.ghosts.forEach((g) => {
				if (g.name !== 'eyes') g.scared = false;
			});
			store.pacman.points = 0;
		}
	}

	/* -- ghost respawn -- */
	store.ghosts.forEach((ghost) => {
		if (ghost.inHouse && ghost.respawnCounter && ghost.respawnCounter > 0) {
			ghost.respawnCounter--;
			if (ghost.respawnCounter === 0) {
				ghost.name = ghost.originalName || determineGhostName(store.ghosts.indexOf(ghost));
				ghost.inHouse = false;
				ghost.scared = store.pacman.powerupRemainingDuration > 0;
				ghost.justReleasedFromHouse = true;
			}
		}
		if (ghost.freezeCounter) {
			ghost.freezeCounter--;
			if (ghost.freezeCounter === 0) {
				releaseGhostFromHouse(store, ghost.name);
			}
		}
	});

	/* -------- end of game -------- */
	if (store.remainingDots <= 0) {
		if (store.config.outputFormat === 'svg') {
			const svg = SVG.generateAnimatedSVG(store);
			store.config.svgCallback(svg);
		}
		if (store.config.outputFormat == 'canvas') {
			Canvas.renderGameOver(store);
			MusicPlayer.getInstance()
				.play(Sound.BEGINNING)
				.then(() => MusicPlayer.getInstance().stopDefaultSound());
		}
		if (store.config.gameStatsCallback) {
			store.config.gameStatsCallback({
				totalScore: store.pacman.totalPoints,
				steps: store.aliveSteps,
				ghostsEaten: store.pacman.ghostsEaten ?? 0
			});
		}
		store.config.gameOverCallback();
		return;
	}

	/* -------- movements -------- */
	PacmanMovement.movePacman(store);

	const cell = store.grid[store.pacman.x]?.[store.pacman.y];
	if (cell && cell.level === 'FOURTH_QUARTILE' && store.pacman.powerupRemainingDuration === 0) {
		store.pacman.powerupRemainingDuration = 30;
		store.ghosts.forEach((g) => {
			if (g.name !== 'eyes') g.scared = true;
		});
	}

	checkCollisions(store);

	if (store.pacman.deadRemainingDuration === 0) {
		GhostsMovement.moveGhosts(store);
		checkCollisions(store);
	}

	store.pacmanMouthOpen = !store.pacmanMouthOpen;

	/* ---- alive-steps counter ---- */
	if (store.pacman.deadRemainingDuration === 0) {
		store.aliveSteps++;
	}

	/* ---- live stats update ---- */
	if (store.config.gameStatsCallback) {
		store.config.gameStatsCallback({
			totalScore: store.pacman.totalPoints,
			steps: store.aliveSteps,
			ghostsEaten: store.pacman.ghostsEaten ?? 0
		});
	}

	/* ---- single snapshot per frame ---- */
	pushSnapshot(store);

	if (store.config.outputFormat == 'canvas') Canvas.drawGrid(store);
	if (store.config.outputFormat == 'canvas') Canvas.drawPacman(store);
	if (store.config.outputFormat == 'canvas') Canvas.drawGhosts(store);
	if (store.config.outputFormat == 'canvas') Canvas.drawSoundController(store);
};

/* ---------- snapshot helper ---------- */
const pushSnapshot = (store: StoreType) => {
	const maxSize = store.config.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
	if (store.gameHistory.length >= maxSize) {
		store.gameHistory.shift();
	}
	store.gameHistory.push({
		pacman: { ...store.pacman },
		ghosts: store.ghosts.map((g) => ({ ...g })),
		grid: store.grid.map((row) => row.map((col) => ({ ...col })))
	});
};

/* ---------- collisions & house ---------- */

const checkCollisions = (store: StoreType) => {
	if (store.pacman.deadRemainingDuration) return;

	store.ghosts.forEach((ghost) => {
		// If the ghost is eyes, there should be no collision
		if (ghost.name === 'eyes') return;

		if (ghost.x === store.pacman.x && ghost.y === store.pacman.y) {
			if (store.pacman.powerupRemainingDuration && ghost.scared) {
				ghost.originalName = ghost.name;
				ghost.name = 'eyes';
				ghost.scared = false;
				ghost.target = { x: 26, y: 3 };
				store.pacman.points += 10;
				store.pacman.ghostsEaten = (store.pacman.ghostsEaten ?? 0) + 1;
			} else {
				store.pacman.points = 0;
				store.pacman.powerupRemainingDuration = 0;
				if (store.pacman.deadRemainingDuration === 0) {
					store.pacman.deadRemainingDuration = PACMAN_DEATH_DURATION;
				}
			}
		}
	});
};

const releaseGhostFromHouse = (store: StoreType, name: GhostName) => {
	const ghost = store.ghosts.find((g) => g.name === name && g.inHouse);
	if (ghost) {
		ghost.justReleasedFromHouse = true;
		ghost.y = 2;
		ghost.direction = 'up';
	}
};

export const Game = {
	startGame,
	stopGame
};
