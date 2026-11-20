/**
 * What PHP printed for an operation.
 *
 * The only module that reads it. Screen::operation() puts everything the
 * script needs on the operation's own element -- which importer and
 * operation it is, the copy's REST namespace, a nonce and the largest file
 * the site takes -- rather than in a global, so two operations on one
 * screen, or two Strauss-prefixed copies of the library on one site, never
 * read each other's.
 */

/**
 * One operation's settings.
 *
 * @param {HTMLElement} box The operation's element.
 * @return {Object} id, importer, operation, rest (ending in a slash), nonce
 *                  and maxSize (0 when the site set none).
 */
export function settings( box ) {
	const data = box.dataset;

	return {
		id: box.id,
		importer: data.importer || '',
		operation: data.operation || '',
		rest: String( data.rest || '' ).replace( /\/?$/, '/' ),
		nonce: data.nonce || '',
		maxSize: parseInt( data.maxSize, 10 ) || 0,
	};
}
