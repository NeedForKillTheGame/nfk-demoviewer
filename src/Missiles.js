import PIXI from "PIXI";
import Constants from "./Constants.js";
import Utils from "./Utils.js";
import Sound from "./Sound.js";

// Weapon objects of a demo playback, ported from TMonoSprite.DoMove() / TMonoSprite.Hit() of NFK 0.77
// (Unit1.pas of nfk-reconstruction). One tick() = one DoMove() call = 1/50 sec.
//
// NFK draws through PowerDraw: an angle is 0..255 per full turn, scale 256 is 1:1 and a colour is $AABBGGRR.
// Sprites that are missing in the viewer resources (smoke32b, shaft, railtrace, 8x8 shots) are approximated.

var round = Utils.round;
var trunc = Utils.trunc;

var cosTable = [];
var sinTable = [];
for (var i = 0; i <= 360; i++) {
	cosTable[i] = Math.cos(i * Math.PI / 180);
	sinTable[i] = Math.sin(i * Math.PI / 180);
}

// rail colours of the players (ACOLOR[1..8] in NFK)
var ACOLOR = [0, 0x0000FF, 0x00FF00, 0x00FFFF, 0xFF2525, 0xFFFF00, 0xFF00FF, 0xFFFFFF, 0x000000];
function railColor(index) {
	return ACOLOR[index] === undefined ? 0xFFFFFF : ACOLOR[index];
}

// $AABBGGRR -> 0xRRGGBB
function tint(color) {
	return ((color & 0xFF) << 16) | (color & 0xFF00) | ((color >> 16) & 0xFF);
}

function alpha(color) {
	return ((color >>> 24) & 0xFF) / 255;
}

// Delphi random(n): 0..n-1
function random(n) {
	return Math.floor(Math.random() * n);
}

// index of CosTable/SinTable for a NFK angle in degrees (0 = up, clockwise)
function angleIndex(fangle) {
	var angle = round(fangle - 90);
	if (angle < 0)
		angle = 360 + angle;
	return angle;
}

// PowerDraw angle (0..255) -> PIXI rotation of a sprite which looks to the right
function rotation(units) {
	return units * Math.PI * 2 / 256 - Math.PI / 2;
}

// base class of all weapon objects (aaa[] TMonoSprite in NFK)
class Missile {
	constructor(g, layer) {
		this.g = g;
		this.layer = layer; // topdraw: 0 - under players, 1 - missiles, 2 - explosions and shots
		this.dead = 0; // 0 - alive, 1 - dying (Hit), 2 - removed
		this.DXID = 0;
		this.x = 0;
		this.y = 0;
		this.sprites = [];
	}

	// texture is drawn with its center in the position
	addSprite(texture, additive, container) {
		var sprite = new PIXI.Sprite(texture);
		sprite.anchor.set(0.5);
		sprite.visible = false;
		if (additive)
			sprite.blendMode = PIXI.BLEND_MODES.ADD;
		(container || this.container()).addChild(sprite);
		this.sprites.push(sprite);
		return sprite;
	}

	addGraphics() {
		var graphics = new PIXI.Graphics();
		this.container().addChild(graphics);
		this.sprites.push(graphics);
		return graphics;
	}

	container() {
		return this.layer == 0 ? this.g.render.mapGraphics : this.g.render.fxLayer;
	}

	// RotateEffect(image, x, y, angle, scale, color, ...), angleUnits = null for RenderEffect without a rotation
	draw(sprite, x, y, angleUnits, scale, color) {
		sprite.visible = true;
		sprite.x = x;
		sprite.y = y;
		sprite.rotation = angleUnits === null ? 0 : rotation(angleUnits);
		sprite.scale.set(scale / 256);
		sprite.tint = color === undefined ? 0xFFFFFF : tint(color);
		sprite.alpha = 1;
	}

	// bbb[].block and bbb[].image <> 37: missiles fly through the invisible "empty" brick
	isSolid(x, y) {
		return this.g.map.isShotBlock(trunc(x / 32), trunc(y / 16));
	}

