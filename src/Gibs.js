import PIXI from "PIXI";
import Utils from "./Utils.js";
import Sound from "./Sound.js";
import Models from "./Models.js";
import { Missile, pattern, rotation } from "./Missiles.js";

// Corpses, gibs and blood of NFK 0.77: SpawnCorpse/CorpsePhysic, ThrowGib, 'blood' objects and the blood
// particle engine (PEngine.pas). Corpses, gibs and droplets are drawn after the bricks and before the players.

var round = Utils.round;
var trunc = Utils.trunc;

var GRAVITY = 0.02;
var OPT_CORPSETIME = 10; // seconds
var GRENADE_SLOWSPEED = 1.07;
var GIB_IMAGES = 7; // SYS_GIBIMAGES

// Delphi random(n): 0..n-1
function random(n) {
	return Math.floor(Math.random() * n);
}

// everything dynamic is added to mapGraphics after the brick sprites, the particle layer first (the droplets are
// rendered before the topdraw-0 objects)
function particleLayer(g) {
	var engine = g.weapons.particles;
	if (!engine.container || engine.container.parent != g.render.mapGraphics) {
		engine.container = new PIXI.Container();
		g.render.mapGraphics.addChild(engine.container);
		engine.used = 0;
		engine.pool = [];
	}
	return engine.container;
}

// TParticle of PEngine.pas
class BloodParticle {
	constructor(x, y, xvel, yvel, long) {
		this.x = x;
		this.y = y;
		this.xvel = xvel;
		this.yvel = yvel;
		this.cycle = 0;
		this.alpha = 0xFF;
		this.angl = random(0xFF);
		this.spotpattern = random(2);
		this.maxlife = long ? 30 + random(25) : 30 + random(10);
	}

	// TParticle.Move(), false when the particle is over
	move(map) {
		this.x = this.x + this.xvel;
		this.y = this.y + this.yvel;

		this.yvel = this.yvel + 0.035;
		this.xvel = this.xvel * 0.99;

		if (this.cycle > trunc(this.maxlife / 2))
			this.alpha = trunc(0xFF - (0xFF / (this.maxlife / 2)) * (this.cycle - this.maxlife / 2));
		else
			this.alpha = 0xF0;

		// SYS_BLOODRAIN = false: a droplet stops on a brick
		if (map.isBlock(trunc(this.x / 32), trunc((this.y + 3) / 16))) {
			this.y = round(this.y / 16) * 16;
			this.xvel = 0;
			if (random(2) == 1)
				this.cycle = this.cycle - 1;
			this.yvel = 0;
		}

		this.cycle++;
		return this.cycle < this.maxlife;
	}
}

// TParticleEngine of PEngine.pas (OPT_R_MASSACRE = 0: no splash decals)
export class ParticleEngine {
	constructor(g) {
		this.g = g;
		this.list = [];
		this.container = null;
		this.pool = [];
		this.used = 0;
	}

	addParticle(x, y, xvel, yvel, long) {
		this.list.push(new BloodParticle(x, y, xvel, yvel, long));
	}

	// Process() and Render(): run once per tick before the topdraw-0 objects
	process() {
		var map = this.g.map;
		var i, j = 0;
		for (i = 0; i < this.list.length; i++) {
			var p = this.list[i];
			if (p.move(map))
				this.list[j++] = p;
		}
		this.list.length = j;

		if (this.list.length == 0 && this.used == 0)
			return;
		var layer = particleLayer(this.g);
		for (i = 0; i < this.list.length; i++)
			this.draw(layer, this.list[i], i);
		// hide the sprites left from the previous tick
		for (i = this.list.length; i < this.used; i++)
			this.pool[i].visible = false;
		this.used = this.list.length;
	}

	// TParticle.Draw(): Images[36] (8x8), a droplet which lies on the floor is a flat spot
	draw(layer, p, index) {
		var map = this.g.map;
		var sprite = this.pool[index];
		if (!sprite) {
			sprite = this.pool[index] = new PIXI.Sprite();
			sprite.anchor.set(0.5);
			layer.addChild(sprite);
		}

		var spot = 0;
		if (p.y > 4)
			if (map.isBlock(trunc(p.x / 32), trunc(p.y / 16)) && !map.isBlock(trunc(p.x / 32), trunc((p.y - 4) / 16)))
				spot = 1;

		sprite.visible = true;
		sprite.alpha = p.alpha / 255;
		if (spot == 1) {
			sprite.texture = pattern(this.g, 'nfk_8x8', spot + p.spotpattern, 8, 8);
			sprite.x = round(p.x);
			sprite.y = round(p.y) + 4;
			sprite.rotation = rotation(64);
		} else {
			sprite.texture = pattern(this.g, 'nfk_8x8', spot, 8, 8);
			sprite.x = round(p.x);
			sprite.y = round(p.y);
			sprite.rotation = rotation(p.angl + p.cycle * (2 + p.spotpattern));
		}
	}

