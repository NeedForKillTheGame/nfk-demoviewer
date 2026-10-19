import Constants from "../Constants.js";
import Weapon from "./Weapon.js";

// weapon in the hands of a player, its missiles are in Missiles.js
export default
class WeaponShotgun extends Weapon  {
	constructor(g, player) {
		super(g, player);

		this.itemId = Constants.C_WPN_SHOTGUN;
		this.ammo = 10; // init ammo
		this.maxAmmo = 50; // max ammo

	}
}
