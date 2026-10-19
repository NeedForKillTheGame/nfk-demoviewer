import PIXI from "PIXI";
import Constants from "./Constants.js";
import Console from "./Console.js";
import Utils from "./Utils.js";
import PlayerModel from "./objects/PlayerModel.js";

export default
class PlayerGraphics  {
    constructor(g, player) {
		this.g = g;
		this.stage = g.render.playersLayer;
		this.player = player;
	
		//this.playerGraphics = new PIXI.Graphics();
		//this.playerGraphics.beginFill(0xAAAAFF);
		////this.playerGraphics.lineStyle(1, 0xFFFFFF);
		//this.playerGraphics.drawRect(0, 0, this.player.width(), this.player.height());
		//this.playerGraphics.endFill();
		//this.stage.addChild(this.playerGraphics);

		this.container = new PIXI.Container();
		console.log("c1", this.container);
		this.stage.addChild(this.container);
		this.obj = null;
		this.animations = this.g.initPlayerModels(this.container);
		this.updateModel();

		// powerup shell: the model silhouette added in the powerup colour (power sprite of a NFK model)
		this.shell = new PIXI.Sprite(PIXI.Texture.EMPTY);
		this.shellFilter = new PIXI.filters.ColorMatrixFilter();
		this.shellFilter.blendMode = PIXI.BLEND_MODES.ADD;
		this.shell.filters = [this.shellFilter];
		this.shell.visible = false;
		this.container.addChild(this.shell);

		// quad damage glow around the player
		this.quadGlow = new PIXI.Sprite(g.resources.glow.texture);
		this.quadGlow.anchor.set(0.5);
		this.quadGlow.blendMode = PIXI.BLEND_MODES.ADD;
		this.quadGlow.visible = false;
		this.g.render.fxLayer.addChild(this.quadGlow);

		this.playerPowerup = new PIXI.Text(player.displayName, { fontFamily : 'Arial', fontSize: 14, fontWeight: "bold", fill : 'red', align : 'center' });
		this.playerPowerup.anchor = new PIXI.Point(0.5, 0.5);
		this.playerPowerup.y -= 64;
		this.container.addChild(this.playerPowerup);
		
		this.playerName = new PIXI.Text(player.displayName, { fontFamily : 'Arial', fontSize: 14, fill : 'white', align : 'center' });
		this.playerName.anchor = new PIXI.Point(0.5, 0.5);
		//this.playerName.scale.x = this.playerName.scale.y;
		this.playerName.y -= 50;
		this.container.addChild(this.playerName);
		
		this.playerHA = new PIXI.Text("0 / 0", { fontFamily : 'Arial', fontSize: 12, fill : 'white', align : 'center' });
		this.playerHA.anchor = new PIXI.Point(0.5, 0.5);
		//this.playerHA.scale.x = this.playerName.scale.y;
		this.playerHA.y -= 36;
		this.container.addChild(this.playerHA);
		
		
		// player mech object (debug)
		this.mech = this.g.render.createMech(0, 0, this.player.width(), this.player.height());
		this.mech.visible = false;
	}
	
	// model = sarge
	// color = d|b|r
	// walktype = w
	updateModel() {
		// hide all player animations
		for (var m in this.animations) {
			for (var c in this.animations[m]) {
				for (var i = 0; i < this.animations[m][c].length; i++)
					this.animations[m][c][i].sprite.visible = false;
			}
		}
		var type = this.player.crouch ? 1 : 0;
		if (this.player.dead > 0) {
			type = 2;
			console.log("dead " + type);
		}
		// show current animation
		this.obj = this.animations[this.player.model][this.player.modelColor][type].sprite;
		this.obj.visible = true;
		this.play();
	}

