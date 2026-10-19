import GameObject from "./GameObject.js";
import Constants from "./../Constants.js";

// Item of a map. In a demo NFK does not give items to players by itself (ClipItems exits in the demo playback):
// an item disappears by DDEMO_ITEMDISSAPEAR and appears again by DDEMO_ITEMAPEAR
export default
class SimpleObject extends GameObject {
	constructor(g, x, y) {
		super(g, x, y);

		this.col = Math.round(x / Constants.BRICK_WIDTH);
		this.row = Math.round(y / Constants.BRICK_HEIGHT);
		this.respawned = true;
		this.scale = 0xFF; // r_alphaitemsrespawn: an appearing item fades in
	}

	isPowerup() {
		return this.itemId >= Constants.IT_POWERUP_REGENERATION && this.itemId <= Constants.IT_POWERUP_INVISIBILITY;
	}

	spawn() {
		super.spawn();

		// on the match start the powerups appear later (in 30..60 seconds), the demo shows them
		if (this.isPowerup())
			this.disappear();
	}

	disappear() {
		this.respawned = false;
		this.hide();
	}

	appear() {
		this.respawned = true;
		this.scale = 0;
		this.show();
		this.tick();
	}

	tick() {
		if (this.scale < 0xFF)
			this.scale += 15;
		this.sprite.alpha = this.scale / 0xFF;
	}

	// items are taken by the demo events
	handleCollisions(player) {
		return false;
	}
}
