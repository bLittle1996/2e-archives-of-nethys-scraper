import { writeFile } from "fs";
import { resolve } from "path";
import { promisify } from "util";
import { scrapeAllSpellsFromCSV } from "./scrapers/spells";

scrapeAllSpellsFromCSV()
  .then((data) => JSON.stringify(data))
  .then((jsonData) =>
    promisify(writeFile)(resolve(__dirname, "output", "spells.json"), jsonData)
  );
