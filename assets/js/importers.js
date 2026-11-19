/**
 * Import screens.
 *
 * Choose a file, upload it, line its columns up, check it, then import it a
 * batch at a time. The walking is the only part that is not obvious: an
 * import is one request per batch, each starting where the last one said it
 * stopped, and the loop has to survive a batch that fails without either
 * stopping silently or spinning.
 *
 * Everything else is showing one step at a time and saying what happened in
 * words a person would use. The markup is the screen's (Screen.php); this
 * fills in what is only known once there is a file.
 *
 * @package SugarCommerce\Importers
 */

( function () {
	'use strict';

	var i18n = window.wp && window.wp.i18n;

	var __ = i18n ? i18n.__ : function ( text ) {
		return text;
	};

	var _n = i18n ? i18n._n : function ( single, plural, number ) {
		return 1 === number ? single : plural;
	};

	var sprintf = i18n ? i18n.sprintf : function ( format ) {
		var args = Array.prototype.slice.call( arguments, 1 );
		var index = 0;

		return format.replace( /%(?:(\d+)\$)?[sd]/g, function ( match, position ) {
			return String( args[ position ? position - 1 : index++ ] );
		} );
	};

	/**
	 * The steps, in order: the segments' `data-marker`s.
	 */
	var STEPS = [ 'choose', 'map', 'check', 'import' ];

	document.querySelectorAll( '[data-importer][data-operation]' ).forEach( setup );

	/**
	 * A number as the reader writes numbers.
	 *
	 * @param {number} number The number.
	 *
	 * @return {string} It, formatted.
	 */
	function count( number ) {
		return Number( number || 0 ).toLocaleString();
	}

	/**
	 * A file's size, the way a file manager says it.
	 *
	 * @param {number} bytes Its size.
	 *
	 * @return {string} The size.
	 */
	function size( bytes ) {
		var one = { maximumFractionDigits: 1 };

		if ( bytes < 1024 ) {
			/* translators: %s: a number of bytes. */
			return sprintf( __( '%s bytes', 'sugarcommerce' ), count( bytes ) );
		}

		if ( bytes < 1024 * 1024 ) {
			/* translators: %s: a size in kilobytes. */
			return sprintf( __( '%s KB', 'sugarcommerce' ), ( bytes / 1024 ).toLocaleString( undefined, one ) );
		}

		/* translators: %s: a size in megabytes. */
		return sprintf( __( '%s MB', 'sugarcommerce' ), ( bytes / 1024 / 1024 ).toLocaleString( undefined, one ) );
	}

	/**
	 * A name reduced to what matters when matching it to another: case,
	 * spaces and punctuation are not what makes "E-mail" a different column
	 * from "email".
	 *
	 * @param {string} name A column's name.
	 *
	 * @return {string} Its letters and digits, lower case.
	 */
	function squash( name ) {
		return String( name || '' ).toLowerCase().replace( /[^a-z0-9]+/g, '' );
	}

	/**
	 * A list of names, joined the way a sentence joins them.
	 *
	 * @param {string[]} names The names.
	 *
	 * @return {string} One string.
	 */
	function sentence( names ) {
		if ( window.Intl && Intl.ListFormat ) {
			return new Intl.ListFormat( document.documentElement.lang || undefined, { type: 'conjunction' } ).format( names );
		}

		return names.join( ', ' );
	}

	/**
	 * Wire up one operation.
	 *
	 * @param {HTMLElement} box The operation's element.
	 */
	function setup( box ) {
		var rest = box.dataset.rest.replace( /\/?$/, '/' );
		var input = box.querySelector( '[data-input="file"]' );
		var drop = box.querySelector( '[data-region="drop"]' );
		var file = null;
		var preview = null;

		var region = function ( name ) {
			return box.querySelector( '[data-region="' + name + '"]' );
		};

		var button = function ( action, within ) {
			return ( within || box ).querySelector( 'button[data-action="' + action + '"]' );
		};

		var heading = function ( section ) {
			return box.querySelector( '[data-step="' + section + '"] .importers__card-title' );
		};

		/**
		 * Copy one of the screen's icons.
		 *
		 * @param {string} name Which.
		 *
		 * @return {Node} The icon, or an empty text node.
		 */
		function icon( name ) {
			var template = document.querySelector( 'template.importers__icons' );
			var found = template && template.content.querySelector( '[data-icon="' + name + '"]' );

			return found && found.firstElementChild
				? found.firstElementChild.cloneNode( true )
				: document.createTextNode( '' );
		}

		/**
		 * Show one step's section, and move the segments along to it.
		 *
		 * The check and the import share the results card.
		 *
		 * @param {string}  name     The step: choose, map, check or import.
		 * @param {boolean} finished Whether that step is over, too.
		 */
		function step( name, finished ) {
			var section = 'check' === name || 'import' === name ? 'report' : name;
			var at = STEPS.indexOf( name );

			box.querySelectorAll( 'section[data-step]' ).forEach( function ( element ) {
				element.hidden = element.dataset.step !== section;
			} );

			box.querySelectorAll( '[data-marker]' ).forEach( function ( marker ) {
				var index = STEPS.indexOf( marker.dataset.marker );
				var current = index === at;

				marker.classList.toggle( 'is-done', index < at || ( current && !! finished ) );
				marker.classList.toggle( 'is-current', current && ! finished );

				if ( current ) {
					marker.setAttribute( 'aria-current', 'step' );
				} else {
					marker.removeAttribute( 'aria-current' );
				}
			} );

			var label = box.querySelector( '[data-marker="' + name + '"] .importers__step-label' );

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
			box.querySelectorAll( 'button[data-action]' ).forEach( function ( element ) {
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
			var notice = document.createElement( 'div' );

			notice.className = 'importers__alert';
			notice.appendChild( icon( 'warning' ) );
			notice.appendChild( document.createElement( 'p' ) ).textContent = message;

			region( 'alert' ).replaceChildren( notice );
		}

		function quiet() {
			region( 'alert' ).replaceChildren();
		}

		/**
		 * An error worth showing as it is: a reason written to be read.
		 *
		 * @param {string} message What to say.
		 *
		 * @return {Error} The error.
		 */
		function refusal( message ) {
			var error = new Error( message );

			error.readable = true;

			return error;
		}

		/**
		 * What an error means, for somebody who did not write the code.
		 *
		 * A refusal carries its own reason. What does not -- a dropped
		 * connection, a page of PHP errors where JSON should be -- is said
		 * plainly rather than passed on as "Failed to fetch".
		 *
		 * @param {Error} error What went wrong.
		 *
		 * @return {string} What to say.
		 */
		function friendly( error ) {
			if ( error && error.readable ) {
				return error.message;
			}

			if ( error instanceof TypeError ) {
				return __( 'We couldn’t reach your site. Check your connection and try again.', 'sugarcommerce' );
			}

			return __( 'Something went wrong on the server. Try again, and if it keeps happening, ask whoever looks after your site.', 'sugarcommerce' );
		}

		/**
		 * Ask the endpoints something.
		 *
		 * @param {string} path   What to ask.
		 * @param {Object} params Query arguments.
		 * @param {Object} init   Anything else fetch needs.
		 *
		 * @return {Promise<Object>} What it said.
		 */
		function ask( path, params, init ) {
			var url = new URL( rest + path, window.location.origin );

			Object.keys( params || {} ).forEach( function ( key ) {
				url.searchParams.set( key, params[ key ] );
			} );

			return fetch( url, Object.assign( {
				credentials: 'same-origin',
				headers: { 'X-WP-Nonce': box.dataset.nonce }
			}, init || {} ) ).then( function ( response ) {
				return response.json().catch( function () {
					// Not JSON at all: a fatal error, a proxy's page.
					throw new Error( response.statusText );
				} ).then( function ( body ) {
					if ( response.ok ) {
						return body;
					}

					if ( body && 'rest_cookie_invalid_nonce' === body.code ) {
						throw refusal( __( 'This page has been open a long time and your session has expired. Reload the page and try again.', 'sugarcommerce' ) );
					}

					// A refusal carries its reason, written to be read. A
					// failure that does not is named by friendly().
					if ( body && body.message ) {
						throw refusal( body.message );
					}

					throw new Error( response.statusText );
				} );
			} );
		}

		/**
		 * Show the file that was chosen, or the drop zone when none is.
		 */
		function showChosen() {
			var picked = input.files && input.files[ 0 ];

			region( 'chosen' ).hidden = ! picked;
			drop.hidden = !! picked;

			if ( picked ) {
				region( 'file-name' ).textContent = picked.name;
				region( 'file-size' ).textContent = size( picked.size );
			}
		}

		/**
		 * Take a file that has just been chosen or dropped, or say why not.
		 */
		function chosen() {
			var picked = input.files && input.files[ 0 ];
			var max = parseInt( box.dataset.maxSize, 10 ) || 0;

			quiet();

			if ( picked && ! /\.csv$/i.test( picked.name ) ) {
				/* translators: %s: the name of the file that was chosen. */
				alert( sprintf( __( '“%s” isn’t a CSV file. Save your spreadsheet as CSV (the name ends in .csv) and choose that instead.', 'sugarcommerce' ), picked.name ) );
				input.value = '';
			} else if ( picked && max && picked.size > max ) {
				/* translators: %s: the largest file the site accepts. */
				alert( sprintf( __( 'That file is larger than this site accepts (%s). Split it into smaller files and import them one at a time.', 'sugarcommerce' ), size( max ) ) );
				input.value = '';
			}

			showChosen();

			if ( input.files && input.files[ 0 ] ) {
				button( 'upload' ).focus();
			}
		}

		input.addEventListener( 'change', chosen );

		// Dragging over the zone. A count rather than dragleave alone:
		// moving over the zone's own children fires a leave for the zone.
		var depth = 0;

		drop.addEventListener( 'dragenter', function ( event ) {
			event.preventDefault();
			depth++;
			drop.classList.add( 'is-dragging' );
		} );

		drop.addEventListener( 'dragover', function ( event ) {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'copy';
		} );

		drop.addEventListener( 'dragleave', function () {
			depth = Math.max( 0, depth - 1 );

			if ( ! depth ) {
				drop.classList.remove( 'is-dragging' );
			}
		} );

		drop.addEventListener( 'drop', function ( event ) {
			var files = event.dataTransfer && event.dataTransfer.files;

			event.preventDefault();
			depth = 0;
			drop.classList.remove( 'is-dragging' );

			if ( ! files || ! files.length ) {
				return;
			}

			// The input takes a FileList, and one file is all it wants.
			var transfer = new DataTransfer();

			transfer.items.add( files[ 0 ] );
			input.files = transfer.files;

			chosen();
		} );

		var actions = {
			/**
			 * Hand back a file showing what the importer expects.
			 */
			sample: function () {
				return ask( 'sample', { page: box.dataset.importer, operation: box.dataset.operation } )
					.then( function ( body ) {
						var link = document.createElement( 'a' );

						link.href = URL.createObjectURL( new Blob( [ body.contents ], { type: 'text/csv' } ) );
						link.download = body.filename;
						link.click();

						URL.revokeObjectURL( link.href );
					} );
			},

			/**
			 * Put the chosen file back.
			 */
			clear: function () {
				input.value = '';
				quiet();
				showChosen();
				input.focus();
			},

			/**
			 * Send the chosen file, then line its columns up.
			 */
			upload: function () {
				if ( ! input.files || ! input.files.length ) {
					throw refusal( __( 'Choose a CSV file first, or drag one onto the box.', 'sugarcommerce' ) );
				}

				var body = new FormData();
				var upload = button( 'upload' );
				var label = upload.textContent;

				body.append( 'import_file', input.files[ 0 ] );

				upload.textContent = __( 'Uploading…', 'sugarcommerce' );

				return ask( 'upload', { page: box.dataset.importer }, { method: 'POST', body: body } )
					.then( function ( uploaded ) {
						// Names and nothing under them: nothing to match or
						// import, and better said now than after matching.
						if ( ! uploaded.rows ) {
							ask( 'file/' + uploaded.uuid, { page: box.dataset.importer }, { method: 'DELETE' } ).catch( function () {} );

							throw refusal( __( 'That file has column names but no rows under them. Add a row for each thing to import, then upload it again.', 'sugarcommerce' ) );
						}

						file = uploaded;

						// The first rows, to show what each column holds. The
						// screen works without them, so a failure here is not
						// one worth stopping for.
						return ask( 'file/' + uploaded.uuid, { page: box.dataset.importer } ).catch( function () {
							return null;
						} );
					} )
					.then( function ( first ) {
						preview = first;

						drawMapping( file.headers );
						step( 'map' );
						heading( 'map' ).focus();
					} )
					.finally( function () {
						upload.textContent = label;
					} );
			},

			/**
			 * Read the whole file and report, without changing anything.
			 */
			check: function () {
				var missing = unmatched();

				if ( missing.length ) {
					missing[ 0 ].focus();

					throw refusal( sprintf(
						/* translators: %s: the columns that still need one from the file, as a list. */
						__( 'Choose a column from your file for %s.', 'sugarcommerce' ),
						sentence( missing.map( function ( select ) {
							return select.dataset.label;
						} ) )
					) );
				}

				return walk( false );
			},

			/**
			 * Do it.
			 */
			import: function () {
				return walk( true );
			},

			/**
			 * Back to the columns, to change something.
			 */
			back: function () {
				quiet();
				step( 'map' );
				heading( 'map' ).focus();
			},

			/**
			 * Start again with another file, throwing this one away.
			 */
			restart: function () {
				var uuid = file && file.uuid;

				file = null;
				preview = null;
				input.value = '';

				quiet();
				showChosen();
				step( 'choose' );
				input.focus();

				if ( uuid ) {
					// Swept within the day anyway, so nobody waits on this.
					ask( 'file/' + uuid, { page: box.dataset.importer }, { method: 'DELETE' } ).catch( function () {} );
				}
			}
		};

		box.addEventListener( 'click', function ( event ) {
			var pressed = event.target.closest( 'button[data-action]' );

			if ( ! pressed || ! actions[ pressed.dataset.action ] ) {
				return;
			}

			event.preventDefault();

			if ( -1 !== [ 'upload', 'check', 'import', 'sample' ].indexOf( pressed.dataset.action ) ) {
				quiet();
			}

			busy( true );

			Promise.resolve()
				.then( actions[ pressed.dataset.action ] )
				.catch( function ( error ) {
					alert( friendly( error ) );
				} )
				.finally( function () {
					busy( false );
				} );
		} );

		/**
		 * The importer's columns, from the table that describes them.
		 *
		 * @return {Object[]} Each column's key, label, description, whether it
		 *                    is required, and its badge.
		 */
		function columns() {
			return Array.prototype.map.call( box.querySelectorAll( '.importers__columns tbody tr[data-field]' ), function ( row ) {
				var badge = row.querySelector( '.importers__needed > *' );

				return {
					key: row.dataset.field,
					label: row.dataset.label,
					holds: row.dataset.holds,
					required: row.hasAttribute( 'data-required' ),
					badge: badge ? badge.cloneNode( true ) : null
				};
			} );
		}

		/**
		 * Build the column matching rows.
		 *
		 * Each of the importer's columns gets a select holding the file's own
		 * headers, and one whose name matches is chosen already — which is
		 * most of them, most of the time. Under it, what the first row has
		 * in the column chosen: the quickest way to see a match is wrong.
		 *
		 * @param {string[]} headers The file's columns.
		 */
		function drawMapping( headers ) {
			var rows = document.createDocumentFragment();
			var all = columns();
			var matched = 0;

			all.forEach( function ( column ) {
				var id = 'map-' + box.id + '-' + column.key;
				var row = document.createElement( 'div' );
				var about = document.createElement( 'div' );
				var title = document.createElement( 'div' );
				var control = document.createElement( 'div' );
				var label = document.createElement( 'label' );
				var select = document.createElement( 'select' );
				var holds = document.createElement( 'p' );
				var value = document.createElement( 'p' );
				var none = document.createElement( 'option' );
				var wanted = [ squash( column.key ), squash( column.label ) ];
				var found = false;

				row.className = 'importers__map-row';
				about.className = 'importers__map-about';
				title.className = 'importers__map-title';
				control.className = 'importers__map-control';

				label.htmlFor = id;
				label.className = 'importers__map-label';
				label.textContent = column.label;
				title.appendChild( label );

				if ( column.badge ) {
					title.appendChild( column.badge );
				}

				holds.className = 'importers__map-holds';
				holds.id = id + '-holds';
				holds.textContent = column.holds;

				about.append( title, holds );

				select.id = id;
				select.dataset.field = column.key;
				select.dataset.label = column.label;
				select.required = column.required;
				select.setAttribute( 'aria-describedby', holds.id + ' ' + id + '-value' );

				none.value = '';
				none.textContent = column.required
					? __( 'Choose a Column', 'sugarcommerce' )
					: __( 'Don’t Import', 'sugarcommerce' );
				select.appendChild( none );

				headers.forEach( function ( header ) {
					var option = document.createElement( 'option' );

					option.value = header;
					option.textContent = header;

					if ( ! found && -1 !== wanted.indexOf( squash( header ) ) ) {
						option.selected = true;
						found = true;
					}

					select.appendChild( option );
				} );

				matched += found ? 1 : 0;

				value.className = 'importers__map-value';
				value.id = id + '-value';

				select.addEventListener( 'change', function () {
					select.removeAttribute( 'aria-invalid' );
					row.classList.remove( 'is-invalid' );
					showValue( select, value );

					// The last column it asked for has one: what the
					// warning said is no longer true.
					if ( ! box.querySelector( '.importers__map-row.is-invalid' ) ) {
						quiet();
					}
				} );

				showValue( select, value );

				control.append( select, value );
				row.append( about, control );
				rows.appendChild( row );
			} );

			region( 'mapping' ).replaceChildren( rows );

			region( 'matched' ).textContent = matched === all.length
				? sprintf(
					/* translators: %s: how many columns there are. */
					_n( 'The column was matched for you. Check it looks right.', 'All %s columns were matched for you. Check they look right.', all.length, 'sugarcommerce' ),
					count( all.length )
				)
				: sprintf(
					/* translators: 1: how many columns were matched, 2: how many there are. */
					_n( 'We matched %1$s of %2$s column for you. Choose the rest from your file.', 'We matched %1$s of %2$s columns for you. Choose the rest from your file.', all.length, 'sugarcommerce' ),
					count( matched ),
					count( all.length )
				);

			if ( ! matched ) {
				region( 'matched' ).textContent = __( 'None of your file’s column names matched, so choose a column from your file for each one below.', 'sugarcommerce' );
			}

			region( 'uploaded-name' ).textContent = file.name;
			region( 'uploaded-rows' ).textContent = sprintf(
				/* translators: %s: how many rows the file has. */
				_n( '%s row', '%s rows', file.rows, 'sugarcommerce' ),
				count( file.rows )
			);
		}

		/**
		 * What the first row has in the column a select points at.
		 *
		 * @param {HTMLSelectElement} select The select.
		 * @param {HTMLElement}       value  Where to say it.
		 */
		function showValue( select, value ) {
			var first = preview && preview.rows && preview.rows[ 0 ];

			if ( ! select.value || ! first ) {
				value.textContent = '';
				value.hidden = true;

				return;
			}

			var cell = String( null === first[ select.value ] || undefined === first[ select.value ] ? '' : first[ select.value ] ).trim();

			value.hidden = false;

			if ( '' === cell ) {
				value.textContent = __( 'Empty in the first row', 'sugarcommerce' );

				return;
			}

			/* translators: %s: what the file's first row has in the chosen column. */
			value.textContent = sprintf( __( 'First row: %s', 'sugarcommerce' ), cell.length > 60 ? cell.slice( 0, 60 ) + '…' : cell );
		}

		/**
		 * The required columns nobody has chosen a file column for, marked.
		 *
		 * @return {HTMLSelectElement[]} Their selects.
		 */
		function unmatched() {
			var missing = [];

			box.querySelectorAll( '[data-region="mapping"] select' ).forEach( function ( select ) {
				var empty = select.required && ! select.value;

				if ( empty ) {
					select.setAttribute( 'aria-invalid', 'true' );
					missing.push( select );
				} else {
					select.removeAttribute( 'aria-invalid' );
				}

				select.closest( '.importers__map-row' ).classList.toggle( 'is-invalid', empty );
			} );

			return missing;
		}

		/**
		 * What the selects say.
		 *
		 * @return {Object} Field key to column name.
		 */
		function mapping() {
			var chosen = {};

			box.querySelectorAll( '[data-region="mapping"] select' ).forEach( function ( select ) {
				if ( select.value ) {
					chosen[ select.dataset.field ] = select.value;
				}
			} );

			return chosen;
		}

		/**
		 * Walk the file, a batch at a time.
		 *
		 * @param {boolean} commit Whether to import or only report.
		 *
		 * @return {Promise} When it has finished.
		 */
		function walk( commit ) {
			var offset = 0;
			var last = null;

			step( commit ? 'import' : 'check' );

			region( 'mark' ).hidden = true;
			region( 'title' ).textContent = commit
				? __( 'Importing Your File', 'sugarcommerce' )
				: __( 'Checking Your File', 'sugarcommerce' );
			region( 'lede' ).textContent = __( 'This can take a minute for a big file. Keep this page open until it finishes.', 'sugarcommerce' );
			region( 'progress' ).hidden = false;
			region( 'summary' ).replaceChildren();
			region( 'errors' ).replaceChildren();
			region( 'report-actions' ).hidden = true;

			bar( 0, file.rows, commit );
			region( 'title' ).focus();

			var body = {
				page: box.dataset.importer,
				operation: box.dataset.operation,
				uuid: file.uuid,
				mapping: mapping(),
				commit: commit
			};

			function next() {
				return ask( 'run', {}, {
					method: 'POST',
					headers: {
						'X-WP-Nonce': box.dataset.nonce,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify( Object.assign( {}, body, { offset: offset } ) )
				} ).then( function ( result ) {
					last = result.progress;

					bar( last.done, last.total, commit );

					// The server says where it got to. Trusting the client's
					// own count instead is how a batch that returned fewer
					// rows than it was asked for turns into a loop.
					if ( result.finished || result.offset <= offset ) {
						return result;
					}

					offset = result.offset;

					return next();
				} );
			}

			return next().then( function () {
				finish( last, commit );
			}, function ( error ) {
				stopped( last, commit );

				throw error;
			} );
		}

		/**
		 * Move the bar.
		 *
		 * @param {number}  done   Rows done.
		 * @param {number}  total  Rows in all.
		 * @param {boolean} commit Whether this is an import.
		 */
		function bar( done, total, commit ) {
			var meter = region( 'bar' );
			var percent = total ? Math.min( 100, Math.round( done / total * 100 ) ) : 0;

			meter.setAttribute( 'aria-valuenow', String( percent ) );
			meter.firstElementChild.style.width = percent + '%';

			region( 'count' ).textContent = commit
				? sprintf(
					/* translators: 1: rows imported so far, 2: rows in the file. */
					_n( 'Imported %1$s of %2$s row', 'Imported %1$s of %2$s rows', total, 'sugarcommerce' ),
					count( done ),
					count( total )
				)
				: sprintf(
					/* translators: 1: rows checked so far, 2: rows in the file. */
					_n( 'Checked %1$s of %2$s row', 'Checked %1$s of %2$s rows', total, 'sugarcommerce' ),
					count( done ),
					count( total )
				);
		}

		/**
		 * Say how it went, and offer what comes next.
		 *
		 * @param {Object|null} state  What happened.
		 * @param {boolean}     commit Whether this was an import.
		 */
		function finish( state, commit ) {
			state = state || { created: 0, updated: 0, skipped: 0, failed: 0, errors: {} };

			var failed = state.failed || 0;

			// A check passes a row as "skipped": everything was done to it
			// except the one thing that writes.
			var good = commit ? ( state.created || 0 ) + ( state.updated || 0 ) : ( state.skipped || 0 );
			var title;
			var lede;

			region( 'progress' ).hidden = true;

			if ( commit ) {
				title = failed
					? __( 'Import Finished, With Some Problems', 'sugarcommerce' )
					: __( 'Import Complete', 'sugarcommerce' );

				lede = sprintf(
					/* translators: %s: how many rows were imported. */
					_n( '%s row was imported.', '%s rows were imported.', good, 'sugarcommerce' ),
					count( good )
				);

				if ( failed ) {
					lede += ' ' + sprintf(
						/* translators: %s: how many rows could not be imported. */
						_n( '%s row couldn’t be imported, and is listed below.', '%s rows couldn’t be imported, and are listed below.', failed, 'sugarcommerce' ),
						count( failed )
					);
				}

				stats( [
					[ __( 'Created', 'sugarcommerce' ), state.created, '' ],
					[ __( 'Updated', 'sugarcommerce' ), state.updated, '' ],
					[ __( 'Skipped', 'sugarcommerce' ), state.skipped, '' ],
					[ __( 'Failed', 'sugarcommerce' ), failed, failed ? 'bad' : '' ]
				] );
			} else {
				if ( ! failed ) {
					title = __( 'Your File Looks Good', 'sugarcommerce' );
					lede = sprintf(
						/* translators: %s: how many rows are ready. */
						_n( 'The row is ready to import. Nothing has been changed yet.', 'All %s rows are ready to import. Nothing has been changed yet.', good, 'sugarcommerce' ),
						count( good )
					);
				} else if ( good ) {
					title = __( 'Some Rows Need Attention', 'sugarcommerce' );
					lede = sprintf(
						/* translators: 1: "3 rows are", how many rows are ready, 2: "2 rows", how many have problems. */
						__( '%1$s ready to import and %2$s problems. Import the good rows now and the others are skipped, or fix your file and upload it again.', 'sugarcommerce' ),
						/* translators: %s: how many rows are ready. */
						sprintf( _n( '%s row is', '%s rows are', good, 'sugarcommerce' ), count( good ) ),
						/* translators: %s: how many rows have problems. */
						sprintf( _n( '%s row has', '%s rows have', failed, 'sugarcommerce' ), count( failed ) )
					);
				} else {
					title = __( 'None of the Rows Can Be Imported Yet', 'sugarcommerce' );
					lede = __( 'Every row has a problem. Check the columns are matched correctly, or fix your file and upload it again.', 'sugarcommerce' );
				}

				stats( [
					[ __( 'Ready to Import', 'sugarcommerce' ), good, good ? 'good' : '' ],
					[ __( 'With Problems', 'sugarcommerce' ), failed, failed ? 'bad' : '' ]
				] );
			}

			mark( failed ? 'warning' : 'success' );
			region( 'title' ).textContent = title;
			region( 'lede' ).textContent = lede;

			problems( state );

			var importing = button( 'import' );
			var again = button( 'restart', region( 'report-actions' ) );

			importing.hidden = commit || ! good;
			importing.textContent = sprintf(
				/* translators: %s: how many rows will be imported. */
				_n( 'Import %s Row', 'Import %s Rows', good, 'sugarcommerce' ),
				count( good )
			);

			button( 'back' ).hidden = commit;

			again.hidden = ! commit && !! good;
			again.className = commit ? 'button button-primary' : 'button';
			again.textContent = commit
				? __( 'Import Another File', 'sugarcommerce' )
				: __( 'Choose a Different File', 'sugarcommerce' );

			region( 'report-actions' ).hidden = false;

			step( commit ? 'import' : 'check', true );
			region( 'title' ).focus();
		}

		/**
		 * Say a run stopped part way, and what it managed.
		 *
		 * @param {Object|null} state  What happened before it stopped.
		 * @param {boolean}     commit Whether this was an import.
		 */
		function stopped( state, commit ) {
			region( 'progress' ).hidden = true;

			mark( 'warning' );

			region( 'title' ).textContent = commit
				? __( 'The Import Stopped', 'sugarcommerce' )
				: __( 'The Check Stopped', 'sugarcommerce' );

			region( 'lede' ).textContent = commit && state && state.done
				? sprintf(
					/* translators: %s: how many rows were done before it stopped. */
					_n( '%s row was done before it stopped, and stays imported.', '%s rows were done before it stopped, and stay imported.', state.done, 'sugarcommerce' ),
					count( state.done )
				)
				: __( 'Nothing has been changed.', 'sugarcommerce' );

			if ( state ) {
				problems( state );
			}

			var again = button( 'restart', region( 'report-actions' ) );

			button( 'import' ).hidden = true;
			button( 'back' ).hidden = false;

			again.hidden = false;
			again.className = 'button';
			again.textContent = __( 'Choose a Different File', 'sugarcommerce' );

			region( 'report-actions' ).hidden = false;
		}

		/**
		 * The mark over a result: a tick, or a warning.
		 *
		 * @param {string} name success or warning.
		 */
		function mark( name ) {
			var element = region( 'mark' );

			element.className = 'importers__mark importers__mark--' + name;
			element.replaceChildren( icon( name ) );
			element.hidden = false;
		}

		/**
		 * A row of figures.
		 *
		 * @param {Array[]} figures Label, number and tone of each.
		 */
		function stats( figures ) {
			var list = document.createElement( 'dl' );

			list.className = 'importers__stats';

			figures.forEach( function ( figure ) {
				var item = document.createElement( 'div' );
				var term = document.createElement( 'dt' );
				var value = document.createElement( 'dd' );

				item.className = 'importers__stat' + ( figure[ 2 ] ? ' importers__stat--' + figure[ 2 ] : '' );
				term.textContent = figure[ 0 ];
				value.textContent = count( figure[ 1 ] );

				item.append( term, value );
				list.appendChild( item );
			} );

			region( 'summary' ).replaceChildren( list );
		}

		/**
		 * List what went wrong, by row.
		 *
		 * @param {Object} state What has happened.
		 */
		function problems( state ) {
			var keys = Object.keys( state.errors || {} );

			if ( ! keys.length ) {
				region( 'errors' ).replaceChildren();

				return;
			}

			var wrapper = document.createElement( 'div' );
			var title = document.createElement( 'h4' );
			var items = document.createElement( 'ul' );

			wrapper.className = 'importers__problems';
			title.className = 'importers__problems-title';
			title.textContent = __( 'Rows With Problems', 'sugarcommerce' );
			items.className = 'importers__problem-list';

			keys.sort( function ( a, b ) {
				return a - b;
			} ).forEach( function ( row ) {
				var item = document.createElement( 'li' );
				var number = document.createElement( 'span' );
				var reason = document.createElement( 'span' );

				number.className = 'importers__problem-row';
				/* translators: %s: a row number in the file. */
				number.textContent = sprintf( __( 'Row %s', 'sugarcommerce' ), count( row ) );
				reason.className = 'importers__problem-reason';
				reason.textContent = state.errors[ row ];

				item.append( number, reason );
				items.appendChild( item );
			} );

			wrapper.append( title, items );

			if ( state.truncated ) {
				var more = document.createElement( 'p' );

				more.className = 'importers__problems-more';
				more.textContent = sprintf(
					/* translators: %s: how many more rows had problems. */
					_n( 'And %s more row with a problem, not listed here.', 'And %s more rows with problems, not listed here.', state.truncated, 'sugarcommerce' ),
					count( state.truncated )
				);
				wrapper.appendChild( more );
			}

			region( 'errors' ).replaceChildren( wrapper );
		}
	}
}() );
