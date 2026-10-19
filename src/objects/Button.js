import SpecialObject from "./SpecialObject.js";
import Constants from "../Constants.js";
import Sound from "./../Sound.js";
import PIXI from "PIXI";

// Button of a map. In a demo it is pressed and released only by DDEMO_OBJCHANGESTATE like in NFK,
// the coloured light fades in and out by 15 of 255 per tick.
export default
class Button extends SpecialObject {
	constructor(g, x, y, obj) {
		super(g, x, y);

		this.BTN_DISABLED = 6;
		this.texture = this.frameTexture(this.BTN_DISABLED);
		this.offsetX = 4;
		this.offsetY = -4;

		// button properties
		this.orient = obj.orient; // colour
		this.pressed = 0;
		this.nowanim = 0;
	}

	frameTexture(frame) {
		var texture = this.g.resources.button.texture.clone();
		texture.frame = new PIXI.Rectangle(frame * 24, 0, 24, 24);
		return texture;
	}

	spawn() {
		super.spawn();
		this.light = new PIXI.Sprite(this.frameTexture(this.orient));
		this.light.x = this.sprite.x;
		this.light.y = this.sprite.y;
		this.container.addChild(this.light);
		this.tick();
	}

	// the button is controlled by the demo, not by players
	handleCollisions(player) {
		return false;
	}

	// DDEMO_OBJCHANGESTATE
	setState(state) {
		if (this.pressed == state)
			return;
		this.pressed = state;
		if (state == 1)
			Sound.play("button");
	}

	tick() {
		if (this.pressed == 0 && this.nowanim > 0)
			this.nowanim -= 15;
		if (this.pressed == 1 && this.nowanim < 0xFF)
			this.nowanim += 15;
		this.sprite.alpha = (0xFF - this.nowanim) / 0xFF;
		this.light.alpha = this.nowanim / 0xFF;
	}

	destroy() {
		this.container.removeChild(this.light);
		super.destroy();
	}
}