	clear() {
		this.list = [];
		if (this.container) {
			if (this.container.parent)
				this.container.parent.removeChild(this.container);
			this.container.destroy({ children: true });
		}
		this.container = null;
		this.pool = [];
		this.used = 0;
	}
}

// 'blood' object (topdraw 2): adds a droplet and dies. spawner = null: SpawnXYNulBlood (cx, cy = point), otherwise
// SpawnBlood (cx, cy = shift from the player)
class Blood extends Missile {
	constructor(g, spawner, cx, cy) {
		super(g, 2);
		this.spawner = spawner;
		this.cx = cx;
		this.cy = cy;
	}

	tick() {
		var engine = this.g.weapons.particles;
		if (!this.spawner)
			engine.addParticle(trunc(this.cx) + 4, trunc(this.cy) + 4, (random(2) - 1) / 5, (random(2) - 1) / 5, false);
		else
			engine.addParticle(trunc(this.spawner.x - this.cx) + 4, trunc(this.spawner.y - this.cy) + 4,
				(random(4) - 2) / 5, (random(4) - 2) / 5, true);
		this.dead = 2;
	}
}

// 'gib' object (topdraw 0)
class Gib extends Missile {
	constructor(g, player) {
		super(g, 0);
		this.x = player.x;
		this.y = player.y;
		this.clippixel = 4;
		this.mass = 5;
		this.frame = 0;
		this.dir = random(2);
		this.fallt = 125 + random(75);
		this.fangle = random(360);
		this.imageindex = random(GIB_IMAGES);
		this.weapon = 128 + random(38); // scale
		this.doublejump = 0;
		// OPT_GIBVELOCITY = false
		this.inertiaX = (random(30) - 15) / 7;
		this.inertiaY = -1 - (random(12) / 6);

		for (var a = 0; a < 4; a++)
			g.weapons.particles.addParticle(trunc(player.x) + 10 - random(20), trunc(player.y) + 20 - random(40),
				(random(6) - 3) / 5, (random(6) - 3) / 5, true);

		particleLayer(g);
		this.sprite = this.addSprite(pattern(g, 'nfk_gibs', this.imageindex, 29, 20));
	}

	tick() {
		this.frame++;
		if (this.frame > this.fallt) {
			this.frame = 0;
			this.dead = 2;
			this.sprite.visible = false;
			return;
		}

		// OPT_GIBBLOOD: a blood trail
		if (this.doublejump == 0) {
			this.g.weapons.add(new Blood(this.g, null, round(this.x - 4), round(this.y - 4)));
			this.doublejump = 5;
		} else {
			this.doublejump--;
		}

		this.physics();

		// RotateEffect(Images[59], ..., scale = weapon)
		this.draw(this.sprite, trunc(this.x), trunc(this.y), trunc(256 / 360 * this.fangle), this.weapon);
	}

	// GrenadePhysics() for a gib (GrenadeBounce does nothing for it)
	physics() {
		var c = this.clippixel;
		if (this.inertiaY == 0 && this.inertiaX == 0)
			return;
		if (this.inertiaY > -0.3 && this.inertiaY < 0.3 && this.inertiaX > -0.3 && this.inertiaX < 0.3
			&& this.g.map.isBlock(trunc(this.x / 32), trunc((this.y + c) / 16))) {
			this.inertiaX = 0;
			return;
		}

		this.inertiaY = this.inertiaY + GRAVITY * this.mass;

		if (this.inertiaY < 0)
			this.inertiaY = this.inertiaY / 1.025; // stopspeed.
		this.inertiaX = this.inertiaX / 1.003; // stopspeed.

		this.x = this.x + this.inertiaX;
		this.y = this.y + this.inertiaY;

		if (this.x < 24) this.x = 24;
		if (this.y < 12) this.y = 12;

		// CLIPPING
		if (this.isSolid(this.x - c, this.y)) {
			if (this.inertiaX < 0) this.inertiaX = Math.abs(this.inertiaX);
			this.inertiaX = this.inertiaX / GRENADE_SLOWSPEED;
			this.dir = 0;
		} else if (this.isSolid(this.x + c, this.y)) {
			if (this.inertiaX > 0) this.inertiaX = -this.inertiaX;
			this.inertiaX = this.inertiaX / GRENADE_SLOWSPEED;
			this.dir = 1;
		}
		if (this.isSolid(this.x, this.y - c)) { // boom ceil
			if (this.inertiaY < 0) this.inertiaY = Math.abs(this.inertiaY);
			this.inertiaX = this.inertiaX / GRENADE_SLOWSPEED;
		} else if (this.isSolid(this.x, this.y + c)) { // boom floor
			if (this.inertiaY > 0) this.inertiaY = -this.inertiaY;
			this.inertiaX = this.inertiaX / GRENADE_SLOWSPEED;
		}

		if (this.inertiaY < -5) this.inertiaY = -5;
		if (this.inertiaY > 5) this.inertiaY = 5;
		if (this.inertiaX < -7) this.inertiaX = -7;
		if (this.inertiaX > 7) this.inertiaX = 7;

		if (this.dir == 1)
			this.fangle = this.fangle - 2;
		else
			this.fangle = this.fangle + 2;
		if (this.fangle < 0) this.fangle = 360;
		if (this.fangle > 360) this.fangle = 0;
		if (this.inertiaX < 0.01 && this.inertiaX > -0.01 && this.onBrick()) this.inertiaX = 0;
		if (this.inertiaY < 0.02 && this.inertiaY > -0.02 && this.onBrick()) this.inertiaY = 0;
	}

