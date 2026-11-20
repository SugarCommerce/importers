/**
 * One operation's screen: its regions, its steps, and what it says.
 *
 * The markup is the screen's (Screen.php): `data-region`s to fill in,
 * buttons named by `data-action`, a `section[data-step]` per step and the
 * segments' `data-marker`s. This finds them and moves between them; it
 * knows nothing about files or requests.
 */

import { count } from '../lib/format';
import { all, icon, make } from '../lib/dom';

/**
 * The steps, in order: the segments' `data-marker`s.
 */
export const STEPS = [ 'choose', 'map', 'check', 'import' ];

/**
 * The view of one operation's element.
 *
 * @param {HTMLElement} box The operation's element.
 * @return {Object} region(), button(), heading(), step(), busy(), alert()
 *                  and quiet(), and the `box` itself.
 */
export function createView( box ) {
	const region = ( name ) =>
		box.querySelector( '[data-region="' + name + '"]' );

	const button = ( action, within ) =>
		( within || box ).querySelector(
			'button[data-action="' + action + '"]'
		);

	const heading = ( section ) =>
		box.querySelector(
			'[data-step="' + section + '"] .importers__card-title'
		);

	/**
	 * Show one step's section, and move the segments along to it.
	 *
	 * The check and the import share the results card.
	 *
	 * @param {string}  name     The step: choose, map, check or import.
	 * @param {boolean} finished Whether that step is over, too.
	 */
	function step( name, finished ) {
		const section = 'check' === name || 'import' === name ? 'report' : name;
		const at = STEPS.indexOf( name );

		all( 'section[data-step]', box ).forEach( ( element ) => {
			element.hidden = element.dataset.step !== section;
		} );

		all( '[data-marker]', box ).forEach( ( marker ) => {
			const index = STEPS.indexOf( marker.dataset.marker );
			const current = index === at;

			marker.classList.toggle(
				'is-done',
				index < at || ( current && !! finished )
			);
			marker.classList.toggle( 'is-current', current && ! finished );

			if ( current ) {
				marker.setAttribute( 'aria-current', 'step' );
			} else {
				marker.removeAttribute( 'aria-current' );
			}
		} );

		const label = box.querySelector(
			'[data-marker="' + name + '"] .importers__step-label'
		);

		region( 'step-number' ).textContent = count( at + 1 );
		region( 'step-name' ).textContent = label ? label.textContent : '';

		box.dataset.state = name;
	}

	/**
	 * Disable every button while something is under way.
	 *
	 * @param {boolean} on Whether it is.
	 */
	function busy( on ) {
		all( 'button[data-action]', box ).forEach( ( element ) => {
			element.disabled = on;
		} );

		box.setAttribute( 'aria-busy', on ? 'true' : 'false' );
	}

	/**
	 * Say something went wrong, above the step it went wrong in.
	 *
	 * @param {string} message What, in words.
	 */
	function alert( message ) {
		const notice = make( 'div', 'importers__alert' );

		notice.appendChild( icon( 'warning', box.ownerDocument ) );
		notice.appendChild( make( 'p', '', message ) );

		region( 'alert' ).replaceChildren( notice );
	}

	/**
	 * Take back whatever was said.
	 */
	function quiet() {
		region( 'alert' ).replaceChildren();
	}

	return { box, region, button, heading, step, busy, alert, quiet };
}
