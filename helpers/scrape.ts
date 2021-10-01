import fetch from "node-fetch";
import cheerio from "cheerio";

export const BASE_URL = "https://2e.aonprd.com";
export const SCRAPE_DELAY = 1000;
export const mainContentSelector = '[id*="MainContent_DetailedOutput"]';

export const scrape = (...params: Parameters<typeof fetch>) =>
  fetch(params[0], params[1])
    .then((result) => result.text())
    .then((text) => cheerio.load(text));
