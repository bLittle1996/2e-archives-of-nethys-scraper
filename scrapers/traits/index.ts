import cheerio from "cheerio";
import { ElementType } from "htmlparser2";
import { last } from "lodash";
import {
  mapToCheerio,
  removeAllAttrs,
  TEXT_NODE,
} from "../../helpers/cheerio-utils";
import {
  BASE_URL,
  mainContentSelector,
  scrape,
  SCRAPE_DELAY,
} from "../../helpers/scrape";
import { getPageId, wait } from "../../helpers/utils";
import task from "tasuku";

type Trait = {
  id: number;
  name: string;
  description: string;
  // Which "buckets" the trait falls into. For example "Air" would have the categories ["elemental", "planar"]
  categories: string[];
};

type TraitWithoutDescription = Omit<Trait, "description">;

const traitsUrl = `${BASE_URL}/Traits.aspx` as const;

export const scrapeTraits = async (): Promise<Trait[]> => {
  const traits = await task("Scraping traits", async ({ task: subTask }) => {
    const traits = await getAllTraits();
    let enrichedTraits: Trait[] = [];

    for (const trait of traits) {
      const traitTask = await subTask(
        `Scraping description for trait #${trait.id}: ${trait.name}`,
        async () => {
          await wait(SCRAPE_DELAY);
          const enrichedTrait = await enrichTraitsWithDescription(trait);
          enrichedTraits = [...enrichedTraits, enrichedTrait];
        }
      );
      traitTask.clear();
    }

    return enrichedTraits;
  });

  return traits.result;
};

export const getAllTraits = async (): Promise<TraitWithoutDescription[]> => {
  const html = await scrape(traitsUrl);
  const traitsWithoutDescription = html("span.trait")
    .toArray()
    .map(mapToCheerio)
    .map((el) => {
      const traitName = el.attr("title")?.toLowerCase() as string;
      const traitId = getPageId(el.find("a").attr("href") ?? "") as number;
      const category = el
        .prevAll("h2") // grab all previous h2s that are siblings of this trait
        .first() // the first sibling would be the one that is closest to the element.
        .text()
        .replace(/\straits$/i, "")
        .toLowerCase();

      return {
        id: traitId,
        name: traitName,
        category,
      };
    })
    .filter((trait) => !!trait.id)
    .reduce<TraitWithoutDescription[]>((traits, trait) => {
      const existingTrait = traits.find((t) => t.id === trait.id);

      // if we have a trait with the same id (because it rendered on the page under two+ categories)
      // then we'll just map the original trait to include the category (if any)
      if (existingTrait) {
        return traits.map((t) =>
          t === existingTrait
            ? {
                ...existingTrait,
                categories: [...t.categories, trait.category].filter(Boolean),
              }
            : t
        );
      }

      return [
        ...traits,
        {
          id: trait.id,
          name: trait.name,
          // filter out empty strings
          categories: [trait.category].filter(Boolean),
        },
      ];
    }, []);

  return traitsWithoutDescription;
};

export const enrichTraitsWithDescription = async (
  trait: TraitWithoutDescription
): Promise<Trait> => {
  const fallbackTrait = { ...trait, description: "" };
  const html = await scrape(`${traitsUrl}?ID=${trait.id}`);
  // contents() includes text nodes!!! (none of the find methods work the wy we want with the contents array tho so we need to use map/filter to do the work)
  const mainContainer = html(mainContentSelector).contents();
  const descriptionStartsIndex = Math.min(
    ...mainContainer
      .map((i, el) => (cheerio(el).is("br") ? i : Infinity))
      .toArray()
  );
  const descriptionEndsIndex = Math.min(
    ...mainContainer
      .map((i, el) =>
        cheerio(el).is("br, h2, hr") && i > descriptionStartsIndex
          ? i
          : Infinity
      )
      .toArray()
  );
  // iterate over every node from the start until the end...
  const nodes = mainContainer.filter(
    (i) => i > descriptionStartsIndex && i < descriptionEndsIndex
  );

  const description = nodes
    .map((i, el) => {
      if (el.nodeType === TEXT_NODE) {
        return (el as { data?: string }).data;
      }
      // just store the html element its wrapped in, removing all attributes except for the href (for future linking)
      return cheerio.html(removeAllAttrs(cheerio(el), ["href"]));
    })
    .toArray()
    .join("");

  return { ...trait, description };
};
