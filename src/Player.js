import Map from "./Map.js";
import Utils from "./Utils.js";
import Constants from "./Constants.js";
import PlayerGraphics from "./PlayerGraphics.js";
import PlayerPhysics from "./Physics.js";
import Sound from "./Sound.js";
import Models from "./Models.js";
import WeaponGauntlet from "./objects/WeaponGauntlet.js";
import WeaponMachine from "./objects/WeaponMachine.js";
import WeaponShotgun from "./objects/WeaponShotgun.js";
import WeaponGrenade from "./objects/WeaponGrenade.js";
import WeaponRocket from "./objects/WeaponRocket.js";
import WeaponShaft from "./objects/WeaponShaft.js";
import WeaponRail from "./objects/WeaponRail.js";
import WeaponPlasma from "./objects/WeaponPlasma.js";
import WeaponBfg from "./objects/WeaponBfg.js";

export default
class Player {
    constructor(g, DXID, name) {
		this.g = g;
		this.stage = g.render.stage;
		this.map = g.map; // Map obj


		this.DXID = DXID;
        this.x = 0.0;
        this.y = 0.0;
		
        this.name = windows1251.decode(name); // FIXME: API service return 1251 instead of utf8 on different machines, so this a temporary hack
        this.displayName = Utils.filterNickName(this.name); // filtered name (without color codes)
        this.health = 0;
        this.armor = 0;
        this.frags = 0;
        this.ping = '0';
		
		this.follow = false; // follow camera
		
        this.velocityX = 0.0;
        this.velocityY = 0.0;
        
        this.crouch = false; //current crouch state
		this.dir = Constants.DIR_RS; // direction
		this.dead = 0; // 0 = alive, 1 or 2 = dead
		this.BALLOON = false; // FIXME: what's this ???
		this.team = Constants.C_TEAMNON;
		this.model = 'sarge'; // // use setModel() for change
        this.modelColor = 'default';
		this.nfkModel = { model: 'sarge', skin: 'default' }; // model and skin the player asked for (the drawn ones are model, modelColor)
		this.frame = 0; // walk animation frame (PlayerAnim)
		this.nextframe = 0; // ticks to the next walk frame
		this.frm = 0; // pattern of the model bitmap: 0 stands, 1.. walks
		this.ticks = 0; // game ticks, STIME = ticks * 20 ms
		this.paintime = 0; // no pain sound while counting down
		this.bodyangle = 0; // angle of the held weapon (PlayerWeaponAnim)
		this.mgun_angle = 0; // aim servo of the weapon
		this.mgun_lock = 1; // snap the servo to the aim
		this.mgun_firets = 0; // STIME till which the machinegun fires
		this.mgun_speed = 0;
		this.mgun_frametimer = 0;
		this.mgun_spin = 0; // machinegun barrel frame 0..5
        
		this.rewardtime = 0; //?
		this.fangle = 0; // angle of weapon
		this.nfkAngle = 0; // weapon angle 0..255 of NFK (fixed by the direction)

		// position where NFK draws a network (and demo) player: it follows x,y smoothly (TESTPREDICT_X/Y)
		this.testX = 0.0;
		this.testY = 0.0;

		// weapon state of NFK
		this.shaft_state = 0;
		this.shaftsttime = 0;
		this.shaftframe = 0;
		this.gantl_state = 0;
		this.gantl_s = 0;
		this.gauntl_s_order = 0;
		this.item_quad_time = 0;
		
		
		this.ammo_mg = 100; 
		this.ammo_sg = 0; 
		this.ammo_gl = 0; 
		this.ammo_rl = 0; 
		this.ammo_sh = 0; 
		this.ammo_rg = 0; 
		this.ammo_pl = 0; 
		this.ammo_bfg = 0;
		
        //Current state of pressed keys
        this.keyUp = false;
        this.keyDown = false;
        this.keyLeft = false;
        this.keyRight = false;


        this.doublejumpCountdown = 0;
        this.groundTicks = 0; // TPlayer.field_358: frames on the ground since landing, 255 right after a jump
        this.speedJump = 0;   // TPlayer.field_359: strafe-jump charge 0..6
		
		this.graphics = null; // PlayerGraphics	obj	
		this.physics = null; // PlayerPhysics obj	

        this.flag = null; // if true then player takes enemy flag

        // init graphics, physics
        this._init();

        // powerups: seconds left (item_quad etc. in NFK), set by DDEMO_EARNPOWERUP
        this.clearPowerups();
        this.item_regen_time = 0; // red flash after the regeneration
        this.item_battle_time = 0; // battle suit protection sound interval
        this.item_haste_time = 0; // haste smoke interval
        
        this.weapons = [
            new WeaponGauntlet(this.g, this),
            new WeaponMachine(this.g, this),
            new WeaponShotgun(this.g, this),
            new WeaponGrenade(this.g, this),
            new WeaponRocket(this.g, this),
            new WeaponShaft(this.g, this),
            new WeaponRail(this.g, this),
            new WeaponPlasma(this.g, this),
            new WeaponBfg(this.g, this)
        ];
		this.weapon = this.weapons[0]; // set machine default
        for (var w in this.weapons) {
            this.weapons[w].spawn();
        }
    }

