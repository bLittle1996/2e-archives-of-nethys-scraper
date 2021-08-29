import cheerio from "cheerio";

export const mapToCheerio = (el: Parameters<typeof cheerio>[0]) => cheerio(el);