	// CheckClip(): a corner of the clippixel square is in a brick
	checkClip(clippixel) {
		var half = trunc(clippixel / 2);
		return this.isSolid(this.x - clippixel, this.y - clippixel)
			|| this.isSolid(this.x + clippixel, this.y + clippixel)
			|| this.isSolid(this.x - clippixel, this.y + clippixel)
			|| this.isSolid(this.x + clippixel, this.y - clippixel)
			|| this.isSolid(this.x - half, this.y - half)
			|| this.isSolid(this.x + half, this.y + half)
			|| this.isSolid(this.x - half, this.y + half)
			|| this.isSolid(this.x + half, this.y - half);
	}

	// CheckClipRail()
	checkClipRail() {
		return this.g.map.isShotBlock(trunc(round(this.x) / 32), trunc(round(this.y) / 16));
	}

	destroy() {
		for (var i = 0; i < this.sprites.length; i++) {
			if (this.sprites[i].parent)
				this.sprites[i].parent.removeChild(this.sprites[i]);
			this.sprites[i].destroy();
		}
		this.sprites = [];
	}
}

// rocket, BFG and an exploded grenade
export class Rocket extends Missile {
	constructor(g, spawner, x, y, angle, DXID, bfg) {
		super(g, 1);
		this.spawner = spawner;
		this.x = x;
		this.y = y;
		this.fangle = angle < 0 ? 360 + angle : angle;
		this.DXID = DXID;
		this.bfg = bfg; // fallt = 1
		this.fspeed = bfg ? 7 : 6;
		this.health = 50 * 15; // 10secs before timeout
		this.doublejump = 0; // the missile is drawn from the third tick
		this.frame = 0;

		this.glow = this.addSprite(g.resources.glow.texture, true);
		this.body = this.addSprite(g.resources.bullets.textures[bfg ? 'tile008.png' : 'tile005.png'], bfg);
	}

	tick() {
		if (this.dead == 1) {
			this.hit();
			return;
		}

		this.glow.visible = this.body.visible = false;

		if (this.health > 0)
			this.health--;
		else
			this.dead = 2;

		// clippixel = 0 for a demo missile: explode when the center enters a brick
		if (this.checkClip(0)) {
			this.explode(this.x, this.y);
			this.layer = 2; // explosion is drawn in this tick on top of the missiles
			return;
		}

		var angle = angleIndex(this.fangle);
		var z = this.x - this.fspeed / 2 * cosTable[angle];
		var a = this.y - this.fspeed / 2 * sinTable[angle];
		this.x = this.x + this.fspeed * cosTable[angle];
		this.y = this.y + this.fspeed * sinTable[angle];
		if (this.x < 24) this.x = 24;
		if (this.y < 12) this.y = 12;

		if (this.doublejump < 2) {
			this.doublejump++;
			return;
		}

		if (this.bfg) {
			this.draw(this.glow, z, a, 0, 384, 0xAA55FF55);
			this.draw(this.body, this.x, this.y, trunc(256 / 360 * this.fangle), 256, 0xAA55FFFF);
			this.body.alpha = alpha(0xAA55FFFF);
		} else if (!this.checkClip(0)) {
			this.draw(this.glow, z, a, 0, 384, 0xFF60D0FF);
			this.g.weapons.add(new Smoke(this.g, round(z), round(a)));
			this.draw(this.body, this.x, this.y, trunc(256 / 360 * this.fangle), 256);
		}
	}

	explode(x, y) {
		this.dead = 1;
		this.frame = 0;
		this.x = x;
		this.y = y;
		this.fangle = random(256);
	}

	// explosion: 32 ticks, a frame of the explosion animation per 4 ticks
	hit() {
		if (this.frame == 32) {
			this.dead = 2;
			return;
		}

		if (!this.explosion) {
			this.body.visible = false;
			this.explosion = this.addSprite(this.g.resources.explosion.spritesheet.animations.explosion[0], true);
		}

		// r_fx_explo
		if (this.bfg) {
			this.draw(this.glow, this.x, this.y, 0, 512 - 16 * this.frame, 0x2255FF55);
		} else {
			this.draw(this.glow, this.x, this.y, 0, 512 - this.frame * 16, 0x60D0FF);
			this.glow.alpha = (255 - 4 * this.frame) / 255;
		}

		this.explosion.texture = this.g.resources.explosion.spritesheet.animations.explosion[trunc(this.frame / 4)];
		this.draw(this.explosion, this.x, this.y, this.fangle, 256, this.bfg ? 0xFF55FF55 : undefined);

		if (this.frame == 0)
			Sound.play('expl');

		this.frame++;
	}
}

