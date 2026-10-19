import SpecialObject from "./SpecialObject.js";
import Constants from "../Constants.js";
import Sound from "../Sound.js";
import PIXI from "PIXI";

// Door of a map. In a demo NFK does not run the door logic: the door is opened and closed only by
// DDEMO_OBJCHANGESTATE, and MAPOBJ_think() animates it and makes its bricks solid while it is closed.
export default
class Door extends SpecialObject {
	constructor(g, x, y, obj) {
		super(g, x, y);

		// door properties
		this.orient = obj.orient; // 0, 2 - horizontal, 1, 3 - vertical
		this.length = obj.length;
		this.col = obj.x;
		this.row = obj.y;

		this.texture = g.resources.door.texture.clone();
		this.texture.frame = new PIXI.Rectangle(
			this.isHorizontal() ? Constants.BRICK_WIDTH : 0,
			0,
			Constants.BRICK_WIDTH,
			Constants.BRICK_HEIGHT);
		this.texture_repeat = true;

		if (this.isHorizontal())
			this.width = Constants.BRICK_WIDTH * obj.length;
		else
			this.height = Constants.BRICK_HEIGHT * obj.length;

		// 1 - closed, 0 - open. Doors with orient 0 and 1 are closed on the map load, 2 and 3 are open
		this.target = (this.orient == 0 || this.orient == 1) ? 1 : 0;
		this.nowanim = 0; // 6 ticks of the open/close animation
	}

	isHorizontal() {
		return this.orient == 0 || this.orient == 2;
	}

	spawn() {
		super.spawn();
		this.tick();
	}

	// the door is controlled by the demo, not by players
	handleCollisions(player) {
		return false;
	}

	// DDEMO_OBJCHANGESTATE
	setState(state) {
		if (this.target == state)
			return;
		this.nowanim = 6;
		this.target = state;
		Sound.play(state == 1 ? 'door_close' : 'door_open');
	}

	// MAPOBJ_think() of a door in the demo playback
	tick() {
		if (this.nowanim > 0)
			this.nowanim--;

		// the viewer has only the sprite of the closed door, so the animation frames are shown by the transparency
		var opened = this.target == 1 ? this.nowanim / 6 : 1 - this.nowanim / 6;
		this.sprite.alpha = 1 - opened;

		this.setBlocks(this.target == 1);
	}

	setBlocks(closed) {
		for (var i = 0; i < this.length; i++) {
			if (this.isHorizontal())
				this.g.map.setDoorBlock(this.col + i, this.row, closed);
			else
				this.g.map.setDoorBlock(this.col, this.row + i, closed);
		}
	}

	destroy() {
		this.setBlocks(false);
		super.destroy();
	}
}
