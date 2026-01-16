// languages/ptbr.js

// Traduções dos Arcanos Maiores
const MAJOR_ARCANA_PT = {
  'The Fool': 'O Louco',
  'The Magician': 'O Mago',
  'The High Priestess': 'A Sacerdotisa',
  'The Empress': 'A Imperatriz',
  'The Emperor': 'O Imperador',
  'The Hierophant': 'O Hierofante',
  'The Lovers': 'Os Enamorados',
  'The Chariot': 'O Carro',
  Strength: 'A Força',
  'The Hermit': 'O Eremita',
  'Wheel of Fortune': 'A Roda da Fortuna',
  Justice: 'A Justiça',
  'The Hanged Man': 'O Enforcado',
  Death: 'A Morte',
  Temperance: 'A Temperança',
  'The Devil': 'O Diabo',
  'The Tower': 'A Torre',
  'The Star': 'A Estrela',
  'The Moon': 'A Lua',
  'The Sun': 'O Sol',
  Judgement: 'O Julgamento',
  'The World': 'O Mundo',
};

// Traduções de ranks dos Arcanos Menores
const RANKS_PT = {
  Ace: 'Ás',
  Two: 'Dois',
  Three: 'Três',
  Four: 'Quatro',
  Five: 'Cinco',
  Six: 'Seis',
  Seven: 'Sete',
  Eight: 'Oito',
  Nine: 'Nove',
  Ten: 'Dez',
  Page: 'Valete',
  Knight: 'Cavaleiro',
  Queen: 'Rainha',
  King: 'Rei',
};

// Traduções de naipes dos Arcanos Menores
const SUITS_PT = {
  Wands: 'Paus',
  Cups: 'Copas',
  Swords: 'Espadas',
  Pentacles: 'Ouros',
};

/**
 * Traduz o nome da carta para pt-BR.
 * Espera o objeto no formato da tarotapi.dev:
 * {
 *   name: 'The Fool' | 'Ace of Wands' | ...
 *   type: 'major' | 'minor'
 * }
 */
function translateCardName(card) {
  // Arcanos maiores
  if (card.type === 'major') {
    return MAJOR_ARCANA_PT[card.name] || card.name;
  }

  // Arcanos menores – padrão "Rank of Suit"
  const match = card.name.match(
    /^(Ace|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Page|Knight|Queen|King) of (Wands|Cups|Swords|Pentacles)$/
  );

  if (match) {
    const rankEn = match[1];
    const suitEn = match[2];

    const rankPt = RANKS_PT[rankEn] || rankEn;
    const suitPt = SUITS_PT[suitEn] || suitEn;

    return `${rankPt} de ${suitPt}`;
  }

  // fallback
  return card.name;
}

module.exports = {
  translateCardName,
};
