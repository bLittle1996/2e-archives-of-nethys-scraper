import { Cheerio } from 'cheerio';
import { flatten, uniq } from 'lodash';
import { mapToCheerio } from '../../helpers/cheerio-utils';
import { baseUrl, scrape } from '../../helpers/scrape';
import { ActionCost, AwaitedReturnType } from '../../helpers/types';
import { wait } from '../../helpers/utils';
import task from 'tasuku';
import { getSpellDataFromCSV, SpellCSVEntry } from './data';

const spellUrl = `${baseUrl}/Spells.aspx` as const;

type SpellData = SpellCSVEntry & {
  bloodlines: Lowercase<string>[];
  deities: string[];
  numberOfActions: ActionCost | ActionCost[];
  rawContentHtml: string;
  spellComponents?: ('somatic' | 'verbal' | 'material')[];
};

export async function scrapeSpell(
  spellId: SpellCSVEntry['id']
): Promise<Omit<SpellData, keyof SpellCSVEntry>> {
  const mainContentSelector = '[id*="MainContent_DetailedOutput"]';
  const spellPageDom = await scrape(`${spellUrl}?ID=${spellId}`);

  const bloodlineLabel = spellPageDom('b')
    .toArray()
    .map(mapToCheerio)
    .find((el) => el.text() === 'Bloodline');
  const bloodlines =
    bloodlineLabel
      ?.nextUntil('br, hr', 'u')
      .toArray()
      .map(mapToCheerio)
      .filter((el) => el.find('a[href^="Bloodline.aspx"]'))
      .map((el) => el.text().toLowerCase()) ?? [];
  const deities =
    spellPageDom('b')
      .toArray()
      .map(mapToCheerio)
      .find((el) => el.text() === 'Deities')
      ?.nextUntil('br, hr', 'u')
      .toArray()
      .map(mapToCheerio)
      .filter((el) => el.find('a[href^="Deities.aspx"]'))
      .map((el) => el.text()) ?? [];

  const castLabel = spellPageDom('b')
    .toArray()
    .map(mapToCheerio)
    .find((el) => el.text() === 'Cast');

  const numberOfActions = getActionsFromImages(castLabel);
  const spellComponents = castLabel
    ?.nextUntil('hr, br')
    .toArray()
    .map(mapToCheerio)
    .filter((el) => ['somatic', 'verbal', 'material'].includes(el.text()))
    .map((el) => el.text().toLowerCase());

  return {
    bloodlines,
    deities,
    numberOfActions,
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
    let tasks: AwaitedReturnType<typeof task>[] = [];
    for (const spellDataEntry of spellData.slice(0, 10)) {
      const taskTitle = `Scraping #${spellDataEntry.id}: ${spellDataEntry.name}`;
      tasks = [
        ...tasks,
        await task(taskTitle, async ({ setTitle }) => {
          setTitle(`${taskTitle} (Waiting)`);
          await wait(1000); // wait 1 second between scrapes so we don't ddos any servers or something
          setTitle(`${taskTitle} (Scraping)`);
          const enrichedData = await scrapeSpell(spellDataEntry.id);
          data = [
            ...data,
            {
              ...spellDataEntry,
              ...enrichedData,
            },
          ];
          setTitle(`${taskTitle} (Done)`);
        }),
      ];
    }

    tasks.forEach((task) => task.clear());
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
