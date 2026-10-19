import SimpleObject from "./SimpleObject.js";
import Constants from "./../Constants.js";

export default
class ItemHaste extends SimpleObject {
	constructor(g, x, y) {
		super(g, x, y);
		
		// sprite
		this.texture = g.resources.powerup.spritesheet.animations.haste;
		this.animated = true;
		this.offsetY = -16;
		
		// properties
		this.itemId = Constants.IT_POWERUP_HASTE;
	}
}