export class Plasma extends Missile {
	constructor(g, spawner, x, y, angle, DXID) {
		super(g, 1);
		this.spawner = spawner;
		this.x = x;
		this.y = y;
		this.fangle = angle < 0 ? 360 + angle : angle;
		this.DXID = DXID;
		this.fspeed = spawner.hasPowerup(Constants.IT_POWERUP_HASTE) ? 9 : 7;
		this.health = 50 * 15; // 10secs before timeout
		this.doublejump = 0;

		this.glow = this.addSprite(g.resources.glow.texture, true);
	}

	tick() {
		var angle = angleIndex(this.fangle);
		if (!this.checkClipRail()) {
			this.x = this.x + this.fspeed * cosTable[angle];
			this.y = this.y + this.fspeed * sinTable[angle];
			if (this.x < 24) this.x = 24;
			if (this.y < 12) this.y = 12;
		}

		if (this.health > 0)
			this.health--;
		else
			this.dead = 2;

		if (this.checkClipRail() || this.checkClipPlayer()) {
			// impact flash, no sound in 0.77
			this.g.weapons.add(new Particle(this.g, this.x, this.y, 80, 5, 0xFFFFFF00, 0xC8, 10, true, 1));
			this.dead = 2;
		}

		// r_fx_plasma: a single glow
		if (this.doublejump >= 2)
			this.draw(this.glow, this.x, this.y, 0, 96, 0xFFFFFF00);
		else
			this.doublejump++;
	}

	// checkclipplayer_plasma()
	checkClipPlayer() {
		var players = this.g.players;
		for (var i = 0; i < players.length; i++) {
			var p = players[i];
			var vclip = p.crouch ? 8 : 24;
			if (this.x > p.x - 12 && this.x < p.x + 12 && this.y > p.y - vclip && this.y < p.y + 22
				&& p.dead == 0 && p != this.spawner && !p.isSpectator())
				return true;
		}
		return false;
	}
}

// grenade bounces by its own physics in a demo and explodes only by DDEMO_KILLOBJECT
export class Grenade extends Rocket {
	constructor(g, spawner, x, y, inertiaX, inertiaY, dir, angle, DXID) {
		super(g, spawner, x, y, angle, DXID, false);
		this.inertiaX = inertiaX;
		this.inertiaY = inertiaY;
		this.dir = dir;
		this.mass = 2.5;
		this.clippixel = 4;
		this.imageindex = 255; // 5 secs before timeout
		this.health = 0;
		this.body.texture = g.resources.bullets.textures['tile006.png'];
	}

	tick() {
		if (this.dead == 1) {
			this.hit();
			return;
		}

		this.body.visible = false;

		if (this.imageindex > 0)
			this.imageindex--;
		else
			this.dead = 2;

		this.frame++;
		if (this.frame >= 102)
			this.frame = 102;

		// smoke trail every second tick
		if (this.frame >= 6 && this.frame < 100) {
			if (this.doublejump == 0) {
				this.g.weapons.add(new Smoke(this.g, round(this.x), round(this.y)));
				this.doublejump = 1;
			} else {
				this.doublejump--;
			}
		}

		this.physics();

		if (this.frame >= 6)
			this.draw(this.body, this.x, this.y, trunc(256 / 360 * this.fangle), 256);
	}

	explode(x, y) {
		super.explode(x, y);
		this.layer = 2; // explosion to the top
	}

