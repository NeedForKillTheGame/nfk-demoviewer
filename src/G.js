import Map from "./Map.js";
import Constants from "./Constants.js";
import Demo from "./Demo.js";
import Render from "./Render.js";
import Sound from "./Sound.js";
import ScreenLabels from "./ScreenLabels.js";
import TimerManager from "./TimerManager.js";
import Weapons from "./Weapons.js";



// global class with all data
export default
class Global {
	constructor() {		
		this.resources = {};
		this.map = new Map(this);
		// pixi
		this.render = new Render(this); 
		
		this.players = [];
		// demo data
		this.demo = new Demo(this);
		// objects on the map
		this.objects = [];
		// missiles, traces and explosions
		this.weapons = new Weapons(this);

		// timers
		this.timerManager = new TimerManager();

		// screen labels
		this.labels = new ScreenLabels(this); // labels on the screen

		// game state
		this.gamestate = {
			gametime: 0,
			gametic: 0,
			paused: false,
			gameend: false,
			speeddemo: 20, // demo speed of NFK 0..40, 20 = normal, the viewer goes faster up to 52

			redscore: 0,
			bluescore: 0
		};

		
		this.config = {
			demoServiceUrl: 'https://nfk.harpywar.com/demoparser/demo?type=full&url=',
			statsDemoUrl: 'https://stats.needforkill.ru/demo/', 
			mode: process.env.NODE_ENV, // 'devemopment' or 'production', depends on running enviroment
			volume: 0.1,
			default_bg: 2,
			netCoordInterpolate: 0.85, // net_coordinterpolate of NFK: smooth movement of demo players, 0 = draw the exact positions
			mech: false, // rectangle for objects
			brickMech: false // rectangle for bricks
		}

		// init volume
		Sound.setVolume(this.config.volume);
	}

	// ticks per second of the demo playback (mainform.dxtimer.fps of NFK, x0.6..x2.2),
	// faster speeds after the NFK maximum 40 are x3, x4, x6, x8, x12, x16
	demoTicksPerSecond() {
		var speeddemo = this.gamestate.speeddemo;
		if (speeddemo > 40)
			return Constants.FPS * [3, 4, 6, 8, 12, 16][(speeddemo - 42) / 2];
		return speeddemo > 20 ? 30 + speeddemo * 2 : 30 + speeddemo;
	}
}