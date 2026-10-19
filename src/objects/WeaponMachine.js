import Constants from "../Constants.js";
import Weapon from "./Weapon.js";

// weapon in the hands of a player, its bullet impacts are in Missiles.js
export default
class WeaponMachine extends Weapon  {
	constructor(g, player) {
		super(g, player);

		this.itemId = Constants.C_WPN_MACHINE;
		this.ammo = 100; // max ammo
		this.maxAmmo = 100; // init ammo

		// sprite, the barrel spins when the player shoots
		this.texture = g.resources.mgun.spritesheet.animations.mgun;
		this.animated = true;
		this.animateOneTime = () => {};
		this.container = player.graphics.container;
	}
}
