import Player from "./Player.js";
import Sound from "./Sound.js";
import Models from "./Models.js";
import Gibs from "./Gibs.js";
import Constants from "./Constants.js";
import Utils from "./Utils.js";
import Console from "./Console.js";
import Global from "./G.js";

export default
class Demo {
	constructor(g) {
		this.g = g;
		this.players = g.players;
		this.data = {};
		
		this.frameId = 0;
		this.startFrame = 0;
		this.reqId = 0;
	}
	
	loadFromQuery(callback)
	{
		var queryString = window.location.href.slice(window.location.href.indexOf('?') + 1);
		var demoUrl = false;
        if (queryString.indexOf('demourl=') === 0) {
            demoUrl = decodeURIComponent(queryString.substring(8)).replace(/\+/g, ' ');
		}
		if (queryString.indexOf('match=') === 0) {
            var matchId = decodeURIComponent(queryString.substring(6)).replace(/\+/g, ' ');
			demoUrl = this.g.config.statsDemoUrl + matchId;
		}
		var idx = queryString.indexOf('frame=');
		if (idx >= 0) {
			this.startFrame = decodeURIComponent(queryString.substring(idx+6)).replace(/\+/g, ' ');
			this.startFrame = parseInt(this.startFrame);
			console.log("start from frame " + this.startFrame);
		}
		if (!demoUrl) {
			alert('demourl or match is required');
		}
		demoUrl = this.g.config.demoServiceUrl + demoUrl;
		Console.writeText('loading demo from url ' + demoUrl);
		this.load(demoUrl, callback);
	}
	
	load(demoUrl, callback)
	{
		var that = this;
		this._loadJSON(demoUrl,
			function(data) {
				Utils.removeHtmlElement("loading");
				//console.log(data);
				that.data = data;
				console.log("total frames " + data.DemoUnits.length);
				callback(that);
			},
			function(xhr) { 
				Utils.removeHtmlElement("loading");
				Console.writeText('error loading demo');
				console.error(xhr);
			}
		);
	}
	
	spawnPlayer(dxid, name)
	{
		var p = new Player(this.g, dxid, name);
		if (this.players.length == 0) {
			p.follow = true; // FIXME: follow only one player (the first)
		}
		this.players.push(p);
		return p;
	}
	
