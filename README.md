# SugarCommerce Importers

A CSV import screen: column matching, typed and checked values, a dry run
and batching, from a description of the fields.

## What it does

Importing a CSV properly is more work than it sounds. The columns are never
in the order you expect, so they have to be matched. The values are strings,
so they have to be checked and converted. A file of ten thousand rows will
time out, so it has to be batched. And a mistake found on row 4,000 is a mess
to undo, so it needs a dry run first.

This is all of that, generated from a list of fields and one callback that
handles a single row.

## Features

* Let the user match their columns to your fields, in whatever order they came
* Check and convert values by type — numbers, booleans, dates, emails, codes
* Find the post, term, user or attachment a cell names, and create a missing term
* Run the whole file without writing anything, and report what would happen
* Import in batches that stop before the server's time limit does
* Report failures per row and carry on, instead of stopping at the first
* Offer a sample file that passes its own checks
* Put several importers behind one screen, as tabs

## Installation

```bash
composer require sugarcommerce/importers
```

## Quick start

```php
use SugarCommerce\Importers\Importers;

add_action( 'init', function () {
	Importers::register( 'myplugin-import', [
		'parent_slug' => 'tools.php',
		'page_title'  => __( 'Import', 'my-plugin' ),
		'operations'  => [
			'products' => [
				'title'  => __( 'Products', 'my-plugin' ),
				'fields' => [
					'sku'   => [ 'label' => __( 'Code', 'my-plugin' ), 'required' => true ],
					'name'  => __( 'Name', 'my-plugin' ),
					'price' => [ 'label' => __( 'Price', 'my-plugin' ), 'type' => 'number', 'minimum' => 0 ],
				],
				'process_callback' => function ( array $row ) {
					// One row, already matched, checked and converted.
					return my_plugin_upsert_product( $row ) ? 'updated' : 'created';
				},
			],
		],
	] );
} );
```

`process_callback` gets a row that has been matched, checked and converted.
Everything before that point is not yours to write.

Register on `init`. The upload and batch requests go through the REST API,
which never fires `admin_menu`, so a screen registered only there has a page
but nothing behind it. A screen registered from inside `admin_menu` (or after
it) still gets its menu page, at once.

## The screen

| Key | Default | What it does |
|---|---|---|
| `page_title`, `menu_title` | `Import` | The heading and the menu label. |
| `parent_slug` | `tools.php` | The menu it goes under; `''` for a top-level page. |
| `menu_slug` | the id | The `page=` it answers to. |
| `capability` | `manage_options` | Needed to see the screen and to call every endpoint. |
| `icon`, `position` | `dashicons-upload`, `null` | For a top-level page. |
| `description` | `''` | Shown under the heading. |
| `tabs` | `[]` | `key => label` or `key => [ 'label' => …, 'icon' => … ]`. |
| `operations` | — | `key => operation`. A screen with none is refused. |

An operation names its `tab`; a tab named by an operation and not declared
is created from its key, so nothing goes missing. Tabs only show when there
is more than one.

The lookups are statics:

```php
Importers::get( 'myplugin-import' );            // the Importer, or null
Importers::url( 'myplugin-import', 'catalog' ); // its admin URL, '' when there is none
Importers::unregister( 'myplugin-import' );     // whether there was one
Importers::all();
```

`Importers::get()` is what `get_registered_importers()` was — named so
because core already declares `get_importers()` in
`wp-admin/includes/import.php`, which a static cannot collide with.

## Operations

| Key | Default | What it does |
|---|---|---|
| `title`, `description`, `icon`, `tab` | from the key | How it is shown. |
| `fields` | `[]` | `key => field`, or `key => 'Label'`. |
| `process_callback` | `null` | Given the row; returns `created`, `updated` or `skipped`, or a `WP_Error` to fail the row. Anything else counts as created. |
| `validate_callback` | `null` | Given the converted row before it is processed, dry run included; `false` or a `WP_Error` refuses it. |
| `before_import` | `null` | Given the file, before the first batch of a real import. |
| `after_import` | `null` | Given the final counts and the file, after the last. |
| `batch_size` | `100` | Rows a request, 1 to 1000. |
| `time_limit` | `20` | Seconds of rows a request; `0` for none. |
| `separator` | `,` | What separates values in the file. |

A batch stops after the row that spends its `time_limit`, however far into
its `batch_size` it is (it always does at least one row), and the next
request starts there — so a hundred rows that each call a slow API end the
request early rather than outlasting the server. The time is measured with
`sugarcommerce/jobs`' `Budget`.

A dry run ("Check without importing") goes through exactly the same steps as the
import — matching, checking, finding posts and terms, `validate_callback` —
and stops short of `process_callback` and of creating terms. Up to a hundred
row errors are kept, and the rest counted.

## Fields

| Key | What it does |
|---|---|
| `label` | What the column is called on the screen. |
| `type` | `string` (default), `number`, `integer`, `boolean`, `email`, `url`, `currency`, `country`, `date`, `datetime`, `post`, `term`, `user`, `attachment`. |
| `required` | The column must be matched, and each row must have a value. |
| `default` | Used when the cell is empty. |
| `options` | The values allowed. |
| `minimum`, `maximum` | For numbers. |
| `min_length`, `max_length`, `pattern` | For text. |
| `uppercase`, `lowercase` | Change the case. |
| `separator` | Split one cell into a list, `red|green|blue`. |
| `date_format` | The one format dates in the file must be in; without it, whatever `strtotime()` reads. Dates are read and written in the site's timezone: one with no timezone stays as written, one with an offset is converted to site time. |
| `post_type`, `post_status`, `taxonomy` | Where a `post` or `term` is looked for. |
| `match_by` | `id`, `slug`, `title`, `name`, `email`, `login` or `meta` (with `meta_key`); without it an id, then a slug, then a title or name. |
| `create` | Create a `term` that is not there yet (not on a dry run). |
| `example` | What the sample file shows. |

