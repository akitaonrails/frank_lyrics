#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const metadata = require("../src/metadata.js");

const cases = [
  {
    name: "MASHLE Bling-Bang-Bang-Born",
    title: 'MASHLE Season 2 Opening FULL "Bling-Bang-Bang-Born" by Creepy Nuts (Lyrics)',
    description: "",
    expected: { track: "Bling-Bang-Bang-Born", artist: "Creepy Nuts" }
  },
  {
    name: "Chainsaw Man KICK BACK",
    title: 'Chainsaw Man Opening FULL \'\'KICK BACK" by Kenshi Yonezu (Lyrics)',
    description: "",
    expected: { track: "KICK BACK", artist: "Kenshi Yonezu" }
  },
  {
    name: "Dandadan Otonoke",
    title: 'Dandadan - Opening FULL "Otonoke" by Creepy Nuts (Lyrics)',
    description: "",
    expected: { track: "Otonoke", artist: "Creepy Nuts" }
  },
  {
    name: "YOASOBI Idol from description",
    title: "YOASOBI - Idol「アイドル」 Official Music Video",
    description: "Artist: YOASOBI\nTitle: アイドル",
    expected: { track: "アイドル", artist: "YOASOBI" }
  },
  {
    name: "Hana ni Natte alias",
    title: "[HD] Hana ni Natte Lyrics 花になって Be a Flower - Apothecary Diaries 薬屋のひとりごと OP | 緑黄色社会",
    description: "Song: Hana ni Natte 花になって / Be a Flower",
    expected: { track: "Hana ni Natte", artist: "Ryokuoushoku Shakai" }
  },
  {
    name: "Tokyo Revengers Cry Baby",
    title: "Tokyo Revengers Opening (Full) -Cry Baby- Lyrics",
    description: "Song : Cry Baby by Official HIGE DANdism",
    expected: { track: "Cry Baby", artist: "Official HIGE DANdism" }
  },
  {
    name: "Ado bracket artist",
    title: "【Ado】うっせぇわ",
    description: "",
    expected: { track: "うっせぇわ", artist: "Ado" }
  },
  {
    name: "OneRepublic Nobody",
    title: "OneRepublic - Nobody (from Kaiju No. 8) [Official Lyric Video]",
    description: "",
    expected: { track: "Nobody", artist: "OneRepublic" }
  },
  {
    name: "Aimer Zankyou Sanka",
    title: "Aimer 「残響散歌」 MUSIC VIDEO",
    description: "",
    expected: { track: "残響散歌", artist: "Aimer" }
  },
  {
    name: "Kimetsu Kizuna no Kiseki",
    title: 'Kimetsu no Yaiba Opening FULL "Kizuna no Kiseki" by MAN WITH A MISSION x milet (Lyrics)',
    description: "",
    expected: { track: "Kizuna no Kiseki", artist: "MAN WITH A MISSION x milet" }
  },
  {
    name: "L'Arc-en-Ciel Driver's High",
    title: "L'Arc~en~Ciel - Driver's High",
    description: "",
    expected: { track: "Driver's High", artist: "L'Arc~en~Ciel" }
  },
  {
    name: "Porno Graffitti Hitori no Yoru",
    title: "Porno Graffitti - Hitori no Yoru (GTO Opening 2)",
    description: "",
    expected: { track: "Hitori no Yoru", artist: "Porno Graffitti" }
  },
  {
    name: "Porno Graffitti Saboten pipe romanized",
    title: "ポルノグラフィティ - サボテン | Porno Graffitti - Saboten Lyrics",
    description: "",
    expected: { track: "Saboten", artist: "Porno Graffitti" }
  },
  {
    name: "THE DAY current heuristic",
    title: "THE DAY - Porno Graffiti (My Hero Academia Opening) Lyrics",
    description: "",
    expected: { track: "THE DAY", artist: "Porno Graffiti" }
  },
  {
    name: "THE DAY bracketed anime context",
    title: "THE DAY - Porno Graffiti 『The Hero Academia』OP S1",
    description: "",
    expected: { track: "THE DAY", artist: "Porno Graffiti" }
  },
  {
    name: "BONNIE PINK normal artist dash track",
    title: "BONNIE PINK - It's Gonna Rain (Romaji/English)",
    description: "",
    expected: { track: "It's Gonna Rain", artist: "BONNIE PINK" }
  },
  {
    name: "QUEEN normal artist dash track",
    title: "QUEEN - Bohemian Rhapsody",
    description: "",
    expected: { track: "Bohemian Rhapsody", artist: "QUEEN" }
  },
  {
    name: "Maaya Sakamoto Kiseki No Umi",
    title: "Maaya Sakamoto / Kiseki No Umi English Translation",
    description: "",
    expected: { track: "Kiseki No Umi", artist: "Maaya Sakamoto" }
  },
  {
    name: "Magic Knight Rayearth Yuzurenai Negai",
    title: 'Magic Knight Rayearth Opening FULL "Yuzurenai Negai" by Naomi Tamura (Lyrics)',
    description: "",
    expected: { track: "Yuzurenai Negai", artist: "Naomi Tamura" }
  },
  {
    name: "Clamp in Wonderland track-only",
    title: "Clamp in Wonderland  - Music Video + Lyrics",
    description: "",
    expected: { track: "Clamp in Wonderland", artist: "" }
  },
  {
    name: "Trust You Forever singer from description",
    title: "[Vietsub + Lyrics] Trust You Forever | Yoshifumi Ushima | Mobile Fighter G Gundam Opening 2",
    description: "Trans + Edit: Vino\nSinger: Yoshifumi Ushima",
    expected: { track: "Trust You Forever", artist: "Yoshifumi Ushima" }
  },
  {
    name: "Curio description metadata",
    title: "Curio - Kimi Ni Fureru Dake De (Rorouni Kenshin 3rd Opening) [Romaji]",
    description: "ARTIST:CURIO\nSONG:KIMI NI FURERU DAKE DE",
    expected: { track: "KIMI NI FURERU DAKE DE", artist: "CURIO" }
  },
  {
    name: "Gundam 08th title artist track",
    title: "Gundam 08th MS Team: YONEKURA CHIHIRO 米倉千尋- 嵐の中で輝いて Arashi no Naka de Kagayaite (Lyrics Kan/Rom/Eng)",
    description: "",
    expected: { track: "嵐の中で輝いて Arashi no Naka de Kagayaite", artist: "YONEKURA CHIHIRO 米倉千尋" }
  }
];

