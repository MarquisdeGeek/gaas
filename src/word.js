const defn = require('./definitions').module;
const utils = require('./utils');


function Word(text, type) {
    this.teachme = [];
    this.isFixed = false;
    this.format = false;

    this.update(text, type);
}

Word.prototype.fix = function() {
    this.isFixed = true;
}

Word.prototype.update = function(text, type) {
    text = ""+text; // ensure it's a string (since arglist's might not be)
    this.text = text;
    if (type === undefined) {
        type = defn.getSymbolType(text);
    }

    this.isText = type===defn.WordType.TEXT;
    this.isWhitespace = type===defn.WordType.WHITESPACE;
    this.isPunctuation = type===defn.WordType.PUNCTUATION;
    this.isSpecifier = type===defn.WordType.SPECIFIER;
    // Add some specificifity to the field(s)
    this.isNumber = this.isText && text !== '' && (utils.isNumber(text) || utils.isFraction(text));
    this.isWord = type===defn.WordType.TEXT && (!isNaN(this.isNumber));// TODO: This is wrong

    // TODO: If word representing a number
    // https://www.npmjs.com/package/words-to-numbers
    this.numberValue = +text;
}


module.exports = Word;
