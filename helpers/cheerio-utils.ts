import cheerio from "cheerio";
import { scrape } from "./scrape";
import { AwaitedReturnType } from "./types";

export const TEXT_NODE = 3; // Tne value of `nodeType` for text nodes.
export const REGULAR_NODE = 1; // The value of `nodeType` for regular elements

export const mapToCheerio = (el: Parameters<typeof cheerio>[0]) => cheerio(el);

export const findLabelWithText = (
  dom: AwaitedReturnType<typeof scrape>,
  text: string
) => {
  return dom("b")
    .toArray()
    .map(mapToCheerio)
    .find((el) => el.text() === text);
};

export const getNextSiblingTextNodeData = (
  el?: ReturnType<typeof mapToCheerio>
) => {
  if (!el || !el[0]) return undefined;

  const nextNode = el[0].next;

  if (nextNode?.type !== "text") return undefined;
  return (nextNode as { data?: string }).data;
};

export const removeAllAttrs = (
  el: ReturnType<typeof mapToCheerio>,
  whitelist: string[] = []
) => {
  // keep a record (well, a tuple) of attrs and their current values
  const whitelistTuples: [string, string][] = whitelist
    .filter((attr) => !!el.attr(attr))
    .map((attr) => [attr, el.attr(attr) as string]);

  // purge all attributes mwahahahaha
  Object.keys(el.attr()).forEach((attr) => el.removeAttr(attr));
  // add back the ones we want to keep
  whitelistTuples.forEach((attrAndVal) => {
    el.attr(...attrAndVal);
  });

  return el;
};
