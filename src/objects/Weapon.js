import Constants from "../Constants.js";

// weapon of a player: ammo and item id, the held weapon is drawn by PlayerGraphics (PlayerWeaponAnim)
export default
class Weapon {
	constructor(g, player) {
		this.g = g;
		this.player = player;

		// properties
		this.ammo = 0; // current
		this.maxAmmo = 0; // max
	}

	spawn() {}
	show() {}
	hide() {}
	play() {}
	stop() {}

	addAmmo(amount) {
		this.ammo += amount;
		if (this.ammo > this.maxAmmo) {
			this.ammo = this.maxAmmo;
		}
	}

	handleCollisions(player, callback) {
		return false;
	}
}
