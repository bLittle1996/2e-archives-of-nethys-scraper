import fetch from "node-fetch";
import cheerio from "cheerio";

export const baseUrl = "https://2e.aonprd.com" as const;
export const scrape = (...params: Parameters<typeof fetch>) =>
  fetch(params[0], params[1])
    .then((result) => result.text())
    .then((text) => cheerio.load(text));
