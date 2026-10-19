import SimpleObject from "./SimpleObject.js";
import Constants from "./../Constants.js";

export default
class ItemArmor5 extends SimpleObject {
	constructor(g, x, y) {
		super(g, x, y);
		
		// sprite
		this.texture = g.resources.items.textures['item-' + (Constants.IT_SHARD - 1) + '.png'];

		// properties
		this.itemId = Constants.IT_SHARD;
	}
}
