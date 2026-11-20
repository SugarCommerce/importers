/**
 * The screen's requests, and what to say when one fails.
 *
 * Through wp.apiFetch, because the nonce printed with the page runs out
 * after a day, and an import screen is the kind of page left open while
 * somebody goes and fixes their spreadsheet: apiFetch notices the stale
 * nonce, asks for a fresh one and sends the request again. Only when that
 * fails too is the person told to reload.
 *
 * Every failure is handed on as an Error, so the screen has one thing to
 * read: a refusal (`readable`) carries the server's own reason, written to
 * be read; one that never reached the site is `unreachable`; anything else
 * -- a page of PHP errors where JSON should be, a proxy's page -- is said
 * plainly by friendly() rather than passed on as it came.
 */

import { __ } from '@wordpress/i18n';

/**
 * What apiFetch rejects with when the request never got an answer.
 */
const UNREACHABLE = [ 'fetch_error', 'offline_error' ];

/**
 * An error worth showing as it is: a reason written to be read.
 *
 * @param {string} message What to say.
 * @return {Error} The error.
 */
export function refusal( message ) {
	const error = new Error( message );

	error.readable = true;

	return error;
}

/**
 * What apiFetch rejected with, as an Error the screen can read.
 *
 * @param {*} error The rejection: the body WordPress answered with, or
 *                  apiFetch's own `{ code, message }`.
 * @return {Error} The error.
 */
export function failure( error ) {
	const code = error && typeof error === 'object' ? error.code : undefined;

	if ( 'rest_cookie_invalid_nonce' === code ) {
		return refusal(
			__(
				'This page has been open a long time and your session has expired. Reload the page and try again.',
				'sugarcommerce'
			)
		);
	}

	if ( UNREACHABLE.indexOf( code ) !== -1 ) {
		const unreachable = new Error( String( error.message || code ) );

		unreachable.unreachable = true;

		return unreachable;
	}

	// The body of a refusal: WordPress's `{ code, message, data }`. Not
	// apiFetch's own word for an answer that was not JSON, and not an
	// exception, whose message was written for whoever wrote the code.
	if (
		error &&
		typeof error === 'object' &&
		! ( error instanceof Error ) &&
		'AbortError' !== error.name &&
		'invalid_json' !== code &&
		error.message
	) {
		return refusal( String( error.message ) );
	}

	// An Error is passed on as it is: a refusal already made keeps its
	// reason, and an exception says nothing a person should read.
	return error instanceof Error
		? error
		: new Error( String( ( error && error.message ) || code || error ) );
}

/**
 * What an error means, for somebody who did not write the code.
 *
 * @param {Error} error What went wrong.
 * @return {string} What to say.
 */
export function friendly( error ) {
	if ( error && error.readable ) {
		return error.message;
	}

	if ( error && error.unreachable ) {
		return __(
			'We couldn’t reach your site. Check your connection and try again.',
			'sugarcommerce'
		);
	}

	return __(
		'Something went wrong on the server. Try again, and if it keeps happening, ask whoever looks after your site.',
		'sugarcommerce'
	);
}

/**
 * A request function for one operation's endpoints.
 *
 * @param {Function} apiFetch      wp.apiFetch, or a stand-in.
 * @param {Object}   options       The operation's settings.
 * @param {string}   options.rest  Its REST base, ending in a slash.
 * @param {string}   options.nonce Its REST nonce.
 * @param {string}   origin        What a relative base is resolved against.
 * @return {Function} ( path, { params, method, body, json } ) => Promise of
 *                    the decoded answer; rejects with failure().
 */
export function createAsk(
	apiFetch,
	{ rest, nonce },
	origin = window.location.origin
) {
	return ( path, { params = {}, method = 'GET', body, json } = {} ) => {
		const url = new URL( rest + path, origin );

		Object.keys( params ).forEach( ( key ) => {
			url.searchParams.set( key, params[ key ] );
		} );

		const request = {
			url: url.toString(),
			method,
			headers: { 'X-WP-Nonce': nonce },
			parse: true,
		};

		if ( json !== undefined ) {
			request.headers[ 'Content-Type' ] = 'application/json';
			request.body = JSON.stringify( json );
		} else if ( body !== undefined ) {
			request.body = body;
		}

		return apiFetch( request ).then(
			( answer ) => {
				// Every endpoint answers with an object. Nothing at all is
				// a server that stopped part way.
				if ( null === answer || undefined === answer ) {
					throw new Error( 'empty answer' );
				}

				return answer;
			},
			( error ) => Promise.reject( failure( error ) )
		);
	};
}
