import { TRANSLATIONS as EN } from "./en.js";
import { TRANSLATIONS as DE } from "./de.js";
import { TRANSLATIONS as ES } from "./es.js";
import { TRANSLATIONS as FR } from "./fr.js";
import { TRANSLATIONS as IT } from "./it.js";
import { TRANSLATIONS as JA } from "./ja.js";
import { TRANSLATIONS as JS } from "./js.js";
import { TRANSLATIONS as KO } from "./ko.js";
import { TRANSLATIONS as NL } from "./nl.js";
import { TRANSLATIONS as PT } from "./pt.js";
import { TRANSLATIONS as TR } from "./tr.js";
import { TRANSLATIONS as ZH } from "./zh.js";

const TRANSLATIONS = {
  ...EN,
  ...DE,
  ...ES,
  ...FR,
  ...IT,
  ...JA,
  ...JS,
  ...KO,
  ...NL,
  ...PT,
  ...TR,
  ...ZH,
};

export const localize = (hass, key) => {
  const language = hass?.locale?.language || hass?.language || "en";
  const short = language.split("-")[0];
  return TRANSLATIONS[language]?.[key]
    || TRANSLATIONS[short]?.[key]
    || TRANSLATIONS.en?.[key]
    || key;
};
