import { TRANSLATIONS as EN } from "./en.js";
import { TRANSLATIONS as DE } from "./de.js";

const TRANSLATIONS = {
  ...EN,
  ...DE,
};

export const localize = (hass, key) => {
  const language = hass?.locale?.language || hass?.language || "en";
  const short = language.split("-")[0];
  return TRANSLATIONS[language]?.[key]
    || TRANSLATIONS[short]?.[key]
    || TRANSLATIONS.en?.[key]
    || key;
};
