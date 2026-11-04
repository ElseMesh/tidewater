// Normalize browser input into the fishing actions shared by every renderer.
export class FishingInputController {

	constructor() {

		this.left = false;
		this.right = false;

	}

	update( { rod, runtime, input, canFish, panelOpen, onStrike, onUnavailable, onRodToggled } ) {

		if ( input?.hit( 'KeyR' ) && canFish && ! runtime.fight ) {

			rod.equip( ! rod.equipped );
			if ( ! rod.equipped ) runtime.cancel();
			onRodToggled?.( rod.equipped );

		}

		if ( ! canFish && rod.equipped ) {

			onUnavailable?.();
			rod.equip( false );

		}

		const left = Boolean( input?.mouseDown && input.enabled );
		const right = Boolean( input?.rightDown && input.enabled );
		const leftDown = left && ! this.left;
		const leftUp = ! left && this.left;
		const rightDown = right && ! this.right;
		this.left = left;
		this.right = right;

		if ( rod.equipped && ! panelOpen ) {

			if ( rod.state === 'idle' && leftDown ) rod.startWindup();
			else if ( rod.state === 'windup' && leftUp ) rod.release();
			else if ( rod.state === 'floating' && leftDown ) onStrike?.();
			else if ( rod.state === 'floating' && rightDown ) {

				rod.retrieve();
				runtime.cancel();

			} else if ( rod.state === 'flying' && rightDown ) rod.retrieve();

		}

		return { leftDown, leftUp, rightDown, leftHeld: left };

	}

}
