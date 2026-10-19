import Constants from "../Constants.js";
import Weapon from "./Weapon.js";

// gauntlet animates while it attacks, its sound is played by Player.weaponTick()
export default
class WeaponGauntlet extends Weapon  {
	constructor(g, player) {
		super(g, player);

		this.itemId = Constants.C_WPN_GAUNTLET;
		this.offsetX = -1;
		// sprite
		this.texture = g.resources.gauntlet.spritesheet.animations.gauntlet;
		this.animated = true;
		this.frameStopped = 0;
		this.frameStart = 1;
		this.frameEnd = 3;
		this.container = player.graphics.container;
		this.offsetX = -8;
	}
}