	// GrenadePhysics()
	physics() {
		var c = this.clippixel;
		if (this.inertiaY == 0 && this.inertiaX == 0)
			return;
		if (this.inertiaY > -0.3 && this.inertiaY < 0.3 && this.inertiaX > -0.3 && this.inertiaX < 0.3
			&& this.g.map.isBlock(trunc(this.x / 32), trunc((this.y + c) / 16))) {
			this.inertiaX = 0;
			return;
		}

		this.inertiaY = this.inertiaY + 0.02 * this.mass; // Gravity*mass

		if (this.inertiaY < 0)
			this.inertiaY = this.inertiaY / 1.025; // stopspeed.
		this.inertiaX = this.inertiaX / 1.003; // stopspeed.

		this.x = this.x + this.inertiaX;
		this.y = this.y + this.inertiaY;

		if (this.x < 24) this.x = 24;
		if (this.y < 12) this.y = 12;

		if (this.health < 255)
			this.health++;

		// CLIPPING
		if (this.isSolid(this.x - c, this.y)) {
			if (this.inertiaX < 0) this.inertiaX = Math.abs(this.inertiaX);
			this.bounce();
			this.inertiaX = this.inertiaX / 1.07; // GRENADE_SLOWSPEED
			this.dir = 0;
		} else if (this.isSolid(this.x + c, this.y)) {
			if (this.inertiaX > 0) this.inertiaX = -this.inertiaX;
			this.bounce();
			this.inertiaX = this.inertiaX / 1.07;
			this.dir = 1;
		}
		if (this.isSolid(this.x, this.y - c)) { // boom ceil
			if (this.inertiaY < 0) this.inertiaY = Math.abs(this.inertiaY);
			this.bounce();
			this.inertiaX = this.inertiaX / 1.07;
		} else if (this.isSolid(this.x, this.y + c)) { // boom floor
			if (this.inertiaY > 0) this.inertiaY = -this.inertiaY;
			this.bounce();
			this.inertiaX = this.inertiaX / 1.07;
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

	// GrenadeBounce()
	bounce() {
		if (this.health > 12 && this.inertiaY != 0) {
			Sound.play('bounce');
			this.health = 0;
		}
	}

	// onbrick_gren()
	onBrick() {
		var c = this.clippixel;
		var map = this.g.map;
		return !map.isBlock(trunc((this.x - c) / 32), trunc(this.y / 16)) && this.isSolid(this.x - c, this.y + c)
			|| !map.isBlock(trunc((this.x + c) / 32), trunc(this.y / 16)) && this.isSolid(this.x + c, this.y + c)
			|| this.isSolid(this.x, this.y);
	}
}

// rail trace from (x, y) near the muzzle to the hit point (cx, cy)
export class RailTrail extends Missile {
	// moving = true for DDEMO_FIRERAIL (it goes through DoMove and leaves the hit mark), false for DDEMO_NETRAIL
	constructor(g, x, y, cx, cy, color, moving) {
		super(g, 1);
		this.x = x;
		this.y = y;
		this.cx = cx;
		this.cy = cy;
		this.fallt = color;
		this.frame = 0;
		this.dead = moving ? 0 : 1;
		this.graphics = this.addGraphics();
	}

	tick() {
		this.trace();
		if (this.dead == 0) {
			this.dead = 1;
			// rail impact mark, tinted with the player colour, under the bricks
			this.g.weapons.add(new Particle(this.g, this.cx, this.cy, (6 + 4) * 6, 0, railColor(this.fallt), 0xDD,
				Constants.FPS * 30, false, 0, this.g.resources.railhit.texture, 64)); // r_markstime 30 secs
			return;
		}
		if (this.frame >= 10) // rail_trailtime
			this.dead = 2;
		else
			this.frame++;
	}

	// RailPostTrace() with r_fx_rail 1 and progressive alpha. The alpha byte overflows at frame 0
	// ((256 shl 24) = 0), so the first frame is invisible exactly like in NFK.
	// The railtrace sprite beam is approximated with lines, beam width = (r_railwidth + 4) div 2.
	trace() {
		var a = (256 - round(255 * this.frame / 10)) & 0xFF;
		var color = tint(railColor(this.fallt));
		this.graphics.clear();
		if (a == 0)
			return;
		this.graphics.lineStyle(5, color, a / 255 / 2);
		this.graphics.moveTo(trunc(this.cx), trunc(this.cy));
		this.graphics.lineTo(trunc(this.x), trunc(this.y));
		this.graphics.lineStyle(2, color, a / 255);
		this.graphics.moveTo(trunc(this.cx), trunc(this.cy));
		this.graphics.lineTo(trunc(this.x), trunc(this.y));
	}
}

// bullet impact of the shotgun ('shots') or the machinegun ('shots2'): 3 frames of 10 ticks
export class Shot extends Missile {
	constructor(g, x, y, machinegun) {
		super(g, 2);
		this.machinegun = machinegun;
		this.cx = x + 4 - random(8);
		this.cy = y + 4 - random(8);
		this.frame = 0;
		this.sprite = this.addSprite(g.resources.bullets.textures['tile000.png'], true); // r_transparentbulletmarks
	}

	tick() {
		var dir;
		this.frame++;
		if (this.frame <= 10) dir = 0;
		else if (this.frame <= 20) dir = 1;
		else {
			dir = 2;
			if (this.frame > 30)
				this.dead = 2;
		}
		this.sprite.texture = this.g.resources.bullets.textures['tile00' + dir + '.png'];
		if (this.machinegun) {
			// 8x8 sprite at (cx-4, cy-4), approximated with the shotgun one at half size
			this.draw(this.sprite, trunc(this.cx), trunc(this.cy), null, 128);
		} else {
			// 16x16 sprite at (cx-4, cy-4)
			this.draw(this.sprite, trunc(this.cx) + 4, trunc(this.cy) + 4, null, 256);
		}
	}
}

// smoke trail of rockets and grenades (SpawnSmoke with r_fx_smoke 1), the smoke32b sprite is approximated with the glow
export class Smoke extends Missile {
	constructor(g, x, y) {
		super(g, 0);
		this.x = x;
		this.y = y;
		this.frame = 0;
		this.fangle = random(255);
		this.sprite = this.addSprite(g.resources.glow.texture, true);
	}

	tick() {
		if (this.frame > 30)
			this.dead = 2;
		this.frame++;
		this.draw(this.sprite, round(this.x), round(this.y), this.fangle, 48 - trunc(this.frame / 3), 0xFFFFFF);
		this.sprite.alpha = this.frame < 31 ? (255 - this.frame * 8) / 255 : 0;
	}
}

// TPartEngine element: alpha fades out during the lifetime, the scale changes each tick
export class Particle extends Missile {
	constructor(g, x, y, scale, scaleDelta, color, baseAlpha, ticks, additive, layer, texture, textureSize, velY) {
		super(g, layer ? 2 : 0);
		this.x = x;
		this.y = y;
		this.scale = scale;
		this.scaleDelta = scaleDelta;
		this.color = color & 0xFFFFFF;
		this.baseAlpha = baseAlpha;
		this.ticks = ticks;
		this.life = ticks;
		this.velY = velY || 0;
		this.angle = random(255);
		// the size of the original sprite, if the viewer has it in another size
		this.textureScale = textureSize ? textureSize / (texture.width || textureSize) : 1;
		this.sprite = this.addSprite(texture || g.resources.glow.texture, additive,
			layer ? g.render.fxLayer : g.render.mapGraphics);
		if (!layer) {
			// decals are under the bricks
			g.render.mapGraphics.setChildIndex(this.sprite, 0);
		}
		this.update();
	}

	tick() {
		this.y = this.y + this.velY;
		this.scale = this.scale + this.scaleDelta;
		this.life--;
		if (this.life <= 0)
			this.dead = 2;
		this.update();
	}

	update() {
		this.draw(this.sprite, round(this.x), round(this.y), this.angle, this.scale * this.textureScale, this.color);
		this.sprite.alpha = round(this.baseAlpha * this.life / this.ticks) / 255;
	}
}

// lightning beam of a player (objname 'shaft2' since 0.75, 'shaft' for old demos)
export class ShaftBeam extends Missile {
	// legacy = old demo (DDEMO_FIRESHAFT): the angle and the length are recorded, the beam lives 3 ticks
	constructor(g, spawner, ammo, legacy, angle, length) {
		super(g, 1);
		this.spawner = spawner;
		this.imageindex = ammo + 1;
		this.legacy = legacy;
		this.frame = 0;
		this.fangle = angle || 0;
		this.fallt = length || 0;
		this.graphics = this.addGraphics();
	}

	tick() {
		var p = this.spawner;
		var weapony = p.crouch ? 3 : -5;

		if (this.legacy) {
			this.x = trunc(p.x);
			this.y = p.crouch ? trunc(p.y + 3) : trunc(p.y - 5);
			if (p.dead > 0 || p.weapon.itemId != Constants.C_WPN_SHAFT)
				this.dead = 2;
			if (this.frame < 3)
				this.frame++;
			else
				this.dead = 2;
		} else {
			p.shaftframe = (p.shaftframe + 1) % 16;
			// a network player is drawn and shoots from the smoothed position
			this.x = p.testX;
			this.y = p.testY + weapony;
			if (p.dir == Constants.DIR_RW || p.dir == Constants.DIR_RS)
				this.fangle = (p.nfkAngle - 1) * 360 / 254;
			else
				this.fangle = p.nfkAngle * 360 / 254;

			p.shaftsttime += 2;
			if (p.shaftsttime >= 22) {
				Sound.play('fire_shaft');
				p.shaftsttime = 2;
			}

			if (this.imageindex > 0)
				this.imageindex--;
			if (this.imageindex == 0) {
				this.dead = 2;
				p.shaft_state = 0;
			}
			if (p.dead > 0 || p.weapon.itemId != Constants.C_WPN_SHAFT) {
				p.shaft_state = 0;
				this.dead = 2;
			}
		}

		this.trace();

		if (!this.legacy && p.shaft_state == 0)
			this.dead = 2;
	}

	// VectorTraceVectorTrace(): 1px steps until a brick, a player or the shaft length
	trace() {
		var ox = this.x, oy = this.y;
		var x = this.x, y = this.y;
		var sh = 0;
		var max = this.spawner.hasPowerup(Constants.IT_POWERUP_HASTE) ? 150 + 25 : 150; // SHAFT_DIST
		var angle = angleIndex(this.fangle);
		while (true) {
			x = x + cosTable[angle];
			y = y + sinTable[angle];
			sh++;
			if (sh >= max)
				break;
			if (this.legacy && sh >= this.fallt)
				break;
			if (this.g.map.isShotBlock(trunc(round(x) / 32), trunc(round(y) / 16)))
				break;
			if (this.checkClipPlayer(x, y))
				break;
		}

		// r_fx_shaft beam: the shaft sprite is approximated with lines
		this.graphics.clear();
		this.graphics.lineStyle(6, 0x00FFFF, 0.35);
		this.graphics.moveTo(trunc(ox), trunc(oy));
		this.graphics.lineTo(trunc(x), trunc(y));
		this.graphics.lineStyle(2, 0xFFFFFF, 1);
		this.graphics.moveTo(trunc(ox), trunc(oy));
		this.graphics.lineTo(trunc(x), trunc(y));
	}

	// checkclipplayer_rail_dude() (its y limit is uninitialized in NFK, 23 is taken from checkclipplayer_rail)
	checkClipPlayer(x, y) {
		var players = this.g.players;
		for (var i = 0; i < players.length; i++) {
			var p = players[i];
			var xx = p.crouch ? -6 : -22;
			if (x > p.x - 9 && x < p.x + 9 && y > p.y + xx && y < p.y + 23
				&& p.dead == 0 && p != this.spawner && !p.isSpectator())
				return true;
		}
		return false;
	}
}

// powerup sprites by the index of a dropped powerup (Images[70+dir] in NFK)
var POWERUP_ANIMATIONS = ['regen', 'battle', 'haste', 'quad', 'fly', 'invis'];

// weapon or powerup dropped by a killed player: it falls by its own physics in a demo
// (WPN_ProcessWeaponPhysics, POWERUP_ProcessPowerupPhysics) and is picked up by DDEMO_WPN_EVENT_PICKUP, DDEMO_POWERUP_EVENT_PICKUP
export class DroppedItem extends Missile {
	// weapon: imageindex = weapon id, powerup: dir = powerup index, imageindex = seconds
	constructor(g, powerup, DXID, x, y, inertiaX, inertiaY, dir, imageindex) {
		super(g, 1);
		this.powerup = powerup;
		this.DXID = DXID;
		this.x = x;
		this.y = y;
		this.inertiaX = inertiaX;
		this.inertiaY = inertiaY;
		this.dir = dir;
		this.imageindex = imageindex;
		this.mass = 5;
		this.health = 50 * 60 + 50 * 10; // one minute. + 10 sec.. (cuz networked removal).

		if (powerup) {
			this.sprite = new PIXI.AnimatedSprite(g.resources.powerup.spritesheet.animations[POWERUP_ANIMATIONS[dir]]);
			this.sprite.anchor.set(0.5);
			this.sprite.animationSpeed = 0.26; // a frame per 64 ms
			this.sprite.play();
			this.container().addChild(this.sprite);
			this.sprites.push(this.sprite);
		} else {
			// the items sheet: frame imageindex - 1
			this.sprite = this.addSprite(g.resources.items.textures['item-' + (imageindex - 2) + '.png']);
		}
	}

	tick() {
		var map = this.g.map;

		// killed by lava, or death (a weapon in a demo is not)
		if (this.powerup) {
			var content = map.bricks[trunc(this.x / 32)] && map.bricks[trunc(this.x / 32)][trunc(this.y / 16)];
			if (content == Constants.IT_LAVA || content == Constants.IT_DEATH)
				this.health = 0;
		}

		// timed out, removing..
		if (this.health > 0)
			this.health--;
		else
			this.dead = 2;

		this.physics();

		// RotateEffectFix(.., x, y - 6, 65 or mirrored 64, ..)
		this.draw(this.sprite, trunc(this.x), trunc(this.y) - 6, this.powerup || this.dir == 1 ? 65 : 64, 256);
		if (!this.powerup && this.dir == 0)
			this.sprite.scale.x = -1;
	}

	isBlock(x, y) {
		return this.g.map.isBlock(trunc(x / 32), trunc(y / 16));
	}

	physics() {
		if (this.inertiaY == 0 && this.inertiaX == 0)
			return;

		if (this.inertiaY > -0.3 && this.inertiaY < 0.3 && this.inertiaX > -0.3 && this.inertiaX < 0.3 && this.isBlock(this.x, this.y + 2)) {
			this.inertiaX = 0;
			return;
		}

		this.inertiaY = this.inertiaY + 0.02 * this.mass; // Gravity*mass

		if (this.inertiaY < 0)
			this.inertiaY = this.inertiaY / 1.025; // stopspeed.
		this.inertiaX = this.inertiaX / 1.003; // stopspeed.

		this.x = this.x + this.inertiaX;
		this.y = this.y + this.inertiaY;

		// CLIPPING
		if (this.isBlock(this.x - 7, this.y) || this.isBlock(this.x + 7, this.y))
			this.inertiaX = 0;
		if (this.isBlock(this.x, this.y - 12)) { // boom ceil
			if (this.inertiaY < 0) this.inertiaY = Math.abs(this.inertiaY);
			this.inertiaX = this.inertiaX / 1.07; // GRENADE_SLOWSPEED
		}
		if (this.isBlock(this.x, this.y)) { // boom floor
			this.y = trunc(round(this.y) / 16) * 16 - 1; // correcting to floor.
			this.inertiaY = 0;
			this.inertiaX = 0;
		}

		if (this.inertiaY < -5) this.inertiaY = -5;
		if (this.inertiaY > 5) this.inertiaY = 5;
		if (this.inertiaX < -7) this.inertiaX = -7;
		if (this.inertiaX > 7) this.inertiaX = 7;

		if (this.inertiaX < 0.01 && this.inertiaX > -0.01 && this.onBrick()) this.inertiaX = 0;
		if (this.inertiaY < 0.02 && this.inertiaY > -0.02 && this.onBrick()) this.inertiaY = 0;
	}

	// onbrick_flag()
	onBrick() {
		return !this.isBlock(this.x - 4, this.y) && this.isSolid(this.x - 4, this.y + 4)
			|| !this.isBlock(this.x + 4, this.y) && this.isSolid(this.x + 4, this.y + 4)
			|| this.isSolid(this.x, this.y);
	}
}

export { cosTable, sinTable, angleIndex };
