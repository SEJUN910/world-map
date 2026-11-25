// HTML entity decoding shared by the culture-info and Paris imports (tested in
// cultureinfo.test.mjs). Both sources sometimes encode twice ("&amp;times;"),
// so decoding repeats a few rounds. Only real characters survive.

// Latin-1 names for U+00A0..U+00FF in code point order (HTML 4 / HTML5 legacy set).
const LATIN1 = "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml".split(" ");
export const NAMED = {
  ...Object.fromEntries(LATIN1.map((name, index) => [name, String.fromCodePoint(0xa0 + index)])),
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'",
  OElig: "Œ", oelig: "œ", Scaron: "Š", scaron: "š", Yuml: "Ÿ", fnof: "ƒ", circ: "ˆ", tilde: "˜",
  ensp: " ", emsp: " ", thinsp: " ", zwnj: "", zwj: "", lrm: "", rlm: "",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„",
  dagger: "†", Dagger: "‡", bull: "•", hellip: "…", permil: "‰", prime: "′", Prime: "″", lsaquo: "‹", rsaquo: "›",
  euro: "€", trade: "™", larr: "←", uarr: "↑", rarr: "→", darr: "↓", harr: "↔", minus: "−", sim: "∼",
  le: "≤", ge: "≥", ne: "≠", infin: "∞", hearts: "♥", spades: "♠", clubs: "♣", diams: "♦", loz: "◊",
};
// These five are also valid in all caps (&AMP; etc., not &Amp;); every other name is case-sensitive (&Eacute; ≠ &eacute;).
const CASELESS = new Set(["amp", "lt", "gt", "quot", "nbsp"]);

export function decodeEntities(value, rounds = 3) {
  let text = String(value ?? "");
  const pattern = /&(#x[0-9a-f]{1,8}|#\d{1,10}|[a-z][a-z0-9]{1,31});/gi;
  for (let round = 0; round < rounds && pattern.test(text); round++) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, (match, code) => {
      if (code[0] !== "#") return Object.hasOwn(NAMED, code) ? NAMED[code] : code === code.toUpperCase() && CASELESS.has(code.toLowerCase()) ? NAMED[code.toLowerCase()] : match;
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      // No NUL (Postgres rejects it), surrogates or out-of-range values.
      return point >= 1 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff) ? String.fromCodePoint(point) : "";
    });
    pattern.lastIndex = 0;
  }
  return text.replace(/\u0000/g, "");
}
