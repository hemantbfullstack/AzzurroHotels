import type { TopicId } from "./types";

export const TOPIC_META: Record<
  TopicId,
  { label: string; keywords: string[] }
> = {
  cleanliness: {
    label: "Cleanliness",
    keywords: [
      "clean",
      "dirty",
      "filthy",
      "smell",
      "smelly",
      "odour",
      "odor",
      "mould",
      "mold",
      "hygiene",
      "bathroom dirty",
      "hair",
      "stain",
      "dust",
      "cockroach",
      "bug",
      "insect",
      "unhygienic",
      "sanitary",
      "towel",
      "sheets",
      "linen",
    ],
  },
  check_in: {
    label: "Check-in experience",
    keywords: [
      "check-in",
      "check in",
      "checkin",
      "check out",
      "checkout",
      "self check",
      "key code",
      "door code",
      "access code",
      "late arrival",
      "reception desk",
      "front desk",
      "locked out",
      "couldn't get in",
      "could not get in",
    ],
  },
  staff: {
    label: "Staff / receptionist",
    keywords: [
      "staff",
      "receptionist",
      "reception",
      "manager",
      "host",
      "friendly",
      "helpful",
      "rude",
      "unhelpful",
      "attitude",
      "service",
      "customer service",
      "concierge",
    ],
  },
  noise: {
    label: "Noise",
    keywords: [
      "noise",
      "noisy",
      "loud",
      "thin wall",
      "thin walls",
      "can't sleep",
      "could not sleep",
      "couldn't sleep",
      "quiet",
      "shouting",
      "party",
      "traffic noise",
      "street noise",
    ],
  },
  facilities: {
    label: "Facilities",
    keywords: [
      "wifi",
      "wi-fi",
      "internet",
      "kitchen",
      "lift",
      "elevator",
      "laundry",
      "facilities",
      "facility",
      "shower",
      "hot water",
      "water pressure",
      "common area",
      "lounge",
      "breakfast",
      "dinner",
    ],
  },
  location: {
    label: "Location",
    keywords: [
      "location",
      "located",
      "near",
      "close to",
      "walking distance",
      "station",
      "central",
      "neighbourhood",
      "neighborhood",
      "area",
      "transport",
      "convenient",
    ],
  },
  room: {
    label: "Room condition",
    keywords: [
      "room",
      "bed",
      "mattress",
      "pillow",
      "pod",
      "bunk",
      "cramped",
      "small room",
      "tiny",
      "window",
      "aircon",
      "air con",
      "air conditioning",
      "ac ",
      "heating",
      "curtain",
      "locker",
    ],
  },
  value: {
    label: "Value for money",
    keywords: [
      "value",
      "price",
      "expensive",
      "cheap",
      "affordable",
      "worth",
      "money",
      "budget",
      "overpriced",
      "good deal",
      "value for money",
    ],
  },
};

export function classifyTopics(text: string | null | undefined): TopicId[] {
  if (!text) return [];
  const hay = text.toLowerCase();
  const hits: TopicId[] = [];
  for (const [id, meta] of Object.entries(TOPIC_META) as Array<
    [TopicId, { label: string; keywords: string[] }]
  >) {
    if (meta.keywords.some((kw) => hay.includes(kw))) hits.push(id);
  }
  return hits;
}

/** Prefer polarity-aware matching so praise for "clean" is not treated as a complaint. */
export function classifyTopicPolarity(review: {
  review_title?: string | null;
  positive_text?: string | null;
  negative_text?: string | null;
  review_text?: string | null;
}): { all: TopicId[]; positive: TopicId[]; negative: TopicId[] } {
  const positive = classifyTopics(
    [review.positive_text, review.review_title].filter(Boolean).join("\n")
  );
  const negative = classifyTopics(
    [review.negative_text].filter(Boolean).join("\n")
  );
  // Mixed/neutral reviews with only combined body text: fall back carefully
  const bodyOnly = !review.positive_text && !review.negative_text
    ? classifyTopics(review.review_text)
    : [];
  const all = Array.from(new Set([...positive, ...negative, ...bodyOnly]));
  return { all, positive, negative: [...new Set([...negative, ...bodyOnly])] };
}

export function topicLabel(id: TopicId): string {
  return TOPIC_META[id].label;
}
