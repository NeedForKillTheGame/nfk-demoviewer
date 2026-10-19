import SimpleObject from "./SimpleObject.js";
import Constants from "./../Constants.js";

export default
class ItemMedkit100 extends SimpleObject {
	constructor(g, x, y) {
		super(g, x, y);
		
		// sprite
		this.texture = g.resources.mega.spritesheet.animations.mega;
		this.animated = true;
		this.offsetX = 7;
		
		// properties
		this.itemId = Constants.IT_HEALTH_100;
	}
}
