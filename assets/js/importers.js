/**
 * Import screens.
 *
 * Every operation on the page (`[data-importer][data-operation]`, drawn by
 * Screen.php) is wired up once the page is ready: choosing or dropping a
 * file, matching its columns, the check and the import a batch at a time.
 * The markup is the screen's; this fills in what is only known once there
 * is a file.
 *
 * Loaded by Importer::enqueue() on the screen's own page, under the copy's
 * handle (Runtime::handle()), in the footer.
 */

import apiFetch from '@wordpress/api-fetch';
import domReady from '@wordpress/dom-ready';

import { setupOperation } from './importers/operation';

domReady( () => {
	document
		.querySelectorAll( '[data-importer][data-operation]' )
		.forEach( ( box ) => setupOperation( box, { apiFetch } ) );
} );
