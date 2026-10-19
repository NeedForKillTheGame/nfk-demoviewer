import Constants from "./Constants.js";
import Utils from "./Utils.js";
import Console from "./Console.js";

// Physics repeats playerphysic() and the player movement of playermove() from the original NFK line by line.
// Source: Unit1.pas of https://github.com/NeedForKillTheGame/nfk-reconstruction (NFK 0.77 sources,
// its playermove is byte-identical to NFK.exe 0.77). The same port lives in nfk-web.

const PLAYER_MAX_VELOCITY_X = Constants.PLAYER_MAX_VELOCITY_X;

var trunc = Utils.trunc;
var round = Utils.round;
var fround = Math.fround || function (val) { return val; };

// 0.75 strafe-jump tables, indexed by player.speedJump. They are "single" in NFK, hence fround()
var strafeTableX = [0, 0.33, 0.8, 1.1, 1.4, 1.8, 2.2].map(fround);
var strafeTableY = [0, 0, 0.4, 0.8, 1.0, 1.2, 1.4].map(fround);

var logLine = 0;
var textarea = document.getElementById('log');
var newText = '';

export default
class PlayerPhysics {
	constructor(g, player) {
		this.g = g;
		this.player = player;
		this.map = g.map;

		this.defx = 0;
		this.defy = 0;
	}

	// bbb[col, round(y) div 16].block
	hasWall(col, y) {
		return this.map.isBlock(col, trunc(round(y) / 16));
	}

	playerphysic() {
		// --!-!-!=!=!= ULTIMATE 3d[Power]'s PHYSIX M0DEL =!=!=!-!-!--
		var player = this.player;
		var tmpCol, tmpY;

		this.defx = player.x;
		this.defy = player.y;
		player.velocityY = player.velocityY + 0.056; // Gravity*2.80

		if (player.velocityY > -1 && player.velocityY < 0) {
			player.velocityY /= 1.11; // progressive inertia
		}
		if (player.velocityY > 0 && player.velocityY < 5) {
			player.velocityY *= 1.1; // progressive inertia
		}

		if (player.velocityX < -0.2 || player.velocityX > 0.2) {
			// slow down only if the player stands (dir 2 or 3): no left/right key in the previous frame
			if (player.dir > Constants.DIR_RW) {
				if (player.isOnGround()) {
					player.velocityX /= 1.14;    // ongroud stop speed.
				}
				else {
					player.velocityX /= 1.025;   // inair stopspeed.
				}
			}
		} else {
			//completelly stop if velocityX less then 0.2
			player.velocityX = 0;
		}

		if (player.dead > 0 && player.isOnGround()) {
			player.velocityX /= 1.03;   // corpse stop speed.
		}

		player.x = player.x + player.velocityX;
		player.y = player.y + player.velocityY;

		// 0.75: airborne resets the grounded-frames counter
		if (!player.isOnGround()) {
			player.groundTicks = 0;
		}

		// wall CLIPPING
		if (player.crouch) {
			//VERTICAL CHECKING when crouch goes first
			if (player.isBrickCrouchOnHead() && player.isOnGround()) {
				player.velocityY = 0;
				player.y = trunc(round(player.y) / 16) * 16 + 8;
			} else if (player.isBrickCrouchOnHead() && player.velocityY < 0) {      // fly up
				player.velocityY = 0;
				player.doublejumpCountdown = 3;
				player.y = trunc(round(player.y) / 16) * 16 + 8;
			} else if (player.isOnGround() && player.velocityY > 0) {
				player.velocityY = 0;
				player.y = trunc(round(player.y) / 16) * 16 + 8;
			}
		}

		// HORZ CHECK: crouching player is checked at the new y (y-8, y, y+16), standing one at the old y (y-16, y, y+16)
		tmpY = player.crouch ? player.y : this.defy;
		if (player.velocityX < 0) {
			tmpCol = trunc(round(this.defx - 10) / 32);
			if (this.hasWall(tmpCol, tmpY - (player.crouch ? 8 : 16)) || this.hasWall(tmpCol, tmpY) || this.hasWall(tmpCol, tmpY + 16)) {
				player.x = trunc(this.defx / 32) * 32 + 9;
				player.velocityX = 0;
				player.speedJump = 0;   // 0.75: wall hit kills strafe charge
			}
		}
		if (player.velocityX > 0) {
			tmpCol = trunc(round(this.defx + 10) / 32);
			if (this.hasWall(tmpCol, tmpY - (player.crouch ? 8 : 16)) || this.hasWall(tmpCol, tmpY) || this.hasWall(tmpCol, tmpY + 16)) {
				player.x = trunc(this.defx / 32) * 32 + 22;
				player.velocityX = 0;
				player.speedJump = 0;   // 0.75: wall hit kills strafe charge
			}
		}

		//Vertical check again after x change
		if (player.isBrickOnHead() && player.isOnGround()) {
			player.velocityY = 0;
			player.y = trunc(round(player.y) / 16) * 16 + 8;
		} else if (player.isBrickOnHead() && player.velocityY < 0) {
			// fly up
			player.velocityY = 0;
			player.doublejumpCountdown = 3;
			player.y = trunc(round(player.y) / 16) * 16 + 8;
		} else if (player.isOnGround() && player.velocityY > 0) {
			player.velocityY = 0;
			if (player.groundTicks < 255) {
				player.groundTicks++; // 0.75: count grounded frames
			}
			player.y = trunc(round(player.y) / 16) * 16 + 8;
		}

		// WATER\LAVA MOVEMENT
		if (player.isInWater()) {
			if (player.velocityY < -1) player.velocityY = -1;
			if (player.velocityY > 1)  player.velocityY = 1;
			if (player.velocityX < -2) player.velocityX = -2;
			if (player.velocityX > 2)  player.velocityX = 2;
		} else {
			if (player.velocityY < -5) player.velocityY = -5;
			if (player.velocityY > 5)  player.velocityY = 5;
			if (player.velocityX < -5) player.velocityX = -5;
			if (player.velocityX > 5)  player.velocityX = 5;
		}

		if (player.y > 16 * 250) player.y = 16 * 250 - 16;
	}

