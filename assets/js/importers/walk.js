/**
 * Walking a file, a batch at a time.
 *
 * The only part of the screen that is not obvious: an import is one
 * request per batch, each starting where the last one said it stopped, and
 * the loop has to survive a batch that fails without either stopping
 * silently or spinning.
 */

/**
 * Run the file through the importer, batch after batch, until the server
 * says it has finished.
 *
 * @param {Function} ask        The operation's request function.
 * @param {Object}   body       What every batch is sent: page, operation,
 *                              uuid, mapping and commit.
 * @param {Function} onProgress Called with each batch's progress.
 * @return {Promise<Object>} The last batch's answer; rejects with the
 *                           failure of the batch that failed.
 */
export function walk( ask, body, onProgress ) {
	let offset = 0;

	const next = () =>
		ask( 'run', {
			method: 'POST',
			json: { ...body, offset },
		} ).then( ( result ) => {
			onProgress( result.progress );

			// The server says where it got to. Trusting the client's own
			// count instead is how a batch that returned fewer rows than
			// it was asked for turns into a loop.
			if ( result.finished || result.offset <= offset ) {
				return result;
			}

			offset = result.offset;

			return next();
		} );

	return next();
}
