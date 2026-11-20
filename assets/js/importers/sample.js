/**
 * Handing a file the server wrote to the person, as a download.
 */

/**
 * Save some text as a file.
 *
 * @param {string}   contents What the file holds.
 * @param {string}   filename What to call it.
 * @param {Document} doc      The page.
 */
export function save( contents, filename, doc = document ) {
	const view = doc.defaultView;
	const link = doc.createElement( 'a' );

	link.href = view.URL.createObjectURL(
		new view.Blob( [ contents ], { type: 'text/csv' } )
	);
	link.download = filename;
	link.click();

	view.URL.revokeObjectURL( link.href );
}