	// one game tick (1/50 sec) of the player
	playermove() {
		var player = this.player;
		var speed;

		this.playerphysic();

		// players of a demo are network objects in NFK: their position, inertia, direction and crouch come
		// from the demo, and NFK runs only playerphysic() for them between the demo position updates
		if (this.g.demo)
			return;

		if (player.doublejumpCountdown > 0) {
			player.doublejumpCountdown--;
		}

		if (player.isOnGround()) {
			player.velocityY = 0;  // really nice thing :)
		}

		// Holding the jump key jumps again on every landing, NFK has no "key released" check.
		// Swimming up and the flight powerup branches of NFK are skipped.
		// isDoubleJumpPossible() of NFK always returns false, so only isOnGround() matters.
		if (player.keyUp && player.isOnGround() && !player.isBrickOnHead()) {
			// JUMP!
			// 0.75 strafe-jump charge: jumped again within 5 frames after landing
			if (player.groundTicks < 5 && player.speedJump < 6) {
				player.speedJump++;
				this.log('increase sj');
			}
			player.groundTicks = 255;

			if (player.doublejumpCountdown > 4) {
				// double jumpz
				player.doublejumpCountdown = 14;
				player.velocityY = -3;
				player.setCrouch(false);
				this.log('dj');
			} else {
				if (player.doublejumpCountdown === 0) {
					player.doublejumpCountdown = 14;
					player.jump();
				}
				player.velocityY = -2.9; // simplephysics 1 (default in 0.77), it is -2 with simplephysics 0
				this.log('jump');
			}
			player.velocityY += strafeTableY[player.speedJump]; // 0.75 strafe-jump boost
		}

		// CROUCH
		if (!player.keyUp) {
			if (player.keyDown) {
				if (player.isOnGround()) {
					player.setCrouch(true);
				}
			} else if (!player.isBrickCrouchOnHead()) {
				player.setCrouch(false);
			}
		}

		if (!player.isBrickCrouchOnHead() && !player.isOnGround()) {
			player.setCrouch(false);
		}

		// dir of the current frame is used by the next frame friction in playerphysic()
		if (player.dir < 2) {
			player.dir += 2;
		}

		if (player.keyLeft && player.keyRight) {
			player.speedJump = 0;   // 0.75: left+right cancels strafe charge
			return;
		}

		// 0.75: bleed off strafe charge when slow, or after being grounded a while
		if ((Math.abs(player.velocityX) < 3.0 || player.groundTicks > 5 && player.groundTicks < 150) && player.speedJump > 0) {
			player.speedJump--;
		}

		if (player.keyLeft) {
			speed = player.crouch ? PLAYER_MAX_VELOCITY_X - 1 : fround(PLAYER_MAX_VELOCITY_X + strafeTableX[player.speedJump]);

			if (player.velocityX > 0) player.velocityX -= 0.8; // fast turn
			if (player.velocityX > -speed) player.velocityX -= 0.35;
			if (player.velocityX < -speed) player.velocityX = -speed;
			player.dir = Constants.DIR_LW;
		}

		if (player.keyRight) {
			speed = player.crouch ? PLAYER_MAX_VELOCITY_X - 1 : fround(PLAYER_MAX_VELOCITY_X + strafeTableX[player.speedJump]);

			if (player.velocityX < 0) player.velocityX += 0.8; // fast turn
			if (player.velocityX < speed) player.velocityX += 0.35;
			if (player.velocityX > speed) player.velocityX = speed;
			player.dir = Constants.DIR_RW;
		}
	}

	log(text) {
		logLine++;
		newText = logLine
			+ ' '
			+ text
			+ ' (x: ' + this.round(this.player.x)
			+ ', y: ' + this.round(this.player.y)
			+ ', dx: ' + this.round(this.player.velocityX)
			+ ', dy: ' + this.round(this.player.velocityY)
			+ ', sj: ' + this.player.speedJump
			+ ')';
		textarea.value = newText + "\n" + textarea.value.substring(0, 1000);
		//Console.writeText(newText); // debug
	}

	round(val) {
		return trunc(val) + '.' + Math.abs(trunc(val * 10) - trunc(val) * 10)
	}

}
