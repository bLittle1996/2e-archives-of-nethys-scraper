import csvParse from "csv-parse/lib/sync";
import { readFileSync } from "fs";

export const readCsv = (filePath: string) => csvParse(readFileSync(filePath));
