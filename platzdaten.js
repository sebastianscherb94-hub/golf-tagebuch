'use strict';

/* ---------- Eingebaute Scorekarten ----------
   Damit die Löcher nicht von Hand eingetragen werden müssen. Die App erkennt den Platz über den Standort
   (Koordinaten = Clubhaus) und übernimmt Par, Hcp, Längen, CR und Slope für den gewählten Abschlag.

   Quellen (Stand Oktober 2026): öffentliche Scorekarten auf GolfPass, Allsquare, 18Birdies, Hole19 und
   im Albrecht Golf Guide (1golf.eu). Die Seiten widersprechen sich teilweise – wo das so war, steht es
   unter "pruefen" und wird in der App beim Platz angezeigt. Am verlässlichsten ist die Scorekarte vom Club.

   Neuen Platz ergänzen: einfach einen weiteren Eintrag nach demselben Muster anfügen.
   par/hcp: 18 Werte, Loch 1–18. len: Meter pro Loch oder null, wenn unbekannt.
   Danach in sw.js die CACHE-Nummer hochzählen. */

const PLATZ_DB = [
  {
    key: 'luftenberg',
    name: 'Linzer Golfclub Luftenberg',
    ort: 'Luftenberg an der Donau',
    lat: 48.27002, lon: 14.41206,
    par: [4, 5, 4, 3, 4, 4, 3, 5, 4, 4, 4, 5, 3, 4, 3, 4, 3, 5],
    hcp: [9, 5, 1, 17, 11, 15, 13, 3, 7, 4, 6, 8, 14, 10, 16, 2, 18, 12],
    tees: [
      { name: 'Weiß (Herren)', cr: 72.0, slope: 126,
        len: [315, 517, 363, 169, 359, 322, 161, 444, 334, 380, 382, 511, 185, 396, 149, 366, 178, 507] },
      { name: 'Gelb (Herren)', cr: 70.7, slope: 125,
        len: [315, 503, 356, 155, 351, 308, 148, 428, 320, 369, 367, 492, 166, 368, 149, 366, 168, 498] },
      { name: 'Blau (Damen)', cr: 73.7, slope: 122,
        len: [289, 447, 309, 143, 317, 282, 139, 390, 291, 348, 331, 453, 161, 337, 127, 354, 157, 429] },
      { name: 'Rot (Damen)', cr: 72.4, slope: 119,
        len: [274, 435, 309, 143, 290, 282, 139, 368, 273, 333, 311, 433, 161, 337, 127, 291, 154, 410] },
    ],
    pruefen: 'Eine ältere Quelle nennt eine andere Hcp-Reihenfolge – bitte einmal mit der Scorekarte vergleichen.',
  },
  {
    key: 'metzenhof',
    name: 'Golfpark Metzenhof',
    ort: 'Kronstorf',
    lat: 48.12941, lon: 14.43515,
    par: [5, 4, 3, 5, 3, 4, 3, 4, 4, 4, 4, 5, 3, 4, 3, 4, 4, 5],
    hcp: [2, 4, 10, 14, 16, 6, 12, 8, 18, 13, 7, 9, 17, 3, 11, 15, 1, 5],
    tees: [
      { name: 'Weiß (Herren)', cr: 70.3, slope: 131,
        len: [517, 361, 162, 450, 142, 348, 153, 337, 315, 316, 354, 482, 179, 387, 141, 283, 411, 469] },
      { name: 'Gelb (Herren)', cr: 69.5, slope: 126,
        len: [495, 333, 143, 450, 142, 334, 153, 292, 303, 295, 337, 460, 167, 387, 131, 273, 382, 438] },
      { name: 'Gelb (Damen)', cr: 75.3, slope: 129,
        len: [495, 333, 143, 450, 142, 334, 153, 292, 303, 295, 337, 460, 167, 387, 131, 273, 382, 438] },
      { name: 'Blau (Herren)', cr: 66.7, slope: 116,
        len: [469, 291, 133, 428, 125, 302, 137, 278, 266, 248, 297, 445, 139, 314, 118, 246, 350, 416] },
      { name: 'Blau (Damen)', cr: 71.9, slope: 125,
        len: [469, 291, 133, 428, 125, 302, 137, 278, 266, 248, 297, 445, 139, 314, 118, 246, 350, 416] },
      { name: 'Rot (Herren)', cr: 65.3, slope: 110,
        len: [450, 285, 119, 374, 118, 302, 123, 258, 247, 248, 290, 402, 126, 289, 113, 238, 333, 396] },
      { name: 'Rot (Damen)', cr: 70.1, slope: 120,
        len: [450, 285, 119, 374, 118, 302, 123, 258, 247, 248, 290, 402, 126, 289, 113, 238, 333, 396] },
    ],
    pruefen: '',
  },
  {
    key: 'kremstal-ab',
    name: 'Golf Resort Kremstal (Kurs A+B)',
    ort: 'Kematen an der Krems',
    lat: 48.10820, lon: 14.18334,
    par: [4, 3, 5, 4, 4, 4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 4, 3, 5],
    hcp: [5, 15, 3, 1, 7, 17, 11, 13, 9, 2, 12, 8, 16, 6, 10, 4, 18, 14],
    tees: [
      { name: 'Weiß (Herren)', cr: 72.2, slope: 123,
        len: [350, 153, 514, 416, 379, 259, 481, 195, 252, 404, 209, 489, 335, 374, 343, 389, 127, 497] },
      { name: 'Gelb (Herren)', cr: 70.6, slope: 127,
        len: [343, 145, 493, 404, 343, 259, 471, 180, 252, 384, 190, 465, 304, 344, 333, 368, 121, 473] },
      { name: 'Blau', cr: 68.9, slope: 118,
        len: [343, 133, 462, 345, 330, 227, 450, 156, 229, 364, 170, 438, 304, 300, 304, 357, 121, 450] },
      { name: 'Schwarz (Damen)', cr: 74.4, slope: 131,
        len: [343, 133, 462, 390, 330, 227, 450, 156, 229, 364, 170, 438, 304, 300, 304, 357, 121, 450] },
      { name: 'Rot (Damen)', cr: 71.2, slope: 126,
        len: [321, 121, 396, 345, 269, 227, 450, 146, 216, 346, 150, 409, 248, 263, 284, 313, 111, 429] },
    ],
    pruefen: 'Das ist die 18-Loch-Runde aus Bergergut- und Panoramakurs (A+B). CR/Slope bitte prüfen – eine Quelle nennt für Gelb 71,3 / 127. Der 9-Loch-Scherndlgutkurs (C) ist nicht dabei.',
  },
  {
    key: 'ansfelden',
    name: 'Golfclub Stärk Linz Ansfelden',
    ort: 'Ansfelden',
    lat: 48.18774, lon: 14.29134,
    par: [5, 4, 5, 4, 4, 4, 3, 4, 3, 5, 4, 5, 4, 3, 5, 4, 3, 4],
    hcp: [9, 5, 15, 1, 11, 7, 17, 3, 13, 8, 14, 10, 12, 6, 2, 18, 16, 4],
    tees: [
      { name: 'Weiß (Herren)', cr: 72.0, slope: 123,
        len: [457, 333, 478, 382, 377, 341, 183, 345, 185, 470, 321, 513, 278, 170, 505, 249, 162, 435] },
      { name: 'Gelb (Herren)', cr: 71.2, slope: 126,
        len: [448, 326, 478, 376, 367, 323, 168, 338, 177, 458, 321, 513, 272, 164, 488, 249, 143, 415] },
      { name: 'Blau (Damen)', cr: 74.2, slope: 124,
        len: [404, 280, 452, 346, 335, 320, 163, 297, 161, 413, 280, 456, 236, 156, 451, 241, 134, 366] },
      { name: 'Rot (Damen)', cr: 72.9, slope: 120,
        len: [404, 280, 421, 341, 324, 299, 145, 291, 154, 413, 268, 456, 236, 146, 433, 235, 104, 345] },
    ],
    pruefen: '',
  },
  {
    key: 'herzog-tassilo',
    name: 'Golfclub Herzog Tassilo',
    ort: 'Bad Hall',
    lat: 48.03589, lon: 14.19115,
    par: [4, 4, 3, 5, 5, 4, 4, 3, 4, 4, 5, 3, 5, 4, 3, 4, 4, 3],
    hcp: [7, 9, 13, 15, 5, 11, 3, 17, 1, 8, 16, 12, 14, 2, 18, 6, 4, 10],
    tees: [
      { name: 'Weiß (Herren)', cr: 70.9, slope: 130,
        len: [396, 334, 179, 462, 458, 386, 329, 130, 409, 398, 470, 189, 440, 314, 145, 283, 366, 212] },
      { name: 'Gelb (Herren)', cr: 70.1, slope: 129,
        len: [340, 315, 179, 462, 458, 332, 329, 130, 398, 398, 455, 189, 440, 314, 145, 283, 321, 212] },
      { name: 'Blau (Herren)', cr: 67.8, slope: 119, len: null },
      { name: 'Rot (Herren)', cr: 66.7, slope: 119, len: null },
      { name: 'Blau (Damen)', cr: 73.2, slope: 127, len: null },
      { name: 'Rot (Damen)', cr: 71.9, slope: 123, len: null },
    ],
    pruefen: 'Für Blau und Rot habe ich keine Längen pro Loch gefunden – die kannst du beim Platz selbst eintragen.',
  },
  {
    key: 'wels',
    name: 'Golf-Club Wels',
    ort: 'Weißkirchen an der Traun',
    lat: 48.13717, lon: 14.10298,
    par: [4, 4, 4, 5, 3, 5, 3, 4, 3, 4, 4, 4, 4, 5, 5, 3, 4, 4],
    hcp: [1, 11, 3, 7, 15, 9, 17, 5, 13, 14, 10, 6, 8, 12, 16, 18, 2, 4],
    tees: [
      { name: 'Gelb (Herren)', cr: 72.9, slope: 131,
        len: [328, 362, 333, 491, 193, 452, 171, 389, 165, 359, 317, 360, 322, 450, 448, 131, 396, 360] },
      { name: 'Blau (Herren)', cr: 70.6, slope: 126,
        len: [285, 319, 308, 460, 176, 405, 151, 343, 147, 319, 295, 331, 287, 420, 392, 114, 378, 316] },
      { name: 'Rot (Damen)', cr: 75.1, slope: 132,
        len: [285, 319, 280, 423, 165, 398, 131, 343, 142, 319, 295, 331, 281, 411, 392, 114, 378, 316] },
    ],
    pruefen: 'Die Quellen nennen zwei verschiedene Hcp-Reihenfolgen und unterschiedliche CR/Slope-Werte – bitte einmal mit der Scorekarte vom Club vergleichen.',
  },
];
