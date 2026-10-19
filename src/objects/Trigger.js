import SpecialObject from "./SpecialObject.js";
import Constants from "../Constants.js";
import PIXI from "PIXI";

export default
class Trigger extends SpecialObject {
	constructor(g, x, y, obj) {
		super(g, x, y);

		this.texture = PIXI.Texture.EMPTY;
		this.texture_repeat = true;
		this.width = obj.length * Constants.BRICK_WIDTH;
		this.height = obj.dir * Constants.BRICK_HEIGHT;

		// trigger properties
		this.length = obj.length;
		this.dir = obj.dir;
		this.wait = obj.wait;
		this.target = obj.target;
	}

	// triggers do nothing in a demo playback of NFK, doors are opened by DDEMO_OBJCHANGESTATE
	handleCollisions(player) {
		return false;
	}
}
