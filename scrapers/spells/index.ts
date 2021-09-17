import { Cheerio } from 'cheerio';
import { flatten, uniq } from 'lodash';
import { mapToCheerio } from '../../helpers/cheerio-utils';
import { baseUrl, scrape } from '../../helpers/scrape';
import { ActionCost } from '../../helpers/types';
import { getSpellDataFromCSV, SpellCSVEntry } from './data';

const spellUrl = `${baseUrl}/Spells.aspx` as const;

type SpellData = SpellCSVEntry & {
  bloodlines: Lowercase<string>[];
  deities: string[];
  numberOfActions: ActionCost | ActionCost[];
  rawContentHtml: string;
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

  return {
    bloodlines,
    deities,
    numberOfActions,
    rawContentHtml: spellPageDom(mainContentSelector).html() ?? '',
  };
}

export async function scrapeAllSpellsFromCSV(): Promise<SpellData[]> {
  const spellData = getSpellDataFromCSV().filter((spell) => !spell.isHeightened); // We don't want to include heightened spells, just the unheightened variant

  let data: SpellData[] = [];

  for (const spellDataEntry of spellData.filter((spell) => spell.id === 484)) {
    const enrichedData = await scrapeSpell(spellDataEntry.id);
    data = [
      ...data,
      {
        ...spellDataEntry,
        ...enrichedData,
      },
    ];
  }

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
