import Map from "./Map.js";
import Constants from "./Constants.js";
import Keyboard from "./Keyboard.js";
import Player from "./Player.js";
import {renderGame} from "./Render.js";
import Stats from "Stats";
import Demo from "./Demo.js";
import Sound from "./Sound.js";
import Global from "./G.js";

var stats = new Stats();
document.getElementById('fps').appendChild(stats.domElement);


var G = new Global();

console.log("mode: " + G.config.mode);

// esc
Keyboard.onKeyUp(27, function(){
	G.gamestate.paused = G.gamestate.paused ? false : true;
});

PIXI.loader.onLoad.add(function(loader,data){ // called once per loaded data (callback)
	// TODO: add loader progress bar
	//console.log('data: ',data,'|Progress:'+loader.progress,'|FileName:'+((data.url).slice(32)),'|Named:'+data.name,'|Ext:'+data.extension);
});

PIXI.loader
	.add('palette', "images/palette.png")
	.add('railhit', "images/railhit.png")
	.add('glow', "images/glow.png") 
	.add('weapons', "images/weapons.json")
	.add('explosion', "images/explosion.json") // animation
	.add('mgun', "images/mgun.json") // animation
	.add('jumppad', "images/jumppad.json") // animation
	.add('gauntlet', "images/gauntlet.json") // animation
	.add('bullets', "images/bullets.json") // animation

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

	.add('sarge', "images/models/sarge.json")
	.add('xaero', "images/models/xaero.json")
	.add('keel', "images/models/keel.json")
	.add('doom2', "images/models/doom2.json")
	.add('crashed', "images/models/crashed.json")
	
	.load(run);
	


function run(loader, resources) {

	G.resources = resources;
	
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

	// one game tick of NFK (1/50 sec): physics of players, then the demo frames of this tick, like DXTimerTimer
	function gameTick() {
		for (var i = 0; i < G.players.length; i++)
		{
			if (G.players[i].isSpectator())
				continue;

			// player physics
			G.players[i].physics.playermove();

			// handle objects collisions with a player
			for (var k = 0; k < G.objects.length; k++) {
				G.objects[k].handleCollisions(G.players[i]);
			}
		}

		for (var i = 0; i < G.map.brickObjects.length; i++)
		{
			// handle objects collisions with a brick
			for (var k = 0; k < G.objects.length; k++) {
				G.objects[k].handleBrickCollisions(G.map.brickObjects[i]);
			}
		}

		// if end of demo then return from the function (it will stop infinite loop)
		//if ( !G.demo.nextFrame(gametic) )
		//	return;
		// FIXME: a new feature to rewind a demo is available, so don't break app when demo ends
		G.demo.nextFrame(gametic);
		
		// this must be after G.demo.nextFrame(), to handle gametic = 0
		if (++gametic >= Constants.FPS)
			gametic = 0;

		G.timerManager.tick();
	}

	// the game runs at fixed 50 ticks per second (NFK physics constants are per tick) independently of the browser FPS
	var tickTime = 1000 / Constants.FPS;
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
			if (time === 0)
				time = timestamp;

			// do not catch up a long break (a hidden browser tab does not call requestAnimationFrame)
			if (timestamp - time > tickTime * Constants.FPS)
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