	nextFrame(gametic, req)
	{
		// end of the demo
		if (this.frameId > this.data.DemoUnits.length - 1) {
			if (!this.g.gamestate.gameend) {
				// TODO: display players summary statistics
				Sound.play('gameend');
				console.log("end of demo");
				this.g.gamestate.gameend = true;
			}
			return false;
		}

				
		// feature to start from specified frame
		if (this.frameId > 10 && this.frameId < this.startFrame) {
			this.frameId = this.startFrame;
			console.log('rewind on frame ' + this.startFrame);
			// reset start frame to able to rewind with slider
			this.startFrame = 0;
		}
		
		var unit = this.data.DemoUnits[this.frameId];
		var demounit = unit.DemoUnit;


		//console.log(this.frameId + " / " + unit.DData.gametime + " / " + unit.DData.gametic  + " / " + gametic );
		if (gametic != unit.DData.gametic)
			return true;

		this.setFrameId(this.frameId + 1);

// debug

		if (req)
			this.reqId++;
		else
			this.reqId = 0;
		//console.log("frame " + this.frameId + " " + (req ? this.reqId : 'false'));


		this.g.gamestate.gametime = unit.DData.gametime;
		this.g.gamestate.gametick = unit.DData.gametick;


		switch (unit.DData.type0)
		{
			// match start
			case Constants.DDEMO_TIMESET:

				this.g.timerManager.clearTimers();

				// spawn objects only it match started (otherwise warmup will be > 0)
				if (demounit.warmup == 0) {
					this.g.weapons.clear();
					Sound.play('matchstart');
					this.g.map.spawnObjects();
				}
				break;
			// update position for a player
			case Constants.DDEMO_PLAYERPOSV3:
				for (var k = 0; k < this.players.length; k++)
				{
					if (demounit.DXID == this.players[k].DXID)
					{
						this.players[k].x = demounit.x;
						this.players[k].y = demounit.y;
						this.players[k].velocityX = demounit.inertiax;
						this.players[k].velocityY = demounit.inertiay;
						
						if ((demounit.PUV3 & Constants.PUV3_DIR0)==Constants.PUV3_DIR0) this.players[k].dir = Constants.DIR_LW;
						if ((demounit.PUV3 & Constants.PUV3_DIR1)==Constants.PUV3_DIR1) this.players[k].dir = Constants.DIR_RW;
						if ((demounit.PUV3 & Constants.PUV3_DIR2)==Constants.PUV3_DIR2) this.players[k].dir = Constants.DIR_LS;
						if ((demounit.PUV3 & Constants.PUV3_DIR3)==Constants.PUV3_DIR3) this.players[k].dir = Constants.DIR_RS;
						if ((demounit.PUV3 & Constants.PUV3_DEAD0)==Constants.PUV3_DEAD0) this.players[k].setDead(0);
						if ((demounit.PUV3 & Constants.PUV3_DEAD1)==Constants.PUV3_DEAD1) this.players[k].setDead(1);
						if ((demounit.PUV3 & Constants.PUV3_DEAD2)==Constants.PUV3_DEAD2) this.players[k].setDead(2);
						if ((demounit.PUV3 & Constants.PUV3_WPN0)==Constants.PUV3_WPN0) this.players[k].setWeapon(Constants.C_WPN_GAUNTLET);
						if ((demounit.PUV3 & Constants.PUV3_WPN1)==Constants.PUV3_WPN1) this.players[k].setWeapon(Constants.C_WPN_MACHINE);
						if ((demounit.PUV3 & Constants.PUV3_WPN2)==Constants.PUV3_WPN2) this.players[k].setWeapon(Constants.C_WPN_SHOTGUN);
						if ((demounit.PUV3 & Constants.PUV3_WPN3)==Constants.PUV3_WPN3) this.players[k].setWeapon(Constants.C_WPN_GRENADE);
						if ((demounit.PUV3 & Constants.PUV3_WPN4)==Constants.PUV3_WPN4) this.players[k].setWeapon(Constants.C_WPN_ROCKET);
						if ((demounit.PUV3 & Constants.PUV3_WPN5)==Constants.PUV3_WPN5) this.players[k].setWeapon(Constants.C_WPN_SHAFT);
						if ((demounit.PUV3 & Constants.PUV3_WPN6)==Constants.PUV3_WPN6) this.players[k].setWeapon(Constants.C_WPN_RAIL);
						if ((demounit.PUV3 & Constants.PUV3_WPN7)==Constants.PUV3_WPN7) this.players[k].setWeapon(Constants.C_WPN_PLASMA);
						if ((demounit.PUV3B & Constants.PUV3B_WPN8)==Constants.PUV3B_WPN8) this.players[k].setWeapon(Constants.C_WPN_BFG);
						var crouch = ((demounit.PUV3B & Constants.PUV3B_CROUCH)==Constants.PUV3B_CROUCH) ? true : false;
						this.players[k].setCrouch(crouch);
						this.players[k].BALLOON = ((demounit.PUV3B & Constants.PUV3B_BALLOON)==Constants.PUV3B_BALLOON) ? true : false;
						
						if ((this.players[k].dead > 0) && ((demounit.PUV3 & Constants.PUV3_DEAD0)==Constants.PUV3_DEAD0) && (this.players[k].rewardtime>0)) this.players[k].rewardtime = 0;
						this.players[k].setWeaponAngle(demounit.wpnang);
						this.players[k].fangle = demounit.wpnang * (180/128); // given angle is from 0 to 255, we convert it to 360 degrees notation

						// fix angle for the right and left sides
						if ((this.players[k].dir == Constants.DIR_RW) || (this.players[k].dir == Constants.DIR_RS)) {
							if (this.players[k].fangle > 180) this.players[k].fangle =  this.players[k].fangle; 
							this.players[k].fangle -= 90;
						} else {
							if (this.players[k].fangle <= 180) this.players[k].fangle = this.players[k].fangle;
							this.players[k].fangle = 270 - this.players[k].fangle;
						}

						this.players[k].ammo_mg = demounit.currammo;
						this.players[k].ammo_sg = demounit.currammo;
						this.players[k].ammo_gl = demounit.currammo;
						this.players[k].ammo_rl = demounit.currammo;
						this.players[k].ammo_sh = demounit.currammo;
						this.players[k].ammo_rg = demounit.currammo;
						this.players[k].ammo_pl = demounit.currammo;
						this.players[k].ammo_bfg = demounit.currammo;
						
					}
				}
				break;

			// update player health and armor
			case Constants.DDEMO_HAUPDATE:
				// update position for a player from the frame
				for (var k = 0; k < this.players.length; k++)
				{
					if (demounit.DXID == this.players[k].DXID)
					{
						this.players[k].health = demounit.health;
						this.players[k].armor = demounit.armor;
						this.players[k].frags = demounit.frags;
					}
				}
				break;
			
			// player joined
			case Constants.DDEMO_CREATEPLAYERV2:
				var name = demounit.netname;
				var p = this.spawnPlayer(demounit.DXID, name);
				p.setXY(demounit.x, demounit.y);
				p.dir = demounit.dir;
				p.dead = demounit.dead;
				console.log(demounit);
				var model = Models.parseName(demounit.modelname);
				p.setModel(model.model, model.skin);
				p.changeTeam(demounit.team);
				console.log("player joined " + name);
				break;
				
				
			case Constants.DDEMO_TEAMSELECT:
				for (var k = 0; k < this.players.length; k++)
				{
					if (demounit.DXID == this.players[k].DXID)
					{
						this.players[k].changeTeam(demounit.team);
					}
				}
				break;
			case Constants.DDEMO_PLAYERMODELCHANGE:
				for (var k = 0; k < this.players.length; k++)
				{
					if (demounit.DXID == this.players[k].DXID)
					{
						console.log("changemodel ", demounit);
						var model = Models.parseName(demounit.newstr);
						this.players[k].setModel(model.model, model.skin);
					}
				}
				break;

				
			// player left
			case Constants.DDEMO_DROPPLAYER:
				for (var i = 0; i < this.players.length; i++) {
					if (this.players[i].DXID == demounit.DXID) {
						console.log("player left " + this.players[i].name);
						this.players[i].destroy();
						this.players.splice(i, 1);
					}
				}
				
				break;		
				
			// player attacked
			case Constants.DDEMO_DAMAGEPLAYER:
				for (var k = 0; k < this.players.length; k++)
				{
					if (demounit.DXID == this.players[k].DXID)
					{
						var p = this.players[k];
						// battle suit protects
						if (p.item_battle > 0 && p.item_battle_time == 0) {
							Sound.play('protect');
							p.item_battle_time = 50;
						}
						p.health = demounit.health;
						p.armor = demounit.armor;
						// powerups are lost on the death
						if (p.health <= 0)
							p.clearPowerups();
						Sound.playPain(p);
						// GIB_DEATH: gibs (OPT_MEATLEVEL 1), then the blood of a player hit by a player
						if (p.health <= -40)
							Gibs.gib(this.g, p);
						if (demounit.ext == 0)
							Gibs.damageBlood(this.g, p, demounit.attwpn);
					}
				}
				break;
				
			case Constants.DDEMO_CTF_EVENT_FLAGPICKUP:
				console.log("flag pickup");
				demounit.DXID = demounit.PlayerDXID;
			case Constants.DDEMO_CTF_EVENT_FLAGTAKEN:
				Sound.play('flagtk');
				
				for (var k = 0; k < this.players.length; k++)
				{
					// find player
					if (demounit.DXID == this.players[k].DXID)
					{
						// enemy flag itemid
						var itemId = this.players[k].team == Constants.C_TEAMBLUE
							? Constants.IT_RED_FLAG
							: Constants.IT_BLUE_FLAG;
						// find flag in objects
						for (var o in this.g.objects) {
							if (this.g.objects[o].itemId == itemId) {
								this.players[k].flag = this.g.objects[o]; // set to player
								console.log("flag " + itemId + " taken by " + this.players[k].displayName);
								break;
							}
						}
					}
				}
				break;
			case Constants.DDEMO_CTF_EVENT_FLAGRETURN:
				Sound.play('flagret');
				// flag itemid
				var itemId = demounit.team == Constants.C_TEAMBLUE
					? Constants.IT_BLUE_FLAG
					: Constants.IT_RED_FLAG;
				// find flag in objects
				for (var o in this.g.objects) {
					if (this.g.objects[o].itemId == itemId) {
						this.g.objects[o].returnToBase();
						console.log("flag " + itemId + " returned");
						break;
					}
				}
				break;
			case Constants.DDEMO_CTF_EVENT_FLAGCAPTURE:
				Sound.play('flagcap');

				for (var k = 0; k < this.players.length; k++)
				{
					// find player
					if (demounit.DXID == this.players[k].DXID)
					{
						if (this.players[k].flag)
							this.players[k].flag.returnToBase();
					}
				}
				break;
				
				
			case Constants.DDEMO_EARNPOWERUP:
				for (var k = 0; k < this.players.length; k++) {
					if (demounit.DXID == this.players[k].DXID)
						this.players[k].setPowerup(demounit.type1, demounit.time);
				}
				break;
				
			case Constants.DDEMO_CHATMESSAGE:
				var text = "";
				for (var i = 0; i < this.players.length; i++) {
					if (this.players[i].DXID == demounit.TDNETCHATMessage.DXID) {
						text += this.players[i].displayName + ": ";
						break;
					}
				}
				text += Utils.filterNickName(demounit.MessageText);
				
				Console.writeText(text);
				Sound.play('talk');
				break;
				

			case Constants.DDEMO_CTF_GAMESTATE:
			case Constants.DDEMO_CTF_GAMESTATESCORE:
			case Constants.DDEMO_DOM_SCORECHANGED:
				this.g.gamestate.redscore = demounit.RedScore;
				this.g.gamestate.bluescore = demounit.BlueScore;
				break;

			
			// door opened or closed, button pressed or released
			case Constants.DDEMO_CORPSESPAWN:
				for (var k = 0; k < this.players.length; k++) {
					if (this.players[k].DXID == demounit.DXID) {
						Gibs.spawnCorpse(this.g, this.players[k]);
						break;
					}
				}
				break;

			case Constants.DDEMO_OBJCHANGESTATE:
				this.g.map.changeObjectState(demounit.objindex, demounit.state);
				break;

			// a missile exploded
			case Constants.DDEMO_KILLOBJECT:
				this.g.weapons.killObject(demounit);
				break;

			case Constants.DDEMO_FIREROCKET:
				this.g.weapons.fireRocket(demounit, false);
				break;
			case Constants.DDEMO_FIREBFG:
				this.g.weapons.fireRocket(demounit, true);
				break;
			case Constants.DDEMO_FIREPLASMA:
			case Constants.DDEMO_FIREPLASMAV2:
				this.g.weapons.firePlasma(demounit);
				break;
			case Constants.DDEMO_FIREGREN:
			case Constants.DDEMO_FIREGRENV2:
				this.g.weapons.fireGrenade(demounit);
				break;
			case Constants.DDEMO_GRENADESYNC:
				this.g.weapons.grenadeSync(demounit);
				break;
			case Constants.DDEMO_FIRERAIL:
				this.g.weapons.fireRail(demounit);
				break;
			case Constants.DDEMO_NETRAIL:
				this.g.weapons.netRail(demounit);
				break;
			case Constants.DDEMO_FIRESHAFT:
				this.g.weapons.fireShaftLegacy(demounit);
				break;
			case Constants.DDEMO_FIRESHOTGUN:
				this.g.weapons.fireShotgun(demounit);
				break;
			case Constants.DDEMO_FIREMACH:
				this.g.weapons.fireMachine(demounit);
				break;
			case Constants.DDEMO_NETPARTICLE:
				this.g.weapons.netParticle(demounit);
				break;
			case Constants.DDEMO_REMOTEFIRE:
				// the demo parser does not return this frame yet
				if (demounit)
					this.g.weapons.remoteFire(demounit);
				break;
			
			// gauntlet attack or not
			case Constants.DDEMO_GAUNTLETSTATE:
				for (var i = 0; i < this.players.length; i++) {
					if (this.players[i].DXID == demounit.DXID) {
						this.players[i].gantl_state = demounit.State;
						if (this.players[i].weapon.itemId == Constants.C_WPN_GAUNTLET) {
							if (demounit.State == 0)
								this.players[i].weapon.stop();
							else
								this.players[i].weapon.play();
						}
					}
				}
				break;

			case Constants.DDEMO_NEW_SHAFTBEGIN:
				this.g.weapons.shaftBegin(demounit);
				break;

			case Constants.DDEMO_NEW_SHAFTEND:
				this.g.weapons.shaftEnd(demounit);
				break;
				
			case Constants.DDEMO_JUMPSOUND:
				for (var i = 0; i < this.players.length; i++) {
					if (this.players[i].DXID == demounit.dxid) {
						this.players[i].jump();
					}
				}
				break;
			case Constants.DDEMO_JUMPPADSOUND:
				//Sound.play('jumppad'); // played in item
				break;
			case Constants.DDEMO_RESPAWNSOUND:
				Sound.play('respawn');
				break;
			case Constants.DDEMO_LAVASOUND:
				Sound.play('lava');
				break;

			// a powerup will appear in a second
			case Constants.DDEMO_POWERUPSOUND:
				Sound.play('powerup');
				break;

			// map items are taken and respawned only by the demo
			case Constants.DDEMO_ITEMDISSAPEAR:
				this.g.map.takeItem(demounit.x, demounit.y, demounit.i);
				break;
			case Constants.DDEMO_ITEMAPEAR:
				this.g.map.respawnItem(demounit.x, demounit.y);
				break;

			// weapons and powerups dropped by players
			case Constants.DDEMO_WPN_EVENT_WEAPONDROP:
			case Constants.DDEMO_WPN_EVENT_WEAPONDROPGAMESTATE:
				this.g.weapons.dropWeapon(demounit, unit.DData.type0 == Constants.DDEMO_WPN_EVENT_WEAPONDROPGAMESTATE);
				break;
			case Constants.DDEMO_WPN_EVENT_WEAPONDROP_APPLY:
				this.g.weapons.dropApply(demounit);
				break;
			case Constants.DDEMO_WPN_EVENT_PICKUP:
				this.g.weapons.pickupWeapon(demounit);
				break;
			case Constants.DDEMO_POWERUP_EVENT_POWERUPDROP:
			case Constants.DDEMO_POWERUP_EVENT_POWERUPDROPGAMESTATE:
				this.g.weapons.dropPowerup(demounit);
				break;
			case Constants.DDEMO_POWERUP_EVENT_PICKUP:
				this.g.weapons.pickupPowerup(demounit);
				break;
			case Constants.DDEMO_FLIGHTSOUND:
				Sound.play('flight');
				break;
			case Constants.DDEMO_NOAMMOSOUND:
				Sound.play('noammo');
				break;
			
			case Constants.DDEMO_GENERICSOUNDDATA:
				//Sound.play('genericdata'); // FIXEME: hit player?
				break;
			case Constants.DDEMO_GENERICSOUNDSTATDATA:
				
				break;
			// FIXME: it does not fire?
			case Constants.DDEMO_GENERICSOUNDDATA:
				console.log("sound " + demounit.SoundType);





			break;
				
		}
		
		// increase next frame recursively until all ticks will be handled
		this.nextFrame(gametic, true);
		return true;
	}
	
	setFrameId(id) {
		if (id <= 0)
			id = 0;
		if (id >= this.data.DemoUnits.length)
			id = this.data.DemoUnits.length;
		this.frameId = id;

		// reset game state
		this.g.gamestate.gameend = false;
	}
	getFrameId() {
		return this.frameId;
	}
	
	_loadJSON(path, success, error)
	{
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function()
		{
			if (xhr.readyState === XMLHttpRequest.DONE) {
				if (xhr.status === 200) {
					if (success)
						success(JSON.parse(xhr.responseText));
				} else {
					if (error)
						error(xhr);
				}
			}
		};
		xhr.open("GET", path, true);
		xhr.send();
	}
}