	// init player graphics and physics
	_init()
	{
        this.graphics = new PlayerGraphics(this.g, this);
        this.physics = new PlayerPhysics(this.g, this);
	}
    

	height() {
		return this.crouch ? Constants.PLAYER_HEIGHT_CROUCH: Constants.PLAYER_HEIGHT;
	}
	width() {
		return Constants.PLAYER_WIDTH;
	}
	
	// player rectangle
	rect() {
		return {
			x1: this.x - (this.width() / 2)  + this.g.render.mapDx + 2,
			y1: this.y - (this.height() / 2) + this.g.render.mapDy + 1 + (this.crouch ? Constants.BRICK_HEIGHT / 2 : 0) + 2,
			x2: this.x + (this.width() / 2)  + this.g.render.mapDx - 2,
			y2: this.y + (this.height() / 2) + this.g.render.mapDy + 1 + (this.crouch ? Constants.BRICK_HEIGHT / 2 : 0) - 2,
		};
	}

	// model the player asked for, the drawn model is chosen by assignModel()
	setModel(model, skin) {
		this.nfkModel = { model: model, skin: skin };
		this.assignModel();
	}

	// ASSIGNMODEL of NFK: a team game forces the team skin, a missing model falls back to sarge
	assignModel() {
		var teamSkin = null;
		if (this.isTeamGame())
			teamSkin = this.team == Constants.C_TEAMRED ? 'red' : this.team == Constants.C_TEAMBLUE ? 'blue' : 'default';
		var drawn = Models.resolve(this.nfkModel.model, this.nfkModel.skin, teamSkin);
		this.model = drawn.model;
		this.modelColor = drawn.skin;
		this.frame = 0;
	}

	setWeapon(weaponId) {
        // TODO: switch weapon only if exists
        for (var w in this.weapons) {
            this.weapons[w].hide();
        }
        this.weapon = this.weapons[weaponId];
        if (this.dead == 0) {
            this.weapon.show();
        }
    }
	
    setCrouch(val) {
        if (this.crouch == val)
            return;

        this.crouch = val;
    }
    setDead(val) {
        if (this.dead == val)
            return;

        var wasDead = this.dead > 0;
        this.dead = val;
        if (wasDead && val == 0)
            this.mgun_lock = 1; // respawn: the weapon aims at once
        
        if (this.dead > 0) {
            Sound.playDeath(this);
            // hide weapon
            this.weapon.hide();
        }
        // drop flag
        if (this.flag) {
            // TODO: make flag physics so it can move onto the floor itself
            this.flag = null;
        }
    }

	// a player without a team in team based game types is a spectator
	isSpectator() {
		return this.isTeamGame() && this.team === Constants.C_TEAMNON;
	}

	isTeamGame() {
		var map = this.g.demo.data.Map;
		if (!map)
			return false;
		var gametype = map.Header.GAMETYPE;
		return gametype === Constants.GAMETYPE_TEAM
			|| gametype === Constants.GAMETYPE_CTF
			|| gametype === Constants.GAMETYPE_DOMINATION;
	}

	changeTeam(team){
		console.log("player " + this.name + " selected team " + team);
		this.team = team;
		this.graphics.container.visible = !this.isSpectator();
		if (this.isSpectator())
			this.follow = false;

		this.assignModel();
	}
	