	play() {
		if (!this.obj.playing)
			this.obj.gotoAndPlay(0);
	}
	stop() {
		if (this.obj.playing)
			this.obj.gotoAndStop(0);
	}
	
	
	adjustPosition(tmpX, tmpY)
	{
		// if not dead and Stand type
		if (!this.player.dead && (this.player.dir == Constants.DIR_LS || this.player.dir == Constants.DIR_RS)) {
			// stand
			this.stop();
		} else {
			// walk animation
			this.play();
		}
		
		// player direction
		this.container.scale.x = this.player.dir == Constants.DIR_LS || this.player.dir == Constants.DIR_LW ? -1 : 1;
		// morror display name and hud
		this.playerName.scale.x = this.playerHA.scale.x = this.playerPowerup.scale.x  = this.container.scale.x;

		this.container.x = tmpX; //player.x - 10;
		if (this.player.crouch) {
			tmpY += 5;
		}
		this.container.y = tmpY; //player.y - 24;

		this.playerHA.text = this.player.health + ' / ' + this.player.armor;
		this.setPowerupString();
		
		this.player.weapon.sprite.angle = this.player.fangle;
		this.updatePowerupEffects();

		// player with a flag
		if (this.player.flag) {
			this.player.flag.setY(this.player.testY);
			if (this.player.dir == Constants.DIR_RW || this.player.dir == Constants.DIR_RS) {
				this.player.flag.setX(this.player.testX - 20);
				this.player.flag.sprite.scale.x = -1;
				this.player.flag.sprite.angle = -45;
			} else {
				this.player.flag.setX(this.player.testX + 20);
				this.player.flag.sprite.scale.x = 1;
				this.player.flag.sprite.angle = 45;
			}
		}
	}
	
	// health and armor
	updatePlayerHA(text, x, y) {
		
	}

	// powerups with the seconds left, like the powerup timers on the NFK status bar
	setPowerupString() {
		var p = this.player;
		var items = [
			[p.item_regen, "REGENERATION"],
			[p.item_battle, "BATTLESUIT"],
			[p.item_haste, "HASTE"],
			[p.item_quad, "QUAD"],
			[p.item_flight, "FLIGHT"],
			[p.item_invis, "INVISIBILITY"]
		];
		var text = "";
		for (var i = 0; i < items.length; i++) {
			if (items[i][0] > 0)
				text += (text ? " | " : "") + items[i][1] + " " + (items[i][0] - 1);
		}
		this.playerPowerup.text = text ? "[" + text + "]" : "";
	}

	// NFK colours are $AABBGGRR
	setShellColor(color) {
		var r = (color & 0xFF) / 255, g = ((color >> 8) & 0xFF) / 255, b = ((color >> 16) & 0xFF) / 255;
		var a = ((color >>> 24) & 0xFF) / 255;
		this.shellFilter.matrix = [
			0, 0, 0, 0, r,
			0, 0, 0, 0, g,
			0, 0, 0, 0, b,
			0, 0, 0, a, 0
		];
	}

	// powerups of a demo player in PlayerAnim() of NFK: invisibility, the powerup shell and the quad glow
	updatePowerupEffects() {
		var p = this.player;
		var alive = p.dead == 0;
		var redTeam = p.isTeamGame() && p.team == Constants.C_TEAMRED;

		// invisible player is drawn with alpha $33 in a demo, unless a powerup shell shines
		var shines = p.item_quad > 0 || p.item_battle > 0 || (p.item_regen > 0 && p.item_regen_time > 0);
		var alpha = alive && p.item_invis > 0 && !shines ? 0x33 / 0xFF : 1;
		this.obj.alpha = alpha;
		if (p.weapon.sprite)
			p.weapon.sprite.alpha = alpha;

		var color = 0;
		if (p.item_quad > 0)
			color = redTeam ? 0x300000FF : 0x77FFFF00;
		if (p.item_battle > 0 && p.item_quad == 0)
			color = 0x770B92FF;
		if (p.item_regen > 0 && p.item_regen_time > 0)
			color = 0x770000FF;
		this.shell.visible = alive && color != 0;
		if (this.shell.visible) {
			this.setShellColor(color);
			this.shell.texture = this.obj.texture;
			this.shell.anchor.copyFrom(this.obj.anchor);
			this.shell.position.copyFrom(this.obj.position);
			this.shell.scale.copyFrom(this.obj.scale);
		}

		// r_fx_quad
		this.quadGlow.visible = alive && p.item_quad > 0;
		if (this.quadGlow.visible) {
			var glow = redTeam ? 0x880000FF : 0x55FFFF00;
			this.quadGlow.x = Math.round(p.testX);
			this.quadGlow.y = Math.round(p.testY);
			this.quadGlow.scale.set((1024 - Math.floor(Math.random() * 150)) / 256);
			this.quadGlow.tint = ((glow & 0xFF) << 16) | (glow & 0xFF00) | ((glow >> 16) & 0xFF);
			this.quadGlow.alpha = ((glow >>> 24) & 0xFF) / 255;
		}
	}
	
	
	destroy() {
		this.g.render.fxLayer.removeChild(this.quadGlow);
		this.quadGlow.destroy();
		this.stage.removeChild(this.container);
		this.container.destroy({ children: true });
		this.stage.removeChild(this.mech);
		this.mech.destroy();
	}
}