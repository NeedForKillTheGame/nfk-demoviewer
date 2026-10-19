import Map from "./Map.js";
import Constants from "./Constants.js";
import Keyboard from "./Keyboard.js";
import Player from "./Player.js";
import {renderGame} from "./Render.js";
import Stats from "Stats";
import Demo from "./Demo.js";
import Sound from "./Sound.js";
import Global from "./G.js";
import Models from "./Models.js";

var stats = new Stats();
document.getElementById('fps').appendChild(stats.domElement);


var G = new Global();

console.log("mode: " + G.config.mode);

// esc, pause/break
Keyboard.onKeyUp(27, function(){
	G.gamestate.paused = G.gamestate.paused ? false : true;
});
Keyboard.onKeyUp(19, function(){
	G.gamestate.paused = G.gamestate.paused ? false : true;
});

// demo speed by +/- like numpad +/- in NFK (speeddemo by 2), a held key keeps changing it by the key repeat
[107, 187, 61].forEach(function(keyCode) {
	Keyboard.onKeyDown(keyCode, function(){
		G.gamestate.speeddemo = Math.min(52, G.gamestate.speeddemo + 2);
	});
});
[109, 189, 173].forEach(function(keyCode) {
	Keyboard.onKeyDown(keyCode, function(){
		G.gamestate.speeddemo = Math.max(0, G.gamestate.speeddemo - 2);
	});
});
// * resets the normal speed
Keyboard.onKeyDown(106, function(){
	G.gamestate.speeddemo = 20;
});

// follow a player by 1-8 (main keyboard or numpad)
for (var n = 1; n <= 8; n++) {
	[48 + n, 96 + n].forEach(function(keyCode) {
		var index = n - 1;
		Keyboard.onKeyDown(keyCode, function(e){
			// shift+8 is * of the main keyboard
			if (e.shiftKey && keyCode == 56) {
				G.gamestate.speeddemo = 20;
				return;
			}
			var players = G.players.filter(p => !p.isSpectator());
			if (!players[index])
				return;
			G.players.forEach(p => p.follow = p == players[index]);
		});
	});
}

PIXI.loader.onLoad.add(function(loader,data){ // called once per loaded data (callback)
	// TODO: add loader progress bar
	//console.log('data: ',data,'|Progress:'+loader.progress,'|FileName:'+((data.url).slice(32)),'|Named:'+data.name,'|Ext:'+data.extension);
});

PIXI.loader
	.add('palette', "images/palette.png")
	.add('glow', "images/glow.png") 
	.add('jumppad', "images/jumppad.json") // animation
	// original images of NFK graph.d and graph2.d
	.add('nfk_explosion', "images/nfk/explosion.png")
	.add('nfk_16x16', "images/nfk/16x16.png")
	.add('nfk_8x8', "images/nfk/8x8.png")
	.add('nfk_smoke32b', "images/nfk/smoke32b.png")
	.add('nfk_burn_med_mrk', "images/nfk/burn_med_mrk.png")
	.add('nfk_bullet_mrk', "images/nfk/bullet_mrk.png")
	.add('nfk_railtrace1', "images/nfk/railtrace1.png")
	.add('nfk_railhit', "images/nfk/railhit.png")
	.add('nfk_shaft', "images/nfk/shaft.png")
	.add('nfk_gibs', "images/nfk/gibs.png")
	.add('nfk_weapons', "images/nfk/weapons.png")
	.add('nfk_mgun_ex', "images/nfk/mgun_ex.png")
	.add('nfk_gauntlet', "images/nfk/gauntlet.png")
	.add('nfk_models', "images/nfk/models/models.json") // the model sheets are loaded by Models.js on demand

	.add('medkits', "images/medkits.json")
	.add('portal', "images/portal.png")
	.add('door', "images/door.png")
	.add('button', "images/button.png")
	.add('flash', "images/flash.png") // animation
	.add('mega', "images/mega.json") // animation
	.add('flag', "images/flag.json") // animation
	.add('powerup', "images/powerup.json") // animation
	.add('armors', "images/armors.json") // animation
	.add('items', "images/items.json") // animation

	.load(run);
	


