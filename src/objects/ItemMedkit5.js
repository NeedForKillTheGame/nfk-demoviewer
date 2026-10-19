import SimpleObject from "./SimpleObject.js";
import Constants from "./../Constants.js";

export default
class ItemMedkit5 extends SimpleObject {
	constructor(g, x, y) {
		super(g, x, y);
		
		// sprite
		this.texture = g.resources.medkits.textures['Medkits-0.png']

		// properties
		this.itemId = Constants.IT_HEALTH_5;
	}
}