    setX(newX) {
        this.x = newX;
    }

    setY(newY) {
        this.y = newY;
    }

    setXY(newX, newY) {
        this.x = newX;
        this.y = newY;
        this.testX = newX;
        this.testY = newY;
    }

    hasPowerup(itemId) {
        switch (itemId) {
            case Constants.IT_POWERUP_REGENERATION: return this.item_regen > 0;
            case Constants.IT_POWERUP_BATTLESUIT: return this.item_battle > 0;
            case Constants.IT_POWERUP_HASTE: return this.item_haste > 0;
            case Constants.IT_POWERUP_QUAD: return this.item_quad > 0;
            case Constants.IT_POWERUP_FLIGHT: return this.item_flight > 0;
            case Constants.IT_POWERUP_INVISIBILITY: return this.item_invis > 0;
        }
        return false;
    }

    clearPowerups() {
        this.item_quad = 0;
        this.item_regen = 0;
        this.item_battle = 0;
        this.item_flight = 0;
        this.item_haste = 0;
        this.item_invis = 0;
    }

    // DDEMO_EARNPOWERUP: type 1 regen, 2 flight, 3 battle, 4 haste, 5 quad, 6 invis
    setPowerup(type, time) {
        switch (type) {
            case 1: this.item_regen = time; break;
            case 2: this.item_flight = time; break;
            case 3: this.item_battle = time; break;
            case 4: this.item_haste = time; break;
            case 5: this.item_quad = time; break;
            case 6: this.item_invis = time; break;
        }
    }

    // POWERUP_GainPowerup(): a dropped powerup is picked up, index 0 regen, 1 battle, 2 haste, 3 quad, 4 flight, 5 invis
    gainPowerup(index, amount) {
        switch (index) {
            case 0: this.item_regen = amount; Sound.play('powerup_regen'); break;
            case 1: this.item_battle = amount; Sound.play('powerup_battle'); break;
            case 2: this.item_haste = amount; Sound.play('powerup_haste'); break;
            case 3: this.item_quad = amount; Sound.play('powerup_quad'); break;
            case 4: this.item_flight = amount; Sound.play('powerup_flight'); break;
            case 5: this.item_invis = amount; Sound.play('powerup_invis'); break;
        }
    }

    // every game second of a demo: powerups wear off, the regeneration sound
    powerupSecond() {
        if (this.dead != 0)
            return;
        if (this.item_regen > 0 && this.health < 200) {
            Sound.play('regen');
            this.item_regen_time = 15;
        }
        if (this.item_quad > 0) this.item_quad--;
        if (this.item_regen > 0) this.item_regen--;
        if (this.item_flight > 0) this.item_flight--;
        if (this.item_invis > 0) this.item_invis--;
        if (this.item_battle > 0) this.item_battle--;
        if (this.item_haste > 0) this.item_haste--;
    }

    // weapon angle of a demo position (wpnang 0..255), fixed like in NFK demo playback
    setWeaponAngle(wpnang) {
        this.nfkAngle = wpnang;
        if (this.dir == Constants.DIR_RW || this.dir == Constants.DIR_RS) {
            if (this.nfkAngle > 0x7F) this.nfkAngle = 0xFF - this.nfkAngle;
        } else {
            if (this.nfkAngle <= 0x7F) this.nfkAngle = 0xFF - this.nfkAngle;
        }
    }

    // STIME of NFK in milliseconds
    stime() {
        return this.ticks * 20;
    }

    // the player fires the machinegun: the barrel spins for 200 ms
    machinegunFired() {
        this.mgun_firets = this.stime() + 200;
    }

