import Constants from "./Constants.js";
import Sound from "./Sound.js";
import { Rocket, Plasma, Grenade, RailTrail, Shot, Particle, ShaftBeam, cosTable, sinTable, angleIndex } from "./Missiles.js";

// Weapon events of a demo, ported from the demo playback of NFK 0.77: DEMOPLAREC() calls Fire*() procedures
// (FireRocket, FireGren, ...), which in MATCH_DDEMOPLAY take the recorded missile instead of the player aim.
export default
class Weapons {
	constructor(g) {
		this.g = g;
		this.missiles = []; // aaa[] objects of NFK
	}

	add(missile) {
		this.missiles.push(missile);
		return missile;
	}

	// DoMove() of all objects of one draw layer (topdraw), objects spawned in this pass move from the next tick
	tick(layer) {
		var count = this.missiles.length;
		for (var i = 0; i < count; i++) {
			var m = this.missiles[i];
			if (m.layer == layer && m.dead < 2)
				m.tick();
		}
	}

	// remove objects that died in the previous tick (they still were drawn in that tick)
	removeDead() {
		for (var i = this.missiles.length - 1; i >= 0; i--) {
			if (this.missiles[i].dead == 2) {
				this.missiles[i].destroy();
				this.missiles.splice(i, 1);
			}
		}
	}

	clear() {
		for (var i = 0; i < this.missiles.length; i++)
			this.missiles[i].destroy();
		this.missiles = [];
	}

	findPlayer(DXID) {
		for (var i = 0; i < this.g.players.length; i++) {
			if (this.g.players[i].DXID == DXID)
				return this.g.players[i];
		}
		return null;
	}

	findMissile(DXID, type) {
		for (var i = 0; i < this.missiles.length; i++) {
			var m = this.missiles[i];
			if (m.dead < 2 && m.DXID == DXID && (!type || m instanceof type))
				return m;
		}
		return null;
	}

	// quad damage sound once per second
	quadSound(player) {
		if (player.hasPowerup(Constants.IT_POWERUP_QUAD) && player.item_quad_time == 0) {
			Sound.play('damage3');
			player.item_quad_time = 50;
		}
	}

	// DDEMO_FIREROCKET, DDEMO_FIREBFG
	fireRocket(d, bfg) {
		var p = this.findPlayer(d.spawnerDxid);
		if (!p)
			return;
		Sound.play(bfg ? 'fire_bfg' : 'fire_rocket');
		this.quadSound(p);
		this.add(new Rocket(this.g, p, d.x, d.y, d.inertiax, d.DXID, bfg));
	}

	// DDEMO_FIREPLASMA, DDEMO_FIREPLASMAV2
	firePlasma(d) {
		var p = this.findPlayer(d.spawnerDxid);
		if (!p)
			return;
		Sound.play('fire_plasma');
		this.quadSound(p);
		this.add(new Plasma(this.g, p, d.x, d.y, d.inertiax, d.DXID));
	}

	// DDEMO_FIREGREN (old), DDEMO_FIREGRENV2
	fireGrenade(d) {
		var p = this.findPlayer(d.spawnerDxid);
		if (!p)
			return;
		Sound.play('fire_gren');
		this.quadSound(p);
		this.add(new Grenade(this.g, p, d.x, d.y, d.inertiax, d.inertiay, d.dir, d.angle, d.DXID));
	}

	// DDEMO_FIRERAIL: x,y = start of the trace, inertiax,inertiay = hit point, dir = colour
	fireRail(d) {
		var p = this.findPlayer(d.spawnerDxid);
		if (!p)
			return;
		this.quadSound(p);
		Sound.play('fire_rail');
		this.add(new RailTrail(this.g, d.x, d.y, d.inertiax, d.inertiay, d.dir, true));
	}

	// DDEMO_NETRAIL (client demo)
	netRail(d) {
		Sound.play('fire_rail');
		this.add(new RailTrail(this.g, d.x, d.y, d.endx, d.endy, d.color, false));
	}

	// DDEMO_FIRESHOTGUN: x,y = hit point
	fireShotgun(d) {
		var p = this.findPlayer(d.spawnerDxid);
		if (!p)
			return;
		Sound.play('fire_shotgun');
		this.muzzleSmoke(p);
		this.quadSound(p);
		this.add(new Shot(this.g, d.x, d.y, false));
		this.add(new Shot(this.g, d.x, d.y, false));
	}

