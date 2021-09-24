import cheerio from "cheerio";
import { scrape } from "./scrape";
import { AwaitedReturnType } from "./types";

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
  if (!el) return undefined;

  const nextNode = el[0].next;

  if (nextNode?.type !== "text") return undefined;
  return (nextNode as { data?: string }).data;
};