    // timers of a network player in playermove() of NFK and its gauntlet sound
    weaponTick() {
        this.ticks++;
        if (this.paintime > 0) this.paintime--;

        // barrel spin of the machinegun
        var stime = this.stime();
        if (this.mgun_firets > stime) {
            if (this.mgun_speed < 30) this.mgun_speed++;
        } else if (this.mgun_speed > 0) {
            this.mgun_speed--;
        }
        if (stime > this.mgun_frametimer && this.mgun_speed > 0) {
            this.mgun_frametimer = stime + 70 - Utils.round(this.mgun_speed * 1.5);
            this.mgun_spin++;
            if (this.mgun_spin >= 6) this.mgun_spin = 0;
        }

        if (this.shaftsttime > 0) this.shaftsttime--;
        if (this.gantl_s > 0) this.gantl_s--;
        if (this.item_quad_time > 0) this.item_quad_time--;
        if (this.item_regen_time > 0) this.item_regen_time--;
        if (this.item_battle_time > 0) this.item_battle_time--;
        if (this.item_haste > 0) {
            if (this.item_haste_time == 0) {
                this.g.weapons.spawnSmoke(Utils.round(this.x), Utils.round(this.y + 20));
                this.item_haste_time = 5;
            } else {
                this.item_haste_time--;
            }
        }

        if (this.weapon.itemId == Constants.C_WPN_GAUNTLET && this.gantl_state > 0) {
            // FireGauntlet(): rotor sound every 12 ticks
            if (this.gantl_s == 0) {
                Sound.play(this.gauntl_s_order == 0 ? 'fire_gauntl0' : 'fire_gauntl1');
                this.gauntl_s_order = this.gauntl_s_order == 0 ? 1 : 0;
                this.gantl_s = 12;
            }
            this.gantl_state++;
            if (this.gantl_state > 3) this.gantl_state = 1;
            this.gantl_state++;
            if (this.gantl_state > 3) this.gantl_state = 1;
        }
    }

    // PlayerAnim() of NFK for a network player: TESTPREDICT moves to x,y by a part of the distance each tick
    updateTestPredict(coordInterpolate) {
        this.testPredict(coordInterpolate);
        this.animTick();
    }

    testPredict(coordInterpolate) {
        if (coordInterpolate <= 0) {
            this.testX = this.x;
            this.testY = this.y;
            return;
        }
        var p = Math.fround(coordInterpolate); // net_coordinterpolate is "single"
        var d = Math.abs(this.testX - this.x);
        var i = Utils.trunc(Math.abs(d * (p / 2.5) - d * p));
        if (Utils.trunc(this.testX) != Utils.trunc(this.x) && i == 0) i = 1;
        this.testX = this.testX < this.x ? this.testX + i : this.testX - i;

        d = Math.abs(this.testY - this.y);
        i = Utils.trunc(Math.abs(d * (p / 3) - d * p));
        if (Utils.trunc(this.testY) != Utils.trunc(this.y) && i == 0) i = 1;
        this.testY = this.testY < this.y ? this.testY + i : this.testY - i;

        // TOO BIG ERROR!
        if (Math.abs(Utils.trunc(this.x - this.testX)) >= 32) this.testX = this.x;
        if (Math.abs(Utils.trunc(this.y - this.testY)) >= 16) this.testY = this.y;
    }

    // PlayerAnim() walk animation and PlayerWeaponAnim() aim servo, once per tick
    animTick() {
        if (this.dead > 0)
            return;
        var params = Models.skin(this.model, this.modelColor);
        var walking = this.dir == Constants.DIR_LW || this.dir == Constants.DIR_RW;

        if (this.nextframe > 0) this.nextframe--;
        if (walking && this.nextframe == 0) {
            this.nextframe = (this.crouch ? params.crouchrefreshtime : params.framerefreshtime) - (this.item_haste > 0 ? 1 : 0);
            var frames = this.crouch ? params.crouchframes : params.walkframes;
            this.frame = this.frame < frames - 1 ? this.frame + 1 : 0;
        }
        if (walking) {
            this.frm = 1 + this.frame;
        } else {
            this.frm = 0;
            this.frame = this.crouch ? params.crouchstartframe : params.walkstartframe;
        }

        // aim servo of a network player
        var left = this.dir == Constants.DIR_LW || this.dir == Constants.DIR_LS;
        var zangle = this.nfkAngle;
        if (left && zangle < 130) zangle -= 2;
        if (!left) {
            if (this.mgun_angle > 127) this.mgun_angle = 255 - this.mgun_angle;
        } else {
            if (this.mgun_angle <= 127) this.mgun_angle = 255 - this.mgun_angle;
        }
        var target = Utils.round(zangle) & 0xFF;
        var fwd = (target - this.mgun_angle + 256) % 256;
        var dist = fwd <= 128 ? fwd : 256 - fwd;
        var step = Math.min(Utils.trunc(dist / 2), 6);
        if (step == 0 || this.mgun_lock != 0) {
            this.mgun_angle = target;
            this.mgun_lock = 0;
        } else {
            this.mgun_angle = (fwd <= 128 ? this.mgun_angle + step : this.mgun_angle - step + 256) & 0xFF;
        }
        this.bodyangle = this.mgun_angle;
    }

