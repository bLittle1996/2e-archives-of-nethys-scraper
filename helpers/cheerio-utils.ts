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
