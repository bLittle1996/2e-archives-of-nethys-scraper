export const wait = (milliseconds: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

/**
 * Scans the string for `?ID=number` or `&ID=number`. Returns the number to the right of equals sign. You can pass in partial paths, full urls, or even just the query string (including the question mark). Case insensitive.
 * @example ```ts
 * const id = getPageId("/Spells.aspx?ID=69"); // 69
 * const id = getPageId("https://2e.aonprd.com/Feats.aspx?id=fooledyou"); // undefined
 * ```
 */
export const getPageId = (urlOrPath: string): number | undefined => {
  const idRegex = /[?&]ID=(\d+)/i;
  const [, id] = idRegex.exec(urlOrPath) ?? [];

  return +id;
};
