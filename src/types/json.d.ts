interface JSON {
  /** Node 21+: emits `text` verbatim in `JSON.stringify`, used for 64 bit Matter ids. */
  rawJSON(text: string): unknown;
}
