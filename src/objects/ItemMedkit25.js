import SimpleObject from "./SimpleObject.js";
import Constants from "./../Constants.js";

export default
class ItemMedkit25 extends SimpleObject {
	constructor(g, x, y) {
		super(g, x, y);
		
		// sprite
		this.texture = g.resources.medkits.textures['Medkits-1.png'];
		this.offsetX = -3;

		// properties
		this.itemId = Constants.IT_HEALTH_25;
	}
}
