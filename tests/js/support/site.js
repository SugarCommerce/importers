/**
 * A stand-in for the site's import endpoints, behind a stand-in apiFetch.
 *
 * Each route is `'METHOD path'` (the path after the copy's namespace, with
 * a uuid as `:uuid`) and answers with a value, or a function of the
 * request that returns one or a rejected promise. Every request is kept,
 * decoded, to be asserted on.
 */

import { vi } from 'vitest';

export const REST = 'https://example.test/wp-json/sugarcommerce-importers/v1/';

/**
 * A refusal, as apiFetch rejects with WordPress's answer.
 *
 * @param {string} code    The error's code.
 * @param {string} message Its message.
 * @param {number} status  The HTTP status.
 * @return {Promise} Rejected.
 */
export const refuse = ( code, message, status = 400 ) =>
	Promise.reject( { code, message, data: { status } } );

/**
 * The stand-in.
 *
 * @param {Object} routes What each route answers.
 * @return {Function} apiFetch, with `requests`: each one's method, route,
 *                    query, headers and decoded body.
 */
export function fakeSite( routes ) {
	const requests = [];

	const apiFetch = vi.fn( ( request ) => {
		const url = new URL( request.url );
		const path = url.href
			.slice( REST.length )
			.replace( /\?.*$/, '' )
			.replace( /[a-f0-9-]{36}/, ':uuid' );
		const route = request.method + ' ' + path;
		const seen = {
			route,
			method: request.method,
			url: request.url,
			query: Object.fromEntries( url.searchParams ),
			headers: request.headers,
			body:
				'application/json' === request.headers[ 'Content-Type' ]
					? JSON.parse( request.body )
					: request.body,
			parse: request.parse,
		};

		requests.push( seen );

		if ( ! ( route in routes ) ) {
			return refuse( 'rest_no_route', 'No route ' + route, 404 );
		}

		const answer = routes[ route ];

		return Promise.resolve(
			typeof answer === 'function' ? answer( seen ) : answer
		);
	} );

	apiFetch.requests = requests;

	return apiFetch;
}

/**
 * The answers for a file of some rows, checked and imported in batches.
 *
 * @param {Object} options        How the file goes.
 * @param {number} options.rows   Rows in the file.
 * @param {number} options.batch  Rows a batch gets through.
 * @param {Object} options.errors Reasons, by the row number that fails.
 * @return {Object} The routes.
 */
export function importing( { rows = 7, batch = 3, errors = {} } = {} ) {
	return {
		'POST upload': {
			uuid: '0f0e0d0c-0b0a-4908-8706-050403020100',
			name: 'products.csv',
			rows,
			headers: [ 'SKU', 'Cost', 'Released', 'Tags', 'State' ],
		},
		'GET file/:uuid': {
			headers: [ 'SKU', 'Cost', 'Released', 'Tags', 'State' ],
			rows: [
				{
					SKU: 'A-1',
					Cost: '10',
					Released: '',
					Tags: 'x|y',
					State: 'draft',
				},
			],
			total: rows,
		},
		'DELETE file/:uuid': { discarded: true },
		'POST run': ( { body } ) => {
			const done = Math.min( rows, body.offset + batch );
			const failed = Object.keys( errors ).filter(
				( row ) => row <= done + 1
			);
			const listed = Object.fromEntries(
				failed.map( ( row ) => [ row, errors[ row ] ] )
			);
			const good = done - failed.length;

			return {
				offset: done,
				finished: done >= rows,
				progress: {
					total: rows,
					done,
					created: body.commit ? good : 0,
					updated: 0,
					skipped: body.commit ? 0 : good,
					failed: failed.length,
					errors: listed,
				},
			};
		},
	};
}
