import { mapToCheerio } from "../../helpers/cheerio-utils";
import { baseUrl, scrape } from "../../helpers/scrape";
import { getPageId } from "../../helpers/utils";

type Trait = {
  id: number;
  name: string;
  description: string;
  // Which "buckets" the trait falls into. For example "Air" would have the categories ["elemental", "planar"]
  categories: string[];
};

type TraitWithoutDescription = Omit<Trait, "description">;

const traitsUrl = `${baseUrl}/Traits.aspx` as const;

export const scrapeTraits = async (): Promise<Trait[]> => {
  const traits = await getAllTraits();
  let enrichedTraits: Trait[] = [];

  for (const trait of traits) {
    const enrichedTrait = enrichTraitsWithDescription(trait);
    enrichedTraits = [...enrichedTraits, enrichedTrait];
  }

  return enrichedTraits;
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
        .first() // the first sibling would be the one that is closest to the element
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

export const enrichTraitsWithDescription = (
  trait: TraitWithoutDescription
): Trait => ({ ...trait, description: "" });
