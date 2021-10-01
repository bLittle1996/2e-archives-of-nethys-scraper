import { writeFile } from "fs";
import { resolve } from "path";
import { promisify } from "util";
import { scrapeAllSpellsFromCSV } from "./scrapers/spells";
import { scrapeTraits } from "./scrapers/traits";

scrapeAllSpellsFromCSV()
  .then((data) => JSON.stringify(data))
  .then((jsonData) =>
    promisify(writeFile)(resolve(__dirname, "output", "spells.json"), jsonData)
  );

scrapeTraits()
  .then((data) => JSON.stringify(data))
  .then((jsonData) =>
    promisify(writeFile)(resolve(__dirname, "output", "traits.json"), jsonData)
  );
