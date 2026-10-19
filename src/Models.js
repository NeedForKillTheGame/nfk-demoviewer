import PIXI from "PIXI";

// Player models of NFK, made by tools/nfk_extract.py from basenfk/models: images/nfk/models/<model>.png holds all
// bitmaps of the model skins one under another, models.json holds the parameters of every skin (.nmdl file) and the
// place [x, y, width, height] of its bitmaps in the sheet. A sheet is loaded when a player gets the model.
//
// Pattern sizes like in SC_LoadModels: walk and walkpower = modelsizex x 48, crouch and crouchpower =
// crouchsizex x crouchsizey, die = 52 x diesizey. Patterns go by rows inside a bitmap.

var baseTextures = {};
var patterns = {};

export default {
	list: {}, // models.json: model -> skin -> parameters

	init(data) {
		this.list = data || {};
	},

	exists(model, skin) {
		return !!(this.list[model] && this.list[model][skin]);
	},

	// parameters of a skin: walkframes, walkstartframe, modelsizex, framerefreshtime, dieframes, diesizey,
	// dieframerefreshtime, crouchsizex, crouchframes, crouchsizey, crouchrefreshtime, crouchstartframe
	skin(model, skin) {
		return this.exists(model, skin) ? this.list[model][skin] : this.list.sarge.default;
	},

	// model name of a demo ("model+skin") is a Pascal string[30]: a length byte first, garbage after the end
	parseName(name) {
		name = name || '';
		var length = name.length > 0 ? name.charCodeAt(0) : 0;
		if (length < 32 && length < name.length)
			name = name.substr(1, length);
		name = name.toLowerCase().split('+');
		return { model: name[0] || 'sarge', skin: name[1] || 'default' };
	},

	// model and skin a player is drawn with (ASSIGNMODEL): a team game forces the team skin of the model,
	// a missing model or skin falls back to sarge
	resolve(model, skin, teamSkin) {
		if (teamSkin) {
			if (this.exists(model, teamSkin))
				return { model: model, skin: teamSkin };
			return { model: 'sarge', skin: teamSkin };
		}
		if (this.exists(model, skin))
			return { model: model, skin: skin };
		return { model: 'sarge', skin: 'default' };
	},

	baseTexture(model) {
		if (!baseTextures[model])
			baseTextures[model] = PIXI.BaseTexture.from('images/nfk/models/' + model + '.png');
		return baseTextures[model];
	},

	// size of a pattern of a bitmap: kind = walk | crouch | die | walkpower | crouchpower
	patternSize(params, kind) {
		if (kind == 'walk' || kind == 'walkpower')
			return { width: params.modelsizex, height: 48 };
		if (kind == 'die')
			return { width: 52, height: params.diesizey };
		return { width: params.crouchsizex, height: params.crouchsizey };
	},

	// texture of the pattern (frame) of a skin bitmap
	frame(model, skin, kind, index) {
		var resolved = this.exists(model, skin) ? { model: model, skin: skin } : { model: 'sarge', skin: 'default' };
		var key = resolved.model + '+' + resolved.skin + '/' + kind + '/' + index;
		if (!patterns[key]) {
			var params = this.list[resolved.model][resolved.skin];
			var place = params[kind];
			var size = this.patternSize(params, kind);
			var perRow = Math.max(1, Math.floor(place[2] / size.width));
			var count = perRow * Math.floor(place[3] / size.height);
			index = Math.max(0, Math.min(index, count - 1));
			patterns[key] = new PIXI.Texture(this.baseTexture(resolved.model), new PIXI.Rectangle(
				place[0] + index % perRow * size.width, place[1] + Math.floor(index / perRow) * size.height,
				size.width, size.height));
		}
		return patterns[key];
	}
};
