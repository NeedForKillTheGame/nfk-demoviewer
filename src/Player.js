import Map from "./Map.js";
import Utils from "./Utils.js";
import Constants from "./Constants.js";
import PlayerGraphics from "./PlayerGraphics.js";
import PlayerPhysics from "./Physics.js";
import Sound from "./Sound.js";
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

        this.powerups = []; // taken powerups
        
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

    setModel(model, color) {
        this.model = model;
        this.modelColor = color;
        // set defaults if not found
        if (!this.graphics.animations[this.model]) {
            this.model = 'sarge';
            console.log("reset model (model not found " + model + ")");
        }
        if (!this.graphics.animations[this.model][this.modelColor]) {
            this.modelColor = 'default';
            console.log("reset color (model not found " + model + "+" + color + ")");
        }
        this.graphics.updateModel();
    }
		
	addHealth(val, max) {
		this.health += val;
		if (this.health > max)
			this.health = max;
		if (this.health <= 0)
			this.setDead(1);
	}		
	addArmor(val) {
		this.admor += val;
		if (this.admor > 200)
			this.admor = 200;
	}
	
	addWeapon(weaponId) {
		
	}
	
	addWeaponAmmo(ammoId, amount) {
		
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
        this.graphics.updateModel();
    }
    setDead(val) {
        if (this.dead == val)
            return;

        this.dead = val;
        this.graphics.updateModel();
        
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
        // clear powerups
        this.powerups = [];
    }

	// a player without a team in team based game types is a spectator
	isSpectator() {
		var map = this.g.demo.data.Map;
		if (!map)
			return false;
		var gametype = map.Header.GAMETYPE;
		var teamGame = gametype === Constants.GAMETYPE_TEAM
			|| gametype === Constants.GAMETYPE_CTF
			|| gametype === Constants.GAMETYPE_DOMINATION;
		return teamGame && this.team === Constants.C_TEAMNON;
	}

	changeTeam(team){
		console.log("player " + this.name + " selected team " + team);
		this.team = team;
		this.graphics.container.visible = !this.isSpectator();
		if (this.isSpectator())
			this.follow = false;

        this.setModel(this.model, team == Constants.C_TEAMRED 
            ? 'red'
            : team == Constants.C_TEAMBLUE
                ? 'blue'
                : Constants.C_TEAMNON);
		this.graphics.updateModel();
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
        return this.powerups.indexOf(itemId) != -1;
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

    spinMachinegun() {
        // resume weapon animation
        var machinegun = this.weapons[Constants.C_WPN_MACHINE];
        if (machinegun.sprite)
            machinegun.sprite.play();
    }

    // timers of a network player in playermove() of NFK and its gauntlet sound
    weaponTick() {
        if (this.shaftsttime > 0) this.shaftsttime--;
        if (this.gantl_s > 0) this.gantl_s--;
        if (this.item_quad_time > 0) this.item_quad_time--;

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

    addPowerup(itemId) {
        // add only if does not exists
        if (this.powerups.indexOf(itemId) == -1) {
            this.powerups.push(itemId);
            var idx = this.powerups.length - 1;

            // remove after 30 seconds
            // FIXME: actually powerup has own time, but here each time it will last again 30 sec...
            var that = this;
            var timerId = this.g.timerManager.addTimeout(30, function(){
                for (var i = 0; i < that.powerups.length; i++) {
                    if (that.powerups[i] == itemId) {
                        that.powerups.splice(i, 1);
                        break;
                    }
                }
            });
        }
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