	// OnBrick_gren()
	onBrick() {
		var c = this.clippixel;
		var map = this.g.map;
		return !map.isBlock(trunc((this.x - c) / 32), trunc(this.y / 16)) && this.isSolid(this.x - c, this.y + c)
			|| !map.isBlock(trunc((this.x + c) / 32), trunc(this.y / 16)) && this.isSolid(this.x + c, this.y + c)
			|| this.isSolid(this.x, this.y);
	}
}

// 'corpse' object (topdraw 0): the die animation of a player and then the physics of a dead body
class Corpse extends Missile {
	constructor(g, player) {
		super(g, 0);
		this.spawner = player;
		this.cx = OPT_CORPSETIME * 50;
		this.cy = 0;
		this.x = player.x;
		this.y = player.y;
		this.inertiaX = player.velocityX;
		this.inertiaY = player.velocityY;
		this.dir = player.dir;
		this.frame = 0;
		this.weapon = 0;
		this.health = 40;
		this.fallt = player.nextframe || 0;

		particleLayer(g);
		this.sprite = this.addSprite(Models.frame(player.model, player.modelColor, 'die', 0));
		this.sprite.anchor.set(0);
	}

	// CorpsePhysic()
	tick() {
		var sp = this.spawner;
		if (!sp || this.g.players.indexOf(sp) < 0) {
			this.dead = 2;
			this.sprite.visible = false;
			return;
		}

		var defx = this.x;

		// DIE ANIM
		if (this.weapon == 0 && sp.dead > 0) {
			this.x = sp.testX;
			this.y = sp.testY;
			this.inertiaX = sp.velocityX;
			this.inertiaY = sp.velocityY;
		}

		if (this.cx < OPT_CORPSETIME * 50 - 20)
			if (sp.dead == 0)
				this.weapon = 1;

		var alph = this.cx >= 25 ? 255 : trunc(this.cx * 10);

		// emulate player dead movement: the images look to the right, dir 0 and 2 are mirrored
		var params = Models.skin(sp.model, sp.modelColor);
		var left = trunc(this.x - 26);
		this.sprite.texture = Models.frame(sp.model, sp.modelColor, 'die', this.frame);
		this.sprite.visible = true;
		this.sprite.y = trunc(this.y - 27) + 52 - params.diesizey;
		if (this.dir == 1 || this.dir == 3) {
			this.sprite.x = left;
			this.sprite.scale.x = 1;
		} else {
			this.sprite.x = left + 52;
			this.sprite.scale.x = -1;
		}
		this.sprite.alpha = alph / 255;

		if (this.frame < params.dieframes - 1)
			if (this.fallt <= 0) this.frame++;
		if (this.fallt > 0)
			this.fallt--;
		else
			this.fallt = params.dieframerefreshtime;

		if (this.cx > 0) {
			this.cx--;
		} else {
			this.dead = 2;
			return;
		}

		// emulate player physics.
		this.inertiaY = this.inertiaY + GRAVITY * 2.8;
		if (this.inertiaY > -1 && this.inertiaY < 0) this.inertiaY = this.inertiaY / 1.11; // progressive inertia
		if (this.inertiaY > 0 && this.inertiaY < 5) this.inertiaY = this.inertiaY * 1.1;
		if (this.inertiaX < -0.2 || this.inertiaX > 0.2) {
			if (this.dir > 1) {
				if (this.onGround())
					this.inertiaX = this.inertiaX / 1.14; // onground stop speed.
				else
					this.inertiaX = this.inertiaX / 1.025; // inair stopspeed.
			}
		} else {
			this.inertiaX = 0;
		}
		if (this.onGround()) this.inertiaX = this.inertiaX / 1.03; // corpse stop speed.

		this.x = this.x + this.inertiaX;
		this.y = this.y + this.inertiaY;

		// CLIPPING
		var map = this.g.map;
		if (this.inertiaX < 0) {
			var col = trunc(round(defx - 10) / 32);
			if (map.isBlock(col, trunc(round(this.y - 16) / 16)) || map.isBlock(col, trunc(round(this.y) / 16))
				|| map.isBlock(col, trunc(round(this.y + 16) / 16))) {
				this.x = trunc(defx / 32) * 32 + 9;
				this.inertiaX = 0;
			}
		}
		if (this.inertiaX > 0) {
			var col = trunc(round(defx + 10) / 32);
			if (map.isBlock(col, trunc(round(this.y - 16) / 16)) || map.isBlock(col, trunc(round(this.y) / 16))
				|| map.isBlock(col, trunc(round(this.y + 16) / 16))) {
				this.x = trunc(defx / 32) * 32 + 22;
				this.inertiaX = 0;
			}
		}

		if (this.brickOnHead() && this.onGround()) {
			this.inertiaY = 0;
			this.y = trunc(round(this.y) / 16) * 16 + 8;
		} else if (this.brickOnHead() && this.inertiaY < 0) { // fly up
			this.inertiaY = 0;
			this.y = trunc(round(this.y) / 16) * 16 + 8;
		} else if (this.onGround() && this.inertiaY > 0) {
			this.inertiaY = 0;
			this.y = trunc(round(this.y) / 16) * 16 + 8;
		}

		// water move.
		if (map.isWater(trunc(this.x / 32), trunc(this.y / 16))) {
			if (this.inertiaY < -1) this.inertiaY = -1;
			if (this.inertiaY > 1) this.inertiaY = 1;
			if (this.inertiaX < -2) this.inertiaX = -2;
			if (this.inertiaX > 2) this.inertiaX = 2;
		} else { // normal move.
			if (this.inertiaY < -5) this.inertiaY = -5;
			if (this.inertiaY > 5) this.inertiaY = 5;
			if (this.inertiaX < -5) this.inertiaX = -5;
			if (this.inertiaX > 5) this.inertiaX = 5;
		}

		if (this.y > 16 * 250) this.dead = 2; // bugfix.
	}

