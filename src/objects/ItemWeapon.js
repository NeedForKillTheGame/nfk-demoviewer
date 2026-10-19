import SimpleObject from "./SimpleObject.js";

export default
class ItemWeapon extends SimpleObject {
	constructor(g, x, y, itemId) {
		super(g, x, y);
		
		// sprite
		this.texture = g.resources.items.textures['item-' + (itemId - 1) + '.png'];
		
		// properties
		this.itemId = itemId;
	}
}
