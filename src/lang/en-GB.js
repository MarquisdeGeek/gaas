//
// English (GB/UK)
//
const pluralize = require('pluralize');
const nr = require("nummern");
const converter = require('number-to-words');

const silentH = [
	'hour', 'honest', 'honor', 'honour', 'heir', 'heirloom'
];

const nonsilent = [
	'euro', 'one',
];

const initialisms = [
	"AC", "AD", "AKA", "AM", "ATM", "BC", "BCE", "CIA", "CO", "CST", "DOA", "DOT",
	"DST", "EST", "ET", "FAQ", "FBI", "FM", "FYI", "GI", "GMO", "IM", "IMO", "IMHO", "HMO",
	"ID", "IQ", "ISBN", "JFK", "JV", "KO", "LCD", "LED", "LOL", "MC", "MLK", "MO", "MRE",
	"MS", "MST", "MTG", "NIB", "NBA", "OJ", "PBJ", "PC", "PI", "PM", "POW", "PS", "PR",
	"PSI", "PST", "RGB", "RIP", "ROTC", "RPG", "RSVP", "RV", "SOP", "SOS", "SPF", "TBA",
	"TGIF", "TLC", "TV", "UFO", "UN", "UPC", "VIP", "VP", "YTD", 
	//
	"USA", "UK", "GB"
];

// From https://en.wikipedia.org/wiki/Capitonym#List_of_capitonyms_in_English
const capitonyms = {
	'ares': {u:"/ˈɛəriːz/", l:""} ,
	'august': {u:"/ˈɔː.ɡəst/", l:"/ɔːˈɡʌst/"},
	'polish': {u:"/ˈpoʊlɪʃ/", l:"/ˈpɒlɪʃ/"},
	'job': {u:"/dʒoʊb/", l:"/d͡ʒɒb/"},
	// NOTE: Alexa does this automagically
	//'reading': {u:"/ˈrɛdɪŋ/", l:"/ˈɹiːdɪŋ/"}
	
};

// Global initialisation
// TODO
// 1. Add new inflections
// 2. ???
(function() {
// https://github.com/rails/rails/blob/92f567ab30f240a1de152061a6eee76ca6c4da86/activesupport/lib/active_support/inflections.rb
//console.log("JKDJSFLKS");
})();

const self = module.exports = {


	// is this >-1 or != -1
	isSilentH: function(word) {
		return silentH.indexOf(word.toLowerCase()) > -1;
	},

	isVowel: function(letter) {
		letter = letter.toLowerCase();
		return letter == 'a' || letter == 'e' || letter == 'i' || letter == 'o' || letter == 'u' ? true : false;
	},

	isVowelSound: function(letter) {
		letter = letter.toLowerCase();
		return letter == 'a' || letter == 'e' || 
		letter == 'f' || letter == 'h' || 
		letter == 'i' ||
		letter == 'l' || letter == 'm' || letter == 'n' || 
		letter == 'o' || 
		letter == 'r' || letter == 's' 
			? true : false;
	},

	isIndefiniteArticle: function(word) {
		word = word.toLowerCase();
		return (word === 'a' || word === 'an') ? true : false;
	},

	isDefiniteArticle: function(word) {
		word = word.toLowerCase();
		return word === "the";
	},

	// different in other languages
	getDefiniteArticleFor: function(word, initials) {
		return "the";
	},

	getIndefiniteArticleFor: function(word, initials) {
		const first = word.substr(0, 1);
		word = word.toLowerCase();

		// Vowel sounds, but not necessarily vowels
		if (initials && self.isVowelSound(first)) {
			return "an";
		}

		// Exceptions to the vowel rule
		if (word.match(/^eu/) || word.match(/^uni/) || word.match(/^ub/) || word.match(/^ur/) || word.match(/^us/) || word.match(/^ute/)) {
			return "a";
		}
		if (self.isVowel(first) && nonsilent.indexOf(word) > -1) {
			return "a";
		}

		// The general rule
		if (self.isVowel(first) || self.isSilentH(word)) {
			return "an";
		}
		return "a";
	},

	getNumberAsWord: function(value) {
		const rt = nr(value, "english");
		if (rt === false) {
			return value;
		}
		return rt;
	},

	getNumberAsOrdinal: function(value) {
		const rt = converter.toOrdinal(value);
		if (rt === false) {
			return value;
		}
		return rt;
	},
	
	getNumberAsOrdinalWord: function(value) {
		const rt = converter.toWordsOrdinal(value);
		if (rt === false) {
			return value;
		}
		return rt;
	},

	getWordAsNumber: function(word) {
		// TODO
		//  https://www.npmjs.com/package/words-to-numbers
		return 0;
	},
	
	getNumberWithCommas: function(word) {
		return word.toLocaleString('en');
	},

	ucFirst: function(text) {
    	return text.charAt(0).toUpperCase() + text.slice(1);
	},

	// todo: is this language or localisation??
	isSingular: function(count) {
		return count == 1 ? true : false;
	},

	isInitialism: function(text) {
		return initialisms.indexOf(text) > -1 ? true : false;
	},

	getCapitonymData: function(text) {
		const lowercaseText = text.toLowerCase();
		if (capitonyms.hasOwnProperty(lowercaseText)) {
			if (lowercaseText.substr(0,1) === text.substr(0,1)) {
				return { ssml: capitonyms[lowercaseText].l };
			}
			return { ssml: capitonyms[lowercaseText].u };
		}
		return undefined;
	},

	getSingularOf: function(text) {
		return pluralize.singular(text);
	},
	getPluralOf: function(text) {
		return pluralize.plural(text);
	},


	defaultDictionary: function() {
		
	},

	// This overrides defaults. allows multiple dictionaries. e.g. technical/medical, etc
	loadDictionary: function(url) {
		
	}

};
