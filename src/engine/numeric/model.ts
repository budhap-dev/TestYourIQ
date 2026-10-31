/** Public content of numerical items. Options are whole numbers shown in ascending order. */

export interface SeriesContent {
  kind: 'series';
  /** The visible terms; the next term is asked for. */
  terms: number[];
  options: number[];
}

export interface NumberAnalogyContent {
  kind: 'number-analogy';
  /** Worked examples, each `[input, output]`. */
  pairs: [number, number][];
  query: number;
  options: number[];
}
