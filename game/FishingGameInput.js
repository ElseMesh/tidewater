import { canInteractWithVendor } from './FishingGameplay.js';

export function handleFishingGameKey( {
	code,
	hud,
	activeVendor = null,
	nearVendor = Boolean( activeVendor ),
	fighting = false,
	dismissCatch = () => {},
	sellWithoutHUD = () => {},
	panelChanged = () => {},
} ) {

	if ( hud?.catchOpen && ( code === 'KeyE' || code === 'Escape' ) ) {
		dismissCatch();
		return true;
	}

	if ( code === 'KeyE' && canInteractWithVendor( { nearVendor, fighting, catchOpen: !! hud?.catchOpen } ) ) {
		if ( ! hud ) {
			if ( activeVendor?.kind !== 'buyer' ) return false;
			sellWithoutHUD();
			return true;
		}
		if ( hud.standOpen ) hud.closeStand();
		else hud.openStand( activeVendor );
		panelChanged( hud );
		return true;
	}

	if ( ( code === 'KeyI' || code === 'Tab' ) && hud ) {
		hud.toggleInventory();
		panelChanged( hud );
		return true;
	}

	if ( code === 'Escape' && hud && ( hud.standOpen || hud.invOpen ) ) {
		hud.closeStand();
		hud.toggleInventory( false );
		panelChanged( hud );
		return true;
	}

	return false;

}
