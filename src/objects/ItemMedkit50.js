import SimpleObject from "./SimpleObject.js";
import Constants from "./../Constants.js";

export default
class ItemMedkit50 extends SimpleObject {
	constructor(g, x, y) {
		super(g, x, y);
		
		// sprite
		this.texture = g.resources.medkits.textures['Medkits-2.png']
		this.offsetX = -5;

		// properties
		this.itemId = Constants.IT_HEALTH_50;
	}
}
