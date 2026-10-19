import Constants from "../Constants.js";
import Weapon from "./Weapon.js";

// weapon in the hands of a player, its missiles are in Missiles.js
export default
class WeaponShaft extends Weapon  {
	constructor(g, player) {
		super(g, player);

		this.itemId = Constants.C_WPN_SHAFT;
		this.ammo = 10; // init ammo
		this.maxAmmo = 50; // max ammo

		// sprite
		this.texture = g.resources.weapons.textures['weapons-' + (this.itemId - 2) + '.png'];
		this.container = player.graphics.container;
	}
}