A `number` loses currency symbols and thousands separators (`£1,299.00` is
`1299.0`). A `country` is checked against `sugarcommerce/geo` and a
`currency` against `sugarcommerce/money` when they are installed, and
accepted as given when they are not.

The screen offers a sample file built from the fields — a byte-order mark so
Excel reads it as UTF-8, a header row and one row that passes every check —
with each cell made safe to open in a spreadsheet by `sugarcommerce/text`'s
`Csv::cell()`.

## Files

An upload must have a `.csv` name and CSV inside it. It is stored under
`uploads/importers/{screen}/` with a UUID for a name, in a directory that
refuses to be served or listed, described by a transient for a day, and
only to the person who uploaded it and only through the screen it was
uploaded to. A daily sweep deletes files nobody finished. A byte-order mark,
blank lines and duplicate header names are dealt with; a row with the wrong
number of columns is padded or trimmed and reported.

## Icons

A tab and an operation each take an `icon`, drawn before the label, in
either of two forms:

```php
Importers::register( 'myplugin-import', [
	'tabs'       => [
		'catalog'   => [ 'label' => __( 'Catalog', 'my-plugin' ), 'icon' => 'heroicons-outline:shopping-bag' ],
		'customers' => [ 'label' => __( 'Customers', 'my-plugin' ), 'icon' => 'groups' ], // a Dashicon
	],
	'operations' => [
		'products' => [
			'tab'  => 'catalog',
			'icon' => 'heroicons-outline:cube', // or 'products', or 'dashicons-products'
			// ...
		],
	],
] );
```

A `set:name` value — `heroicons-outline:*`, `heroicons-solid:*`, or any set
[sugarcommerce/fields](https://github.com/SugarCommerce/fields) knows — is
drawn as inline SVG in the text's colour; a bare Dashicons name, with or
without the `dashicons-` prefix, as the Dashicon. Both carry the
`sugarcommerce-icon` class. An operation that names no icon gets
`heroicons-outline:arrow-up-tray`. sugarcommerce/fields is suggested rather
than required: without it a `set:name` icon draws nothing, a Dashicons name
draws as it always has, and the default is the `upload` Dashicon.

The screen's own `icon`, for a top-level menu (`parent_slug` set to `''`), is
drawn by WordPress's admin menu, so it stays a Dashicons class, a URL or a
`data:image/svg+xml;base64,` URI; it defaults to `dashicons-upload`.

## Two plugins, one library

Bundled by Strauss into two plugins, each copy has its own REST namespace,
script handle, transient keys and sweep hook, worked out from its prefixed
namespace (`Utils\Runtime`): `sugarcommerce-importers` unprefixed,
`{prefix}-sugarcommerce-importers` in a prefixed build. The REST namespace
matters most: same-path routes are appended rather than replaced, so a shared
one would let the plugin that registered first answer the other's imports.

## Moving from arraypress/wp-*

`arraypress/wp-register-importers` (`ArrayPress\RegisterImporters`) is this
package. Every class, method, configuration key, field type and callback
keeps its name; the global functions are the `Importers` statics they always
called. It no longer needs `wp-composer-assets`; it now requires
`sugarcommerce/jobs` (the batch time budget) and `sugarcommerce/text` (the
sample's cells and the byte-order mark).

| Old | New |
|---|---|
| `ArrayPress\RegisterImporters\*` | `SugarCommerce\Importers\*` |
| `register_importers( $id, $config )` | `Importers::register( $id, $config )` |
| `get_registered_importers( $id )` | `Importers::get( $id )` |
| `get_registered_importers_url( $id, $tab )` | `Importers::url( $id, $tab )` |
| `unregister_importers( $id )` | `Importers::unregister( $id )` |
| `arraypress/wp-field-kit` (suggested, icons) | `sugarcommerce/fields` (suggested) |
| `arraypress/wp-countries` (suggested, `country` check) | `sugarcommerce/geo` (`Countries::exists()`) |
| `arraypress/wp-money` (suggested, `currency` check — it asked a class that was not there, so every code passed) | `sugarcommerce/money` (`Currencies::supports()`) |
| a batch was always `batch_size` rows | at most `batch_size` rows and `time_limit` seconds (default 20; `0` for the old behaviour) |
| sample cells written as given | made safe to open (`=…` gets a leading apostrophe) |
| REST namespace `importers/v1` | `sugarcommerce-importers/v1` (`Runtime::rest_namespace()`); prefixed builds `{prefix}-sugarcommerce-importers/v1` |
| script and style handle `importers` | `sugarcommerce-importers` (`Runtime::handle()`) |
| transients `importers_file_{uuid}`, `importers_run_{uuid}`, hook `importers_sweep` | `sugarcommerce_importers_…` (`Runtime::key()`, `Runtime::hook()`) |
| icon class `arraypress-icon` | `sugarcommerce-icon` (`Screen::ICON_CLASS`, the same as sugarcommerce/fields') |
| text domain `arraypress` | `sugarcommerce` |

Kept as they were: the `importers-*` CSS classes, the `assets/css/importers.css`
and `assets/js/importers.js` file names, the `uploads/importers/` directory
and the `import_file` upload field. A site whose daily sweep was scheduled by
the old copy keeps an `importers_sweep` event with nothing hooked to it until
it is cleared.

## Requirements

* PHP 8.3 or later
* WordPress 7.1 or later

## License

GPL-2.0-or-later