const playlistSmokeCases = [
  ['MASHLE: MAGIC AND MUSCLES Season 2 - Opening FULL "Bling-Bang-Bang-Born" by Creepy Nuts (Lyrics)', ''],
  ['Chainsaw Man - Opening FULL \'\'KICK BACK" by Kenshi Yonezu (Lyrics)', ''],
  ['Jujutsu Kaisen \'Shibuya Incident Arc\' - Opening FULL "SPECIALZ" by King Gnu (Lyrics)', ''],
  ['Jujutsu Kaisen Season 2 - Opening FULL "Ao No Sumika" by Tatsuya Kitani (Lyrics)', ''],
  ['Dandadan - Opening FULL "Otonoke" by Creepy Nuts (Lyrics)', ''],
  ['YOASOBI - Idol「アイドル」Lyrics Video [Kan/Rom/Eng] Oshi no Ko (推しの子) OP', 'Artist: YOASOBI\nTitle: アイドル'],
  ['[HD] Hana ni Natte Lyrics 花になって Be a Flower - Apothecary Diaries 薬屋のひとりごと OP | 緑黄色社会', 'Anime : The Apothecary Diaries 薬屋のひとりごと\nSong : Hana ni Natte 花になって / Be a Flower'],
  ['Tokyo Revengers Opening (Full) -Cry Baby- Lyrics', 'Anime : Tokyo Revengers\nSong : Cry Baby by Official HIGE DANdism'],
  ['OneRepublic - Nobody (from Kaiju No. 8) [Official Lyric Video]', ''],
  ['Aimer 「残響散歌」 (Zankyou Sanka) Kimetsu no Yaiba: Yuukaku-hen Opening Lyrics [Kan_Rom_Eng]', ''],
  ['Kimetsu no Yaiba Season 3 - Opening FULL "Kizuna no Kiseki" by MAN WITH A MISSION x milet (Lyrics)', ''],
  ['The Elusive Samurai - Opening FULL "Plan A" by DISH// (Lyrics)', ''],
  ['The Elusive Samurai - Ending FULL "KAMAKURA STYLE" by BotchiBoromaru (Lyrics)', ''],
  ["JoJo's Bizarre Adventure Opening 8 - Fighting Gold Lyrics", ''],
  ['THEME SONG MILKY☆SUBWAY THE GALACTIC LIMITED EXPRESS [LYRICS:ROM/IND/ENG]', '銀河系まで飛んで行け！/ Ginga-kei made Tonde Ike!'],
  ['Gundam Wing Opening 1 JUST COMMUNICATION + LYRICS', ''],
  ['The Winner (Gundam 0083: Stardust Memory Opening 1st Lyrics + Terjemahan)', ''],
  ['Men of Destiny (Gundam 0083: Stardust Memory Opening 2nd Lyrics + Terjemahan)', ''],
  ["L'Arc~en~Ciel - Driver's High (Romaji/English)", ''],
  ['Porno Graffitti - Hitori no Yoru (Great Teacher Onizuka Opening 2) (Lirik Terjemahan Indonesia)', ''],
  ['ポルノグラフィティ - サボテン | Porno Graffitti - Saboten (sub español + romaji)', ''],
  ["THE DAY - Porno Graffiti 『The Hero Academia』OP S1", ''],
  ['Melissa - Full Metal Alchemist (Opening) [Lyrics and sub-english]', 'Title: Melissa'],
  ["L'Arc~en~Ciel - Fourth Avenue Café (Romaji/English)", ''],
  ["[AMV] DNA2 - L'Arc~en~Ciel - Blurry Eyes (lyrics)", ''],
  ["L'Arc en Ciel - Niji - Live show English translation", ''],
  ['Gundam Wing OP2: TWO-MIX トゥーミックス - RHYTHM EMOTION Lyrics (Color Coded Lyrics Kan/Rom/Eng)', ''],
  ['Flying In The Sky de Yoshifumi Ushima - G Gundam - Opening 1 - Sub Español + Karaoke [AMV]', ''],
  ['[Vietsub + Lyrics] Trust You Forever | Yoshifumi Ushima | Mobile Fighter G Gundam Opening 2', 'Singer: Yoshifumi Ushima'],
  ['Trust You Forever de Yoshifumi Ushima - Sub español - G Gundam - Opening 2 Full + Karaoke [AMV]', 'Trust You Forever de Hitofumi Ushima'],
  ['Clamp in Wonderland  - Music Video + Lyrics', ''],
  ['SOBAKASU Lyrics by Judy and Mary - Samurai X (Opening Song)', ''],
  ['Samurai X-1/2 (With Lyrics).mp4', ''],
  ['Curio - Kimi Ni Fureru Dake De (Rorouni Kenshin 3rd Opening) [Romaji]', 'ARTIST:CURIO\nSONG:KIMI NI FURERU DAKE DE'],
  ['1/3 No Junjo Na Kanjo Ost Rurouni Kenshin Engsub Indosub', ''],
  ['T.M. Revolution / Heart of Sword ～夜明け前～ [JP/ENG/ROM LYRICS]', 'Heart of Sword by T.M. Revolution'],
  ["BONNIE PINK - It's Gonna Rain (Romaji/English)", ''],
  ['Gundam 08th MS Team: YONEKURA CHIHIRO 米倉千尋- 嵐の中で輝いて Arashi no Naka de Kagayaite (Lyrics Kan/Rom/Eng)', ''],
  ['Mobile Suit Gundam The 08th MS Team outro (10 years after) with subtitles', ''],
  ['Maaya Sakamoto / Kiseki No Umi English Translation', ''],
  ['Magic Knight Rayearth - Full Opening Song Lyrics "Yuzurenai Negai" by Naomi Tamura', '']
];

for (const testCase of cases) {
  const actual = metadata.parseVideoMetadata(testCase.title, testCase.description);
  assert.equal(actual.track, testCase.expected.track, `${testCase.name}: track`);
  assert.equal(actual.artist, testCase.expected.artist, `${testCase.name}: artist`);
}

for (const [title, description] of playlistSmokeCases) {
  const actual = metadata.parseVideoMetadata(title, description);
  assert.ok(actual.track, `playlist smoke: parsed track for ${title}`);
  assert.ok(!/^(lyrics?|lyric video|official)$/i.test(actual.track), `playlist smoke: non-noise track for ${title}`);
}

console.log(`parser.test.js: ${cases.length} exact cases and ${playlistSmokeCases.length} playlist smoke cases passed`);
