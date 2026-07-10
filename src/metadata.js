(function (root) {
  "use strict";

  const ARTIST_ALIASES = {
    "緑黄色社会": "Ryokuoushoku Shakai"
  };

  function cleanTitlePart(value) {
    return String(value || "")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/【[^】]*】/g, " ")
      .replace(/\([^)]*(?:lyrics?|official|mv|music video|hd|full|op|opening|from)[^)]*\)/gi, " ")
      .replace(/\b(?:lyrics?|lyric video|music video|mv|hd|full|opening|ending|theme|song|op|ed|english translation)\b/gi, " ")
      .replace(/[「」『』]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function applyArtistAlias(artist) {
    return ARTIST_ALIASES[artist] || artist;
  }

  function isNoiseTitleTag(value) {
    return /^(?:hd|4k|mv|pv|official|lyrics?|lyric video|full|audio|music video|op|ed|opening|ending)$/i
      .test(cleanTitlePart(value));
  }

  function parseSongValue(value) {
    let cleaned = cleanTitlePart(String(value || "").replace(/https?:\/\/\S+/g, " "));
    if (cleaned.includes("/")) {
      cleaned = cleanTitlePart(cleaned.split("/")[0]);
    }
    cleaned = cleaned.replace(/\s+[\u3040-\u30ff\u3400-\u9fff].*$/u, "").trim() || cleaned;
    const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
    if (!byMatch) return { track: cleaned, artist: "" };
    return {
      track: cleanTitlePart(byMatch[1]),
      artist: cleanTitlePart(byMatch[2].split(/\s+-\s+/)[0])
    };
  }

  function parseArtistTrackSide(value) {
    const parts = String(value || "").split(/\s+-\s+/).map((part) => cleanTitlePart(part)).filter(Boolean);
    if (parts.length < 2) return null;
    return { artist: parts[0], track: parts.slice(1).join(" - ") };
  }

  function looksLikeAnimeContext(value) {
    return /\b(?:anime|opening|ending|op|ed|season|theme|ost|gundam|jojo|revengers|samurai|kimetsu|jujutsu|chainsaw|mashle|dandadan|kenshin|academia|apothecary|diaries|kaiju|rayearth)\b/i
      .test(String(value || ""));
  }

  function parseDescriptionMetadata(rawDescription) {
    const description = String(rawDescription || "");
    const metadata = { track: "", artist: "" };

    const songMatch = description.match(/(?:^|\n)\s*(?:song|music|title|track)\s*[:：]\s*([^\n]+)/i);
    if (songMatch) {
      const parsedSong = parseSongValue(songMatch[1]);
      metadata.track = parsedSong.track;
      metadata.artist = parsedSong.artist;
    }

    const artistMatch = description.match(/(?:^|\n)\s*(?:artist|singer|performed\s+by|music\s+by)\s*[:：]\s*([^\n]+)/i);
    if (artistMatch) {
      metadata.artist = cleanTitlePart(artistMatch[1]);
    }

    return {
      track: metadata.track,
      artist: applyArtistAlias(metadata.artist),
      originalArtist: metadata.artist
    };
  }

  function parseYouTubeTitle(rawTitle) {
    let title = String(rawTitle || "")
      .replace(/\s+-\s+YouTube$/i, "")
      .replace(/\s*｜\s*/g, " | ")
      .trim();

    const bracketArtistMatch = title.match(/^[【\[]([^】\]]+)[】\]]\s*(.+)$/u);
    if (bracketArtistMatch && !isNoiseTitleTag(bracketArtistMatch[1])) {
      const artist = cleanTitlePart(bracketArtistMatch[1]);
      const track = cleanTitlePart(bracketArtistMatch[2]);
      if (track && artist) return { track, artist: applyArtistAlias(artist), originalArtist: artist };
    }

    const artistQuotedTrackMatch = title.match(/^(.+?)\s*["“”「『]([^"“”」』]+)["“”」』]/u);
    if (artistQuotedTrackMatch && !looksLikeAnimeContext(artistQuotedTrackMatch[1])) {
      const artist = cleanTitlePart(artistQuotedTrackMatch[1]);
      const track = cleanTitlePart(artistQuotedTrackMatch[2]);
      if (track && artist) return { track, artist: applyArtistAlias(artist), originalArtist: artist };
    }

    const slashMatch = title.match(/^(.+?)\s+\/\s+(.+?)(?:\s+\[|$)/);
    if (slashMatch) {
      const artist = cleanTitlePart(slashMatch[1]);
      const track = cleanTitlePart(slashMatch[2]);
      if (track && artist) return { track, artist: applyArtistAlias(artist), originalArtist: artist };
    }

    const pipeArtistTrack = title.match(/\|\s*([^|]+?)\s+-\s*([^|]+?)(?:\s*\||$)/);
    if (pipeArtistTrack) {
      const artist = cleanTitlePart(pipeArtistTrack[1]);
      const track = cleanTitlePart(pipeArtistTrack[2]);
      if (track && artist && !looksLikeAnimeContext(artist)) return { track, artist: applyArtistAlias(artist), originalArtist: artist };
    }

    const deMatch = title.match(/^(.+?)\s+de\s+(.+?)(?:\s+-|$)/i);
    if (deMatch) {
      const track = cleanTitlePart(deMatch[1]);
      const artist = cleanTitlePart(deMatch[2]);
      if (track && artist) return { track, artist: applyArtistAlias(artist), originalArtist: artist };
    }

    const colonArtistTrackMatch = title.match(/:\s*([^:-]+?)\s*-\s*([^-[\]()]+?)(?:\s+lyrics?|\s+\(|\s+\[|$)/i);
    if (colonArtistTrackMatch) {
      const artist = cleanTitlePart(colonArtistTrackMatch[1]);
      const track = cleanTitlePart(colonArtistTrackMatch[2]);
      if (track && artist) return { track, artist: applyArtistAlias(artist), originalArtist: artist };
    }

    const dashWrappedTrackMatch = title.match(/-\s*([^-()]+?)\s*-\s*(?:lyrics?)?$/i);
    if (dashWrappedTrackMatch) return { track: cleanTitlePart(dashWrappedTrackMatch[1]), artist: "", originalArtist: "" };

    const byQuotedMatch = title.match(/["'“”「『]+([^"'“”」』]+)["'“”」』]+\s+by\s+([^()|]+)/i);
    if (byQuotedMatch) {
      const artist = cleanTitlePart(byQuotedMatch[2]);
      return { track: cleanTitlePart(byQuotedMatch[1]), artist: applyArtistAlias(artist), originalArtist: artist };
    }

    const byPlainMatch = title.match(/\bby\s+([^()|]+)/i);
    if (byPlainMatch) {
      const beforeBy = title.slice(0, byPlainMatch.index).split(/\s+-\s+/).pop();
      const artist = cleanTitlePart(byPlainMatch[1].split(/\s+-\s+/)[0]);
      const track = cleanTitlePart(beforeBy);
      if (track && artist) return { track, artist: applyArtistAlias(artist), originalArtist: artist };
    }

    let artist = "";
    if (title.includes("|")) {
      const parts = title.split("|").map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 3 && !looksLikeAnimeContext(parts[1])) {
        const track = cleanTitlePart(parts[0]);
        artist = cleanTitlePart(parts[1]);
        if (track && artist) return { track, artist: applyArtistAlias(artist), originalArtist: artist };
      }
      const rightSide = parseArtistTrackSide(parts[parts.length - 1]);
      if (rightSide) return { track: rightSide.track, artist: applyArtistAlias(rightSide.artist), originalArtist: rightSide.artist };
      title = parts[0] || title;
      artist = parts[parts.length - 1] || "";
    }

    let track = title;
    const normalizedTitle = title.replace(/^\[[^\]]+\]\s*/, "");
    const dashParts = normalizedTitle.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
    if (dashParts.length >= 3 && looksLikeAnimeContext(dashParts[0])) {
      const maybeArtist = cleanTitlePart(dashParts[dashParts.length - 2]);
      const maybeTrack = cleanTitlePart(dashParts[dashParts.length - 1]);
      if (maybeTrack && maybeArtist) return { track: maybeTrack, artist: applyArtistAlias(maybeArtist), originalArtist: maybeArtist };
    }

    const dashSuffixMatch = title.match(/^(.+?)\s+-\s*([^-[\]()]+?)\s*(?:lyrics?|lirik|sub|romaji|english)?$/i);
    if (dashSuffixMatch && looksLikeAnimeContext(dashSuffixMatch[1])) {
      track = cleanTitlePart(dashSuffixMatch[2]);
      artist = "";
    } else if (!artist && /\s+-\s+/.test(title)) {
      const parts = title.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const rightSide = parts.slice(1).join(" - ");
        const rightArtistMatch = rightSide.match(/^([^「『]+?)\s*[「『]/u);
        if (rightArtistMatch && !looksLikeAnimeContext(parts[0])) {
          track = parts[0];
          artist = rightArtistMatch[1];
        } else if (/^[A-Z0-9'’\s]+$/.test(parts[0]) && /lyrics?|\(|\[/.test(rightSide)) {
          track = parts[0];
          artist = rightSide;
        } else {
          artist = parts[0];
          track = rightSide;
        }
      }
    } else if (/\s+-\s+/.test(title)) {
      track = title.split(/\s+-\s+/)[0];
    }

    track = cleanTitlePart(track)
      .replace(/\s+[\u3040-\u30ff\u3400-\u9fff].*$/u, "")
      .trim();
    artist = cleanTitlePart(artist);

    return { track, artist: applyArtistAlias(artist), originalArtist: artist };
  }

  function parseVideoMetadata(title, description) {
    const parsedTitle = parseYouTubeTitle(title);
    const parsedDescription = parseDescriptionMetadata(description);
    return {
      track: parsedDescription.track || parsedTitle.track,
      artist: parsedDescription.artist || parsedTitle.artist,
      originalArtist: parsedDescription.originalArtist || parsedTitle.originalArtist
    };
  }

  const api = {
    cleanTitlePart,
    isNoiseTitleTag,
    parseSongValue,
    parseDescriptionMetadata,
    parseYouTubeTitle,
    parseVideoMetadata
  };

  root.FrankLyricsMetadata = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
