import PIXI from "PIXI";
import Constants from "./Constants.js";
import Console from "./Console.js";
import Utils from "./Utils.js";
import Models from "./Models.js";

var trunc = Utils.trunc;

// PowerDraw angle (0..255) -> PIXI rotation of a sprite which looks to the right
function rotation(units) {
	return units * Math.PI * 2 / 256 - Math.PI / 2;
}

// $AABBGGRR -> 0xRRGGBB
function tint(color) {
	return ((color & 0xFF) << 16) | (color & 0xFF00) | ((color >> 16) & 0xFF);
}

function alphaOf(color) {
	return ((color >>> 24) & 0xFF) / 255;
}

// pattern (frame) of a NFK image, patterns go by rows and the last pattern repeats like in PowerDraw
var patterns = {};
function pattern(g, name, index, width, height) {
	var base = g.resources[name].texture.baseTexture;
	var perRow = Math.floor(base.width / width);
	index = Math.max(0, Math.min(index, perRow * Math.floor(base.height / height) - 1));
	var key = name + '/' + index;
	if (!patterns[key]) {
		patterns[key] = new PIXI.Texture(base,
			new PIXI.Rectangle(index % perRow * width, Math.floor(index / perRow) * height, width, height));
	}
	return patterns[key];
}

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

		// the container holds the body, the powerup shell and the weapon, the labels are mirrored in their own container
		this.container = new PIXI.Container();
		this.stage.addChild(this.container);

		this.body = new PIXI.Sprite(PIXI.Texture.EMPTY);
		this.container.addChild(this.body);

		// powerup shell: the power bitmap of the model added in the powerup colour
		this.shell = new PIXI.Sprite(PIXI.Texture.EMPTY);
		this.shell.blendMode = PIXI.BLEND_MODES.ADD;
		this.shell.visible = false;
		this.container.addChild(this.shell);

		// held weapon, the machinegun has two layers
		this.weaponLayers = [];
		for (var i = 0; i < 2; i++) {
			var layer = new PIXI.Sprite(PIXI.Texture.EMPTY);
			layer.anchor.set(0.5);
			layer.visible = false;
			this.container.addChild(layer);
			this.weaponLayers.push(layer);
		}

		this.labels = new PIXI.Container();
		this.container.addChild(this.labels);

		// quad damage glow around the player
		this.quadGlow = new PIXI.Sprite(g.resources.glow.texture);
		this.quadGlow.anchor.set(0.5);
		this.quadGlow.blendMode = PIXI.BLEND_MODES.ADD;
		this.quadGlow.visible = false;
		this.g.render.fxLayer.addChild(this.quadGlow);

		this.playerPowerup = new PIXI.Text(player.displayName, { fontFamily : 'Arial', fontSize: 14, fontWeight: "bold", fill : 'red', align : 'center' });
		this.playerPowerup.anchor = new PIXI.Point(0.5, 0.5);
		this.playerPowerup.y -= 64;
		this.labels.addChild(this.playerPowerup);
		
		this.playerName = new PIXI.Text(player.displayName, { fontFamily : 'Arial', fontSize: 14, fill : 'white', align : 'center' });
		this.playerName.anchor = new PIXI.Point(0.5, 0.5);
		//this.playerName.scale.x = this.playerName.scale.y;
		this.playerName.y -= 50;
		this.labels.addChild(this.playerName);
		
		this.playerHA = new PIXI.Text("0 / 0", { fontFamily : 'Arial', fontSize: 12, fill : 'white', align : 'center' });
		this.playerHA.anchor = new PIXI.Point(0.5, 0.5);
		//this.playerHA.scale.x = this.playerName.scale.y;
		this.playerHA.y -= 36;
		this.labels.addChild(this.playerHA);
		
		
		// player mech object (debug)
		this.mech = this.g.render.createMech(0, 0, this.player.width(), this.player.height());
		this.mech.visible = false;
	}
	
	adjustPosition(tmpX, tmpY)
	{
		// player direction
		this.labels.scale.x = this.player.dir == Constants.DIR_LS || this.player.dir == Constants.DIR_LW ? -1 : 1;
		// morror display name and hud
		this.playerName.scale.x = this.playerHA.scale.x = this.playerPowerup.scale.x  = this.labels.scale.x;

		this.labels.x = tmpX; //player.x - 10;
		if (this.player.crouch) {
			tmpY += 5;
		}
		this.labels.y = tmpY; //player.y - 24;

		this.playerHA.text = this.player.health + ' / ' + this.player.armor;

		// number of the player for the follow hotkeys 1-8
		var number = this.g.players.filter(p => !p.isSpectator()).indexOf(this.player) + 1;
		this.playerName.text = (number > 0 && number <= 8 ? number + '. ' : '') + this.player.displayName;
		this.setPowerupString();
		
		this.drawBody();
		this.updatePowerupEffects();
		this.drawWeapon();

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

	// colour of the player sprites: invisibility is alpha $33 in a demo, unless a powerup shell shines
	alpha() {
		var p = this.player;
		var shines = p.item_quad > 0 || p.item_battle > 0 || (p.item_regen > 0 && p.item_regen_time > 0);
		return p.item_invis > 0 && !shines ? 0x33 / 0xFF : 1;
	}

	// body of PlayerAnim(): the walk or crouch pattern, images look to the right and are mirrored to the left
	drawBody() {
		var p = this.player;
		var params = Models.skin(p.model, p.modelColor);
		this.body.visible = p.dead == 0;
		if (!this.body.visible)
			return;

		var crouch = p.crouch;
		var texture = Models.frame(p.model, p.modelColor, crouch ? 'crouch' : 'walk', p.frm);
		var x = trunc(p.testX - trunc((crouch ? params.crouchsizex : params.modelsizex) / 2));
		var y = trunc(p.testY - 24) + (crouch ? 48 - params.crouchsizey : 0);
		var mirror = p.dir == Constants.DIR_LW || p.dir == Constants.DIR_LS;
		this.placeSprite(this.body, texture, x, y, mirror);
		this.body.alpha = this.alpha();
		this.bodyRect = { x: x, y: y, mirror: mirror, crouch: crouch };
	}

	// the sprite covers the rectangle from x,y, mirrored horizontally inside it
	placeSprite(sprite, texture, x, y, mirror) {
		sprite.texture = texture;
		sprite.scale.x = mirror ? -1 : 1;
		sprite.x = this.g.render.mapDx + x + (mirror ? texture.width : 0);
		sprite.y = this.g.render.mapDy + y;
	}

	// PlayerWeaponAnim(): the weapon is centered at the player and rotated by the aim servo
	drawWeapon() {
		var p = this.player;
		var layers = this.weaponLayers;
		layers[0].visible = layers[1].visible = false;
		if (p.dead > 0)
			return;

		var weapon = p.weapon.itemId;
		var left = p.dir == Constants.DIR_LW || p.dir == Constants.DIR_LS;
		var flip = left;
		var textures = [];
		var dy = 0;
		if (weapon == Constants.C_WPN_GAUNTLET) {
			textures.push(pattern(this.g, 'nfk_gauntlet', p.gantl_state * 2, 39, 28));
			flip = !left; // the gauntlet flips the other way
		} else if (weapon == Constants.C_WPN_MACHINE) {
			// never the weapons sheet: the barrel spins under the housing
			textures.push(pattern(this.g, 'nfk_mgun_ex', p.mgun_spin + 1, 39, 13));
			textures.push(pattern(this.g, 'nfk_mgun_ex', 0, 39, 13));
		} else {
			textures.push(pattern(this.g, 'nfk_weapons', weapon - 1, 39, 13));
		}
		if (left && weapon != Constants.C_WPN_GAUNTLET)
			dy = -1;

		var x = trunc(p.testX) + this.g.render.mapDx;
		var y = trunc(p.testY + (p.crouch ? 3 : -5)) + dy + this.g.render.mapDy;
		for (var i = 0; i < textures.length; i++) {
			layers[i].visible = true;
			layers[i].texture = textures[i];
			layers[i].x = x;
			layers[i].y = y;
			layers[i].rotation = rotation(Utils.round(p.bodyangle));
			layers[i].scale.y = flip ? -1 : 1;
			layers[i].alpha = this.alpha();
		}
	}

	// powerups of a demo player in PlayerAnim() of NFK: the powerup shell and the quad glow
	updatePowerupEffects() {
		var p = this.player;
		var alive = p.dead == 0;
		var redTeam = p.isTeamGame() && p.team == Constants.C_TEAMRED;
		var quadColor = redTeam ? 0x300000FF : 0x77FFFF00;

		var color = 0;
		if (p.item_quad > 0)
			color = quadColor;
		if (p.item_battle > 0)
			color = p.item_quad > 0 && p.paintime == 0 ? quadColor : 0x770B92FF;
		if (p.item_regen > 0 && p.item_regen_time > 0)
			color = 0x770000FF;
		this.shell.visible = alive && color != 0 && (p.item_quad > 0 || p.item_battle > 0 || p.item_regen > 0);
		if (this.shell.visible) {
			var r = this.bodyRect;
			this.placeSprite(this.shell, Models.frame(p.model, p.modelColor, r.crouch ? 'crouchpower' : 'walkpower', p.frm),
				r.x, r.y, r.mirror);
			this.shell.tint = tint(color);
			this.shell.alpha = alphaOf(color);
		}

		// r_fx_quad
		this.quadGlow.visible = alive && p.item_quad > 0;
		if (this.quadGlow.visible) {
			var glow = redTeam ? 0x880000FF : 0x55FFFF00;
			this.quadGlow.x = Math.round(p.testX);
			this.quadGlow.y = Math.round(p.testY);
			this.quadGlow.scale.set((1024 - Math.floor(Math.random() * 150)) / 256);
			this.quadGlow.tint = tint(glow);
			this.quadGlow.alpha = alphaOf(glow);
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