    jump() {
        // TODO: move code to jump here
        Sound.playModel(this.model, 'jump');
    }

    // The brick checks below are evaluated on every call with the current coordinates, exactly like
    // IsOnground(), BrickOnHead() and BrickCrouchOnHead() in NFK (Demo.js assigns x/y directly)

    isOnGround() {
        var z = this.dead > 0 ? 0 : 9; // corpses do not stick to walls
        return this.map.isBlock(Utils.trunc((this.x - z) / 32), Utils.trunc((this.y + 25) / 16))
            && !this.map.isBlock(Utils.trunc((this.x - z) / 32), Utils.trunc((this.y + 23) / 16))

            || this.map.isBlock(Utils.trunc((this.x + z) / 32), Utils.trunc((this.y + 25) / 16))
            && !this.map.isBlock(Utils.trunc((this.x + z) / 32), Utils.trunc((this.y + 23) / 16))

            || this.map.isBlock(Utils.trunc((this.x - z) / 32), Utils.trunc((this.y + 24) / 16))
            && !this.map.isBlock(Utils.trunc((this.x - z) / 32), Utils.trunc((this.y + 8) / 16))

            || this.map.isBlock(Utils.trunc((this.x + z) / 32), Utils.trunc((this.y + 24) / 16))
            && !this.map.isBlock(Utils.trunc((this.x + z) / 32), Utils.trunc((this.y + 8) / 16));
    }

    isBrickOnHead() {
        return this.map.isBlock(Utils.trunc((this.x - 9) / 32), Utils.trunc((this.y - 25) / 16))
            && !this.map.isBlock(Utils.trunc((this.x - 9) / 32), Utils.trunc((this.y - 23) / 16))

            || this.map.isBlock(Utils.trunc((this.x + 9) / 32), Utils.trunc((this.y - 25) / 16))
            && !this.map.isBlock(Utils.trunc((this.x + 9) / 32), Utils.trunc((this.y - 23) / 16))

            || this.map.isBlock(Utils.trunc((this.x - 9) / 32), Utils.trunc((this.y - 24) / 16))
            && !this.map.isBlock(Utils.trunc((this.x - 9) / 32), Utils.trunc((this.y - 8) / 16))

            || this.map.isBlock(Utils.trunc((this.x + 9) / 32), Utils.trunc((this.y - 24) / 16))
            && !this.map.isBlock(Utils.trunc((this.x + 9) / 32), Utils.trunc((this.y - 8) / 16));
    }

    isBrickCrouchOnHead() {
        return this.map.isBlock(Utils.trunc((this.x - 8) / 32), Utils.trunc((this.y - 9) / 16))
            && !this.map.isBlock(Utils.trunc((this.x - 8) / 32), Utils.trunc((this.y - 7) / 16))

            || this.map.isBlock(Utils.trunc((this.x + 8) / 32), Utils.trunc((this.y - 9) / 16))
            && !this.map.isBlock(Utils.trunc((this.x + 8) / 32), Utils.trunc((this.y - 7) / 16))

            || this.map.isBlock(Utils.trunc((this.x - 8) / 32), Utils.trunc((this.y - 23) / 16))

            || this.map.isBlock(Utils.trunc((this.x + 8) / 32), Utils.trunc((this.y - 23) / 16))

            || this.map.isBlock(Utils.trunc((this.x - 8) / 32), Utils.trunc((this.y - 16) / 16))

            || this.map.isBlock(Utils.trunc((this.x + 8) / 32), Utils.trunc((this.y - 16) / 16));
    }

    isInWater() {
        return this.map.isWater(Utils.trunc(this.x / 32), Utils.trunc(this.y / 16));
    }
	
	destroy() {
		this.graphics.destroy();
	}
}