import Constants from "../Constants.js";
import Weapon from "./Weapon.js";

// gauntlet animates while it attacks, its sound is played by Player.weaponTick()
export default
class WeaponGauntlet extends Weapon  {
	constructor(g, player) {
		super(g, player);

		this.itemId = Constants.C_WPN_GAUNTLET;
	}
}
