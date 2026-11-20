/**
 * The few DOM helpers the script shares.
 *
 * Everything the script draws is built from elements and `textContent`, so
 * a file's own words -- its name, its headers, what a cell holds -- are
 * never read as markup.
 */

/**
 * A new element with a class and, optionally, its text.
 *
 * @param {string}  tag       Tag name.
 * @param {string}  className Class attribute.
 * @param {string=} text      Text content.
 * @return {HTMLElement} The element.
 */
export function make( tag, className = '', text ) {
	const element = document.createElement( tag );

	if ( className ) {
		element.className = className;
	}

	if ( text !== undefined ) {
		element.textContent = text;
	}

	return element;
}

/**
 * Every element matching a selector, as an array.
 *
 * @param {string}           selector CSS selector.
 * @param {Document|Element} root     Where to look.
 * @return {Element[]} The elements.
 */
export const all = ( selector, root = document ) =>
	Array.from( root.querySelectorAll( selector ) );

/**
 * A copy of one of the screen's icons.
 *
 * Screen::icons() prints them once for the page, in a template, so the
 * script never builds SVG of its own: it clones whatever the screen's
 * icons are.
 *
 * @param {string}   name Which: success or warning.
 * @param {Document} doc  The page.
 * @return {Node} The icon, or an empty text node.
 */
export function icon( name, doc = document ) {
	const template = doc.querySelector( 'template.importers__icons' );
	const found =
		template &&
		template.content.querySelector( '[data-icon="' + name + '"]' );

	return found && found.firstElementChild
		? found.firstElementChild.cloneNode( true )
		: doc.createTextNode( '' );
}