function run(loader, resources) {

	G.resources = resources;
	Models.init(resources.nfk_models.data);
	
	// load demo
	if (G.config.mode == 'development' && !window.location.search) {
		G.demo.load("demo.json", init); // for debug load local demo
	} else {
		G.demo.loadFromQuery(init); // for production
	}
	console.log("demo loaded");
}		


async function init()
{
	var timer = 0;

	await G.map.loadFromDemo(G.demo.data.Map);
	G.render.renderMap();
	
	/*
	// FIXME: respawn is not for demo
	for (var i = 0; i < G.players.length; i++)
	{
		//just for safe respawn
		var respawn = Map.getRandomRespawn();
		G.players[i].setXY(respawn.col * Constants.BRICK_WIDTH + 10, respawn.row * Constants.BRICK_HEIGHT - 24);
	}
	*/

	var gametic = 0;

	// one game tick of NFK (1/50 sec) in the order of DXTimerTimer: physics of players, objects under the players,
	// players, missiles, explosions and shots, then the demo frames of this tick
	function gameTick() {
		for (var i = 0; i < G.players.length; i++)
		{
			if (G.players[i].isSpectator())
				continue;

			// player physics
			G.players[i].physics.playermove();
			G.players[i].weaponTick();

			// handle objects collisions with a player
			for (var k = 0; k < G.objects.length; k++) {
				G.objects[k].handleCollisions(G.players[i]);
			}
		}

		// doors and buttons (MAPOBJ_think)
		for (var k = 0; k < G.objects.length; k++) {
			if (G.objects[k].tick)
				G.objects[k].tick();
		}

		G.weapons.removeDead();
		G.weapons.particles.process(); // ParticleEngine.Process/Render
		G.weapons.tick(0);
		for (var i = 0; i < G.players.length; i++) {
			G.players[i].updateTestPredict(G.config.netCoordInterpolate);
		}
		G.weapons.tick(1);
		G.weapons.tick(2);

		// if end of demo then return from the function (it will stop infinite loop)
		//if ( !G.demo.nextFrame(gametic) )
		//	return;
		// FIXME: a new feature to rewind a demo is available, so don't break app when demo ends
		G.demo.nextFrame(gametic);
		
		// this must be after G.demo.nextFrame(), to handle gametic = 0
		if (++gametic >= Constants.FPS) {
			gametic = 0;
			// a game second: powerups wear off
			for (var i = 0; i < G.players.length; i++) {
				G.players[i].powerupSecond();
			}
		}

		G.timerManager.tick();
	}

	// the game runs at fixed 50 ticks per second (NFK physics constants are per tick) independently of the browser FPS
	var time = 0; // time of the next game tick
	function gameLoop(timestamp) {
		stats.begin();

		//G.players[0].keyUp = Keyboard.keyUp;
		//G.players[0].keyDown = Keyboard.keyDown;
		//G.players[0].keyLeft = Keyboard.keyLeft;
		//G.players[0].keyRight = Keyboard.keyRight;

		// if game not paused
		if (!G.gamestate.paused)
		{
			// speeddemo changes the timer of NFK: 30 + speeddemo ticks per second, twice faster above 20
			var tickTime = 1000 / G.demoTicksPerSecond();

			if (time === 0)
				time = timestamp;

			// do not catch up a long break (a hidden browser tab does not call requestAnimationFrame)
			if (timestamp - time > 1000)
				time = timestamp;

			while (timestamp >= time) {
				gameTick();
				time += tickTime;
			}

			// for debug
			if (G.config.mech) {
				G.render.renderMech();			
			}
		} else {
			time = 0;
		}

		// player graphics (after physics of all players, so the camera follows the actual position)
		G.render.updateCamera();
		for (var i = 0; i < G.players.length; i++) {
			G.render.renderGame(G.players[i]);
		}
		G.render.renderLabels();
		G.render.app.render();

		requestAnimationFrame(gameLoop); //infinite render loop
		
		stats.end();
		
	}

	requestAnimationFrame(gameLoop);


}

