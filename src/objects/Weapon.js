import GameObject from "./GameObject.js";
import Constants from "../Constants.js";


// object which can move on the direction and traectory
// when reach a player OR a brick then fires event (explosion, damage)
// Here could be all weapon bullets, including rail, machine (speed = 100 = immediate)
export default
class Weapon extends GameObject {
	constructor(g, player) {
		super(g, 0, 0);
		this.g = g;
		this.player = player;

		this.offsetX = -1;
		this.offsetY = -6;

		// properties
		this.ammo = 0; // current
		this.maxAmmo = 0; // max
	}

	spawn() {
		super.spawn();

		this.sprite.anchor.set(0.35, 0.5); // center of player
		//this.sprite.scale.x = this.sprite.scale.y =  -1;
	}

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
