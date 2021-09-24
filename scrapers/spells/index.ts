import { Cheerio } from 'cheerio';
import { flatten, uniq } from 'lodash';
import task from 'tasuku';
import {
  findLabelWithText,
  getNextSiblingTextNodeData,
  mapToCheerio,
} from '../../helpers/cheerio-utils';
import { baseUrl, scrape } from '../../helpers/scrape';
import { ActionCost } from '../../helpers/types';
import { wait } from '../../helpers/utils';
import { getSpellDataFromCSV, SpellCSVEntry } from './data';

const spellUrl = `${baseUrl}/Spells.aspx` as const;

type SpellData = SpellCSVEntry & {
  bloodlines: Lowercase<string>[];
  deities: string[];
  domains: string[];
  numberOfActions: ActionCost | ActionCost[];
  duration?: string;
  range?: string;
  area?: string;
  targets?: string;
  trigger?: string;
  savingThrow?: 'fortitude' | 'reflex' | 'will';
  isBasicSave?: boolean;
  rawContentHtml: string;
  spellComponents?: ('somatic' | 'verbal' | 'material')[];
};

export async function scrapeSpell(
  spellId: SpellCSVEntry['id']
): Promise<Omit<SpellData, keyof SpellCSVEntry>> {
  const mainContentSelector = '[id*="MainContent_DetailedOutput"]';
  const spellPageDom = await scrape(`${spellUrl}?ID=${spellId}`);
  const bloodlines =
    findLabelWithText(spellPageDom, 'Bloodline')
      ?.nextUntil('br, hr', 'u')
      .toArray()
      .map(mapToCheerio)
      .filter((el) => el.find('a[href^="Bloodline.aspx"]'))
      .map((el) => el.text().toLowerCase()) ?? [];
  const deities =
    findLabelWithText(spellPageDom, 'Deities')
      ?.nextUntil('br, hr', 'u')
      .toArray()
      .map(mapToCheerio)
      .filter((el) => el.find('a[href^="Deities.aspx"]'))
      .map((el) => el.text()) ?? [];
  const domains =
    findLabelWithText(spellPageDom, 'Domain')
      ?.nextUntil('br, hr', 'u')
      .toArray()
      .map(mapToCheerio)
      .filter((el) => el.find('a[href^="Domains.aspx"]'))
      .map((el) => el.text()) ?? [];
  const castLabel = findLabelWithText(spellPageDom, 'Cast');
  const numberOfActions = getActionsFromImages(castLabel);
  const spellComponents = castLabel
    ?.nextUntil('hr, br')
    .toArray()
    .map(mapToCheerio)
    .filter((el) => ['somatic', 'verbal', 'material'].includes(el.text()))
    .map((el) => el.text().toLowerCase());
  const duration = getNextSiblingTextNodeData(findLabelWithText(spellPageDom, 'Duration'));
  const range = getNextSiblingTextNodeData(findLabelWithText(spellPageDom, 'Range'));
  const targets = getNextSiblingTextNodeData(findLabelWithText(spellPageDom, 'Targets'));
  const area = getNextSiblingTextNodeData(findLabelWithText(spellPageDom, 'Targets'));
  const savingThrowLabel = findLabelWithText(spellPageDom, 'Saving Throw');
  const basicSaveLink = savingThrowLabel?.siblings('a[href="Rules.aspx?ID=329"]');
  const savingThrowText = basicSaveLink
    ? getNextSiblingTextNodeData(basicSaveLink)
    : getNextSiblingTextNodeData(savingThrowLabel);
  const trigger = getNextSiblingTextNodeData(findLabelWithText(spellPageDom, 'Trigger'));

  return {
    bloodlines,
    deities,
    domains,
    numberOfActions,
    trigger: trigger?.trim(),
    duration: duration?.trim(),
    range: range?.trim(),
    targets: targets?.trim().replace(/;$/, ''),
    area: area?.trim(),
    savingThrow: savingThrowText?.trim().toLowerCase() as SpellData['savingThrow'],
    isBasicSave: !!basicSaveLink,
    rawContentHtml: spellPageDom(mainContentSelector).html() ?? '',
    spellComponents: spellComponents?.length
      ? (spellComponents as SpellData['spellComponents'])
      : undefined,
  };
}

export async function scrapeAllSpellsFromCSV(): Promise<SpellData[]> {
  const spellData = getSpellDataFromCSV().filter((spell) => !spell.isHeightened); // We don't want to include heightened spells, just the unheightened variant

  let data: SpellData[] = [];

  await task(`Scraping ${spellData.length} spells`, async ({ task }) => {
    for (const spellDataEntry of spellData.filter((spell) => [428].includes(spell.id))) {
      const taskTitle = `Scraping #${spellDataEntry.id}: ${spellDataEntry.name}`;

      const scrapeTask = await task(taskTitle, async () => {
        await wait(1000); // wait 1 second between scrapes so we don't ddos any servers or something
        const enrichedData = await scrapeSpell(spellDataEntry.id);
        data = [
          ...data,
          {
            ...spellDataEntry,
            ...enrichedData,
          },
        ];
      });

      scrapeTask.clear();
    }
  });

  return data;
}

function getActionsFromImages(castLabelDom?: Cheerio<any>): ActionCost | ActionCost[] {
  const numberOfActions = uniq(
    flatten(
      castLabelDom
        ?.nextUntil(
          'hr, br',
          'img[alt="Single Action"],img[alt="Two Actions"],img[alt="Three Actions"],img[alt="Reaction"],img[alt="Free Action"]'
        )
        .toArray()
        .map((el): ActionCost | ActionCost[] | undefined => {
          const { alt } = el.attribs;
          if (
            alt === 'Single Action' &&
            el.next?.type === 'text' &&
            (el.next as { data?: string }).data === ' to ' &&
            (el.next?.next as { attribs?: Record<string, any> })?.attribs?.alt === 'Three Actions'
          ) {
            return ['1A', '2A'];
          } else if (alt === 'Single Action') {
            return '1A';
          } else if (alt === 'Two Actions') {
            return '2A';
          } else if (alt === 'Three Actions') {
            return '3A';
          } else if (alt === 'Free Action') {
            return 'F';
          } else if (alt === 'Reaction') {
            return 'R';
          }
        }) ?? []
    )
  );

  if (!numberOfActions.length) return;

  return numberOfActions.length === 1 ? numberOfActions[0] : numberOfActions;
}