	// DDEMO_FIREMACH: x,y = hit point
	fireMachine(d) {
		var p = this.findPlayer(d.spawnerDxid);
		if (!p)
			return;
		p.spinMachinegun();
		Sound.play('fire_mach');
		this.quadSound(p);
		this.add(new Shot(this.g, d.x, d.y, true));
	}

	// DDEMO_NETPARTICLE (client demo): index 1 = machinegun, 2 = shotgun
	netParticle(d) {
		if (d.index == 1) {
			this.add(new Shot(this.g, d.x, d.y, true));
			Sound.play('fire_mach');
		}
		if (d.index == 2) {
			this.add(new Shot(this.g, d.x, d.y, false));
			Sound.play('fire_shotgun');
		}
	}

	// DDEMO_REMOTEFIRE (0.77 client demo): subtype 1 = machinegun, 2 = shotgun
	remoteFire(d) {
		var p = this.findPlayer(d.DXID !== undefined ? d.DXID : d.dxid);
		if (!p)
			return;
		if (d.subtype == 1) {
			p.spinMachinegun();
			this.add(new Shot(this.g, d.x, d.y, true));
			Sound.play('fire_mach');
		}
		if (d.subtype == 2) {
			this.add(new Shot(this.g, d.x, d.y, false));
			this.muzzleSmoke(p);
			Sound.play('fire_shotgun');
		}
	}

	// shotgun smoke rises from the muzzle, 20px forward along the aim (r_fx_shotgun)
	muzzleSmoke(p) {
		var weapony = p.crouch ? 3 : -5;
		var angle = angleIndex(p.nfkAngle * 360 / 255);
		var velY = (-25 - Math.floor(Math.random() * 25)) / 75;
		this.add(new Particle(this.g, p.x + cosTable[angle] * 20, p.y + weapony + sinTable[angle] * 20,
			64, -0.33, 0xFFFFFF, 0x99, 30, true, 1, null, null, velY));
	}

	// DDEMO_KILLOBJECT: a missile exploded (or plasma disappeared) at the recorded point
	killObject(d) {
		var m = this.findMissile(d.DXID);
		if (!m)
			return;
		if (m instanceof Plasma) {
			m.dead = 2; // plazma-just remove
			return;
		}
		if (m.explode)
			m.explode(d.x, d.y);
	}

	// DDEMO_GRENADESYNC
	grenadeSync(d) {
		var m = this.findMissile(d.DXID, Grenade);
		if (!m || m.dead != 0)
			return;
		m.x = d.x;
		m.y = d.y;
		m.inertiaX = d.inertiax;
		m.inertiaY = d.inertiay;
	}

	// DDEMO_NEW_SHAFTBEGIN: FireShaftEx()
	shaftBegin(d) {
		var p = this.findPlayer(d.DXID);
		if (!p)
			return;
		p.setWeapon(Constants.C_WPN_SHAFT);
		p.shaft_state = 0;
		var exists = false;
		for (var i = 0; i < this.missiles.length; i++) {
			var m = this.missiles[i];
			if (m.dead == 0 && m instanceof ShaftBeam && !m.legacy && m.spawner == p)
				exists = true;
		}
		if (!exists) {
			if (p.shaftsttime == 0) {
				Sound.play('fire_shaft_begin');
				p.shaftsttime = 2;
				this.quadSound(p);
			}
			this.add(new ShaftBeam(this.g, p, d.AMMO, false));
		}
		p.shaft_state = 1;
	}

	// DDEMO_NEW_SHAFTEND
	shaftEnd(d) {
		var p = this.findPlayer(d.DXID);
		if (p)
			p.shaft_state = 0;
	}

	// DDEMO_FIRESHAFT (old demo): FireShaft(), dir = length of the beam
	fireShaftLegacy(d) {
		var p = this.findPlayer(d.spawnerDxid);
		if (!p)
			return;
		if (p.shaftsttime == 0) {
			Sound.play('fire_shaft_begin');
			p.shaftsttime = 2;
			this.quadSound(p);
		}
		p.shaftframe = (p.shaftframe + 1) % 16;
		p.shaftsttime += 2;
		if (p.shaftsttime >= 22) {
			Sound.play('fire_shaft');
			p.shaftsttime = 2;
		}
		for (var i = 0; i < this.missiles.length; i++) {
			var m = this.missiles[i];
			if (m.dead == 0 && m instanceof ShaftBeam && m.legacy && m.spawner == p) {
				m.dead = 2;
				break;
			}
		}
		this.add(new ShaftBeam(this.g, p, 0, true, d.angle, d.dir));
	}
}
