import { resolve } from "path";
import { readCsv } from "../../csv-data";
import cheerio from "cheerio";
import {
  PFSLegality,
  Rarity,
  Source,
  SpellTradition,
} from "../../helpers/types";

export type SpellCSVEntry = {
  name: string;
  id: number;
  rarity: Rarity;
  traits: Lowercase<string>[];
  level: number;
  pfsLegality?: PFSLegality;
  isCantrip: boolean;
  isFocusSpell: boolean;
  isHeightened: boolean;
  summary: string;
  traditions: SpellTradition[];
  source: Source;
};

export const getSpellDataFromCSV = (): SpellCSVEntry[] => {
  // skip the first one since that's just column names.
  const [, ...rawSpellData]: string[] = readCsv(
    resolve(__dirname, "..", "..", "csv-data", "spells", "all-spells.csv")
  );

  return rawSpellData.map(
    ([
      nameHtml,
      pfs,
      sourceHtml,
      traditionsHtml,
      rarity,
      traits,
      isCantrip,
      isFocus,
      level,
      summary,
      heightened,
    ]) => {
      const nameDom = cheerio.load(nameHtml);
      const pfsDom = cheerio.load(pfs);
      const sourceDom = cheerio.load(sourceHtml);
      const traditionsDom = cheerio.load(traditionsHtml);
      const rarityDom = cheerio.load(rarity);
      const traitsDom = cheerio.load(traits);

      return {
        id: +((nameDom("a").attr("href")?.split("=") ?? [])[1] ?? -1),
        name: nameDom.text(),
        pfsLegality: pfsDom("img").attr("alt")?.toLowerCase() as
          | PFSLegality
          | undefined,
        traditions:
          traditionsDom.text() === "Focus"
            ? []
            : (traditionsDom("u")
                .toArray()
                .map((el) =>
                  cheerio.load(el).text().toLowerCase()
                ) as SpellTradition[]),
        rarity: rarityDom.text().toLowerCase() as Rarity,
        traits: traitsDom("a")
          .toArray()
          .map((el) => cheerio(el).text().toLowerCase()),
        isCantrip: isCantrip === "True",
        isFocusSpell: isFocus === "True",
        level: +level,
        summary,
        isHeightened: heightened === "True",
        source: sourceDom.text() as Source,
      };
    }
  );
};