	block(x, y) {
		return this.g.map.isBlock(trunc(x / 32), trunc(y / 16));
	}

	// BrickFOnHead()
	brickOnHead() {
		var x = this.x, y = this.y;
		return this.block(x - 9, y - 25) && !this.block(x - 9, y - 23)
			|| this.block(x + 9, y - 25) && !this.block(x + 9, y - 23)
			|| this.block(x - 9, y - 24) && !this.block(x - 9, y - 8)
			|| this.block(x + 9, y - 24) && !this.block(x + 9, y - 8);
	}

	// IsFOnground()
	onGround() {
		var x = this.x, y = this.y;
		if (x < 0 || y < 0)
			return false;
		return this.block(x - 1, y + 25) && !this.block(x - 1, y + 23)
			|| this.block(x + 1, y + 25) && !this.block(x + 1, y + 23)
			|| this.block(x - 1, y + 24) && !this.block(x - 1, y - 8)
			|| this.block(x + 1, y + 24) && !this.block(x + 1, y - 8);
	}
}

// entry points called from the demo playback
export default {
	// SpawnBlood()
	spawnBlood(g, player) {
		g.weapons.add(new Blood(g, player, 3 - random(6), random(30) - 5));
	},

	// DDEMO_DAMAGEPLAYER, ext = 0: the number of blood objects by the weapon of the attacker
	damageBlood(g, player, attwpn) {
		var count = { 1: 1, 2: 4, 5: 1, 6: 4, 7: 2, 3: 4, 4: 4, 8: 4, 0: 4 }[attwpn] || 0;
		for (var i = 0; i < count; i++)
			this.spawnBlood(g, player);
		if (attwpn == 0)
			Sound.play('fire_gauntl2');
	},

	// DDEMO_DAMAGEPLAYER with health <= GIB_DEATH: OPT_MEATLEVEL = 1
	gib(g, player) {
		Sound.play(random(2) == 0 ? 'gib1' : 'gib2');
		for (var i = 0; i < 4; i++)
			g.weapons.add(new Gib(g, player));
	},

	// SpawnCorpse(), DDEMO_CORPSESPAWN
	spawnCorpse(g, player) {
		g.weapons.add(new Corpse(g, player));
	},

	// a door closes: corpses in the region of the door die (object_region_touch)
	doorClosed(g, x, y, x1, y1) {
		var list = g.weapons.missiles;
		for (var i = 0; i < list.length; i++) {
			var f = list[i];
			if (f instanceof Corpse && f.dead < 2)
				if (f.x + 3 >= x * 32 && f.x - 3 <= x1 * 32 + 32 && f.y + 3 >= y * 16 && f.y - 3 <= y1 * 16 + 16)
					f.dead = 2;
		}
	}
};
