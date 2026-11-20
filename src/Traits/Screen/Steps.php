<?php
/**
 * The Steps
 *
 * @package SugarCommerce\Importers
 */

declare( strict_types=1 );

namespace SugarCommerce\Importers\Traits\Screen;

use SugarCommerce\Importers\Operation;
use SugarCommerce\StatusBadge\StatusBadge;

/**
 * The screen's steps: choosing a file, matching its columns and the
 * report at the end.
 */
trait Steps {

	/**
	 * Choosing a file, and what it has to contain.
	 *
	 * The drop zone is a label for a real file input, so it is one control:
	 * pressed, it opens the file picker; tabbed to, it is the input, which a
	 * keyboard and a screen reader already know how to use; and a file
	 * dropped on it is put into that same input. Without the script it is
	 * still the input and its label.
	 *
	 * @param Operation $operation The operation.
	 * @param string    $id        The operation's element id.
	 *
	 * @return void
	 */
	private function choose( Operation $operation, string $id ): void {
		echo '<section class="importers__section" data-step="choose"><div class="importers__card">';

		printf(
			'<div class="importers__card-header"><h3 class="importers__card-title">%s</h3><p class="importers__card-description">%s</p></div>',
			esc_html__( 'Upload Your File', 'sugarcommerce' ),
			esc_html__( 'A spreadsheet saved as CSV, with the column names in the first row.', 'sugarcommerce' )
		);

		printf(
			'<div class="importers__drop" data-region="drop">' .
			'<input type="file" class="importers__file" id="%1$s-file" accept=".csv,text/csv" data-input="file" aria-describedby="%1$s-hint">' .
			'<label class="importers__drop-label" for="%1$s-file">' .
			'<span class="importers__drop-icon">%2$s</span>' .
			'<span class="importers__drop-title">%3$s</span>' .
			'<span class="importers__drop-or">%4$s</span>' .
			'<span class="importers__drop-button">%5$s</span>' .
			'</label>' .
			'<p class="importers__drop-hint" id="%1$s-hint">%6$s</p>' .
			'</div>',
			esc_attr( $id ),
			self::ui_icon( 'upload', 24 ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
			esc_html__( 'Drag and drop your CSV file here', 'sugarcommerce' ),
			esc_html__( 'or', 'sugarcommerce' ),
			esc_html__( 'Choose File', 'sugarcommerce' ),
			esc_html(
				sprintf(
					/* translators: %s: a file size. */
					__( 'CSV files up to %s', 'sugarcommerce' ),
					size_format( wp_max_upload_size() )
				)
			)
		);

		printf(
			'<div class="importers__file-bar" data-region="chosen" role="status" hidden>' .
			'<span class="importers__file-icon">%1$s</span>' .
			'<span class="importers__file-text"><span class="importers__file-name" data-region="file-name"></span><span class="importers__file-meta" data-region="file-size"></span></span>' .
			'<button type="button" class="importers__icon-button" data-action="clear" aria-label="%2$s">%3$s</button>' .
			'</div>',
			self::ui_icon( 'file' ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
			esc_attr__( 'Remove This File', 'sugarcommerce' ),
			self::ui_icon( 'remove', 18 ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
		);

		printf(
			'<div class="importers__actions"><button type="button" class="button button-primary" data-action="upload"%s>%s</button></div>',
			$operation->is_runnable() ? '' : ' disabled',
			esc_html__( 'Upload and Continue', 'sugarcommerce' )
		);

		echo '</div>';

		$this->columns( $operation );

		echo '</section>';
	}

	/**
	 * What the file has to contain.
	 *
	 * Shown before anything is uploaded, because it is what somebody needs in
	 * order to go and make the file. The script reads it back to build the
	 * matching rows: one declaration, so the two cannot disagree.
	 *
	 * @param Operation $operation The operation.
	 *
	 * @return void
	 */
	private function columns( Operation $operation ): void {
		$badges = new StatusBadge();

		echo '<div class="importers__card importers__columns">';

		printf(
			'<div class="importers__card-header importers__card-header--split"><div><h3 class="importers__card-title">%s</h3><p class="importers__card-description">%s</p></div><button type="button" class="button importers__sample" data-action="sample">%s%s</button></div>',
			esc_html__( 'What Your File Needs', 'sugarcommerce' ),
			esc_html__( 'Columns can be in any order and named however you like: you match them up after uploading.', 'sugarcommerce' ),
			self::ui_icon( 'download', 16 ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
			esc_html__( 'Download Sample File', 'sugarcommerce' )
		);

		echo '<table class="importers__table"><thead><tr>';

		printf( '<th scope="col">%s</th>', esc_html__( 'Column', 'sugarcommerce' ) );
		printf( '<th scope="col">%s</th>', esc_html__( 'What Goes In It', 'sugarcommerce' ) );
		printf( '<th scope="col" class="importers__needed">%s</th>', esc_html__( 'Needed', 'sugarcommerce' ) );

		echo '</tr></thead><tbody>';

		foreach ( $operation->fields() as $key => $field ) {
			$required = ! empty( $field['required'] );
			$badge    = $badges->render(
				$required ? 'required' : 'optional',
				$required ? StatusBadge::INFO : StatusBadge::DEFAULT,
				$required ? __( 'Required', 'sugarcommerce' ) : __( 'Optional', 'sugarcommerce' )
			);
			$example  = '' !== (string) ( $field['example'] ?? '' )
				? sprintf(
					'<span class="importers__example">%s</span>',
					esc_html(
						sprintf(
							/* translators: %s: an example value for the column. */
							__( 'Example: %s', 'sugarcommerce' ),
							(string) $field['example']
						)
					)
				)
				: '';

			printf(
				'<tr data-field="%1$s" data-label="%2$s" data-holds="%3$s"%4$s><th scope="row"><span class="importers__label">%2$s</span><code>%5$s</code></th><td><span class="importers__holds">%3$s</span>%6$s</td><td class="importers__needed">%7$s</td></tr>',
				esc_attr( (string) $key ),
				esc_html( (string) $field['label'] ),
				esc_html( self::describe( $field ) ),
				$required ? ' data-required' : '',
				esc_html( (string) $key ),
				$example, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped as it is built.
				$badge // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the badge escapes its own markup.
			);
		}

		echo '</tbody></table></div>';
	}

	/**
	 * Lining the columns up.
	 *
	 * The rows are drawn by the script once a file is uploaded and its
	 * headers are known.
	 *
	 * @param string $id The operation's element id.
	 *
	 * @return void
	 */
	private function mapping( string $id ): void {
		printf(
			'<section class="importers__section" data-step="map" hidden><div class="importers__card">' .
			'<div class="importers__card-header"><h3 class="importers__card-title" id="%1$s-map-title" tabindex="-1">%2$s</h3><p class="importers__card-description" data-region="matched"></p></div>' .
			'<div class="importers__file-bar"><span class="importers__file-icon">%3$s</span><span class="importers__file-text"><span class="importers__file-name" data-region="uploaded-name"></span><span class="importers__file-meta" data-region="uploaded-rows"></span></span><button type="button" class="button-link importers__link" data-action="restart">%4$s</button></div>' .
			'<div class="importers__map" data-region="mapping" role="group" aria-labelledby="%1$s-map-title"></div>' .
			'<div class="importers__actions"><button type="button" class="button button-primary" data-action="check">%5$s</button><p class="importers__actions-note">%6$s</p></div>' .
			'</div></section>',
			esc_attr( $id ),
			esc_html__( 'Match Columns', 'sugarcommerce' ),
			self::ui_icon( 'file' ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup from ui_icon(), escaped there.
			esc_html__( 'Choose a Different File', 'sugarcommerce' ),
			esc_html__( 'Check File', 'sugarcommerce' ),
			esc_html__( 'Checking reads every row and reports any problems, without changing anything.', 'sugarcommerce' )
		);
	}

	/**
	 * What happened: the check, the import, and the end of it.
	 *
	 * @param string $id The operation's element id.
	 *
	 * @return void
	 */
	private function report( string $id ): void {
		printf(
			'<section class="importers__section" data-step="report" hidden><div class="importers__card importers__report">' .
			'<div class="importers__mark" data-region="mark" hidden></div>' .
			'<div class="importers__card-header"><h3 class="importers__card-title" id="%1$s-report-title" data-region="title" tabindex="-1"></h3><p class="importers__card-description" data-region="lede"></p></div>' .
			'<div class="importers__progress" data-region="progress"><div class="importers__bar" role="progressbar" aria-labelledby="%1$s-report-title" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-region="bar"><span class="importers__bar-fill"></span></div><p class="importers__progress-count" data-region="count"></p></div>' .
			'<div data-region="summary"></div>' .
			'<div data-region="errors"></div>' .
			'<div class="importers__actions" data-region="report-actions" hidden>' .
			'<button type="button" class="button button-primary" data-action="import">%2$s</button>' .
			'<button type="button" class="button" data-action="back">%3$s</button>' .
			'<button type="button" class="button" data-action="restart">%4$s</button>' .
			'</div>' .
			'</div></section>',
			esc_attr( $id ),
			esc_html__( 'Import Now', 'sugarcommerce' ),
			esc_html__( 'Back to Matching', 'sugarcommerce' ),
			esc_html__( 'Import Another File', 'sugarcommerce' )
		);
	}
}
