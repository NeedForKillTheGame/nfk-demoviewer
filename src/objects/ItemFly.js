import SimpleObject from "./SimpleObject.js";
import Constants from "./../Constants.js";

export default
class ItemFly extends SimpleObject {
	constructor(g, x, y) {
		super(g, x, y);
		
		// sprite
		this.texture = g.resources.powerup.spritesheet.animations.fly;
		this.animated = true;
		this.offsetY = -16;
	
		// properties
		this.itemId = Constants.IT_POWERUP_FLIGHT;
	}
}
