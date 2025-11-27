const encode = require('html-entities').encode;
const commaNumber = require('comma-number');

const utils = require('./utils');
const Word = require('./word');
const defn = require('./definitions').module;
/*
Results:

text : A basic fixed version of the input
plain : Plain test to match the written word
ssml : Mark-up 

https://developer.amazon.com/docs/custom-skills/speech-synthesis-markup-language-ssml-reference.html
*/


class GrammarService {

    #vui = {};
    #processorSets = {
        'standard': 'fpwsiacg',
        'standard_prose': 'fpwsiacg',
        'standard_line': 'fpwsiac'
    };

    #processors = {
        // Word-oriented

        // sentence-oriented
        'f': this.doStyleFormatting,
        'p': this.doPlurals,
        'w': this.doWordOrientedNumbers,
        'a': this.doArticles,
        'i': this.doInitialisms,
        's': this.doWhitespace,
        'g': this.doGrammarBasics

    };

    // TODO: replace denom with quarters in all ==4 cases
    #commonFractions = {
        "1/2": "one half",
        "1/4": "one quarter",
        "2/4": "two quarters",
        "3/4": "three quarters",
    };



    constructor(cfg) {
        const lang = (cfg && cfg.lang) ? cfg.lang : 'en-GB';
        this.#vui.lang = require('./lang/' + lang);
        this.#vui.processor = (cfg && cfg.processor) ? cfg.processor : 'standard';

        if (this.#processorSets[this.#vui.processor]) {
            this.#vui.processor = this.#processorSets[this.#vui.processor];
        }

        this.#vui.lang.defaultDictionary();
        this.#vui.lang.loadDictionary('');
    }

    fix(text, arglist) {
        return new Promise((resolve, reject) => {
            const result = {};


            // Split
            const sentence = {};
            sentence.teachme = [];
            sentence.word_list = this.splitsentence(text, arglist);
            sentence.word_list = this.parseFormatSpecifier(sentence.word_list, arglist);

            for (let i = 0; i < this.#vui.processor.length; ++i) {
                if (this.#processors[this.#vui.processor[i]]) {
                    const fn = this.#processors[this.#vui.processor[i]].bind(this);
                    fn(sentence);
                }
            }


            const rejoined = this.joinWordList(sentence.word_list);

            result.original = text;
            result.text = rejoined.text;
            result.plain = rejoined.plain;
            result.ssml = rejoined.ssml;

            result.teachme = sentence.teachme;

            result.html = encode(result.plain);

            resolve(result);
        });
    }



    splitsentence(text, argList) {
        const STATE_UNKNOWN = 0;

        let state = STATE_UNKNOWN;
        let curr = '';
        let word_list = [];
        let braceCount;

        for (let i = 0; i <= text.length; ++i) {
            // TODO: NUL can be improved, surely
            let type = i == text.length ? defn.WordType.END_OF_TEXT : defn.getSymbolType(text[i]);
            let addWord = false;
            // TODO: Consider decimal.numbers.here
            // TODO: Consider fractional/numbers.here
            // TODO: Type commands. e.g. ${as:bold}Gordons alive${as:}

            // TODO: END_OF_TEXT : last character are " a"
            switch (state) {
                case STATE_UNKNOWN:
                    state = type;
                    curr = text[i];
                    break;

                case defn.WordType.WHITESPACE:
                    if (type != defn.WordType.WHITESPACE) {
                        addWord = true;
                    } else {
                        curr += text[i];
                    }
                    break;

                case defn.WordType.TEXT:
                    if ((text[i] === '.' || text[i] === '/') && utils.isNumber(curr)) {
                        curr += text[i];
                    } else if (type === defn.WordType.PUNCTUATION) {
                        addWord = true;
                    } else if (type === defn.WordType.WHITESPACE || type === defn.WordType.END_OF_TEXT) {
                        addWord = true;
                    } else {
                        curr += text[i];
                    }
                    break;

                case defn.WordType.PUNCTUATION:
                    if ((curr === '%' || curr === '$') && text[i] == '{') {
                        state = defn.WordType.SPECIFIER;
                        braceCount = 1;
                        curr += text[i];
                    } else if (type === defn.WordType.PUNCTUATION) {
                        curr += text[i];
                    } else {
                        addWord = true;
                    }
                    break;

                case defn.WordType.SPECIFIER:
                    curr += text[i];
                    if (text[i] === '{') {
                        ++braceCount;
                    } else if (text[i] === '}') {
                        if (--braceCount == 0) {
                            word_list.push(new Word(curr, state));
                            state = STATE_UNKNOWN;
                            continue;
                        }
                    }
                    break;
            }
            //
            if (addWord) {
                // End old word
                word_list.push(new Word(curr, state));
                // Begin new old
                state = type;
                curr = text[i];
            }
        }

        return word_list;
    }


    // Processing the elements
    doStyleFormatting(sentence) {
        sentence.word_list.forEach((word) => {
            if (word.format_command) {
                let html_tag = '';
                let ssml_tag = '';
                let ssml_attr = '';

                switch (word.format_style) {
                    case 'bold':
                        html_tag = 'b';
                        ssml_tag = 'emphasis';
                        ssml_attr = 'level="strong"';
                        break;

                    case 'italic':
                        html_tag = 'i';
                        ssml_tag = 'emphasis';
                        ssml_attr = 'level="moderate"';
                        break;

                    case 'whisper':
                        ssml_tag = 'amazon:effect';
                        ssml_attr = 'name="whispered"';
                        break;
                }

                if (html_tag === '') {
                    sentence.teachme.push(`I could not apply the HTML format style: ${word.format_style}`);
                } else {
                    word.html = (word.format_command === '+' ? '<' : '</') + html_tag + '>';
                }

                if (ssml_tag === '') {
                    sentence.teachme.push(`I could not apply the SSML format style: ${word.format_style}`);
                } else {
                    if (word.format_command === '+') {
                        word.ssml = '<' + ssml_tag + ' ' + ssml_attr + '>';
                    } else {
                        word.ssml = '</' + ssml_tag + '>';
                    }
                }

                word.format = false;
                word.format_command = false;
                word.update('');
                word.fix();
            }
        });
    }

    doArticles(sentence) {
        let wasDefinite = false;
        let wasIndefinite = false;

        sentence.word_list.forEach((word, i) => {
            let original_indefinite = word.text;
            let wasDefinite = this.#vui.lang.isDefiniteArticle(original_indefinite);
            let wasIndefinite = this.#vui.lang.isIndefiniteArticle(original_indefinite);

            // Scan ahead for the next word
            if (wasIndefinite || wasDefinite) {
                for (let j = i + 1; j < sentence.word_list.length; ++j) {
                    let next_word = sentence.word_list[j];

                    if (next_word.isWhitespace) {
                        // NOP: Continue as normal
                    } else if (next_word.isWord) {

                        if (wasDefinite) {
                            word.text = this.#vui.lang.getDefiniteArticleFor(next_word.text, next_word.isInitialism);
                        } else if (wasIndefinite) {
                            word.text = this.#vui.lang.getIndefiniteArticleFor(next_word.text, next_word.isInitialism);
                        }

                        if (word.text != original_indefinite) {
                            sentence.teachme.push(`Words like '${next_word.text}' use '${word.text}' as the article.`);
                        }
                        break;
                    } else { //punctuation
                        break;
                    }
                }
            }
        });
    }

    doPlurals(sentence) {
        sentence.word_list.forEach((word, i) => {
            if (word.isNumber) {

                // Get the next word (i.e. not whitespace, and not split by punctuation)
                for (let j = i + 1; j < sentence.word_list.length; ++j) {
                    if (sentence.word_list[j].isWhitespace) {
                        // NOP: Continue as normal
                    } else if (sentence.word_list[j].isWord) {
                        let next_word = sentence.word_list[j].text;
                        if (this.#vui.lang.isSingular(word.numberValue)) {
                            sentence.word_list[j].text = this.#vui.lang.getSingularOf(next_word);
                        } else {
                            sentence.word_list[j].text = this.#vui.lang.getPluralOf(next_word);
                        }
                        sentence.teachme.push(`Fixed the plural of ${next_word}`);
                        break;
                    } else { //punctuation
                        break;
                    }
                }
            }
        });
    }

    doInitialisms(sentence) {
        sentence.word_list.forEach((word, i) => {
            if (this.#vui.lang.isInitialism(word.text)) {
                let t = word.text.split('').join('.');

                word.text = t;
                if (i + 1 < sentence.word_list.length && !sentence.word_list[i + 1].isPunctuation) {
                    word.text += '.';
                }
                word.isInitialism = true;

                word.ssml = '<say-as interpret-as="spell-out">' + word.text + '</say-as>';

                sentence.teachme.push(`'${word.text}' is an initialism, so should be written with dots like '${t}'`);
            }
        });
    }



    //TODO
    // 1. Squash to one space after all punctuation
    // 2. Add one space, if missing
    doWhitespace(sentence) {
    }


    doNumberAsWords(sentence) {
        sentence.word_list.forEach((word) => {
            if (word.isFixed) {
                // NOP
            } else if (word.isNumber) {
                const value = word.numberValue;
                if (value < 10 && value == Math.floor(value)) {
                    word.update(this.#vui.lang.getNumberAsWord(value));
                    sentence.teachme.push(`Write out numbers smaller than 10, like ${value} in full.`);
                }
            }
        });
    }


    doNumberFormatting(sentence) {
        sentence.word_list.forEach((word) => {
            if (word.isFixed) {
                // NOP
            } else if (word.format) {
                let value = word.numberValue;
                value = "" + value;
                //format
                let padto = parseInt(word.format_pre, 10);
                let decimals = parseInt(word.format_post, 10);

                let dec = Math.floor(value);
                let frac = value - dec;

                if (!isNaN(padto)) {
                    value = Array(padto).join('0') + dec;
                    value = value.substr(value.length - padto);
                    if (word.use_comma) {
                        value = commaNumber(+value);
                    }
                    word.fix();
                }

                if (!isNaN(decimals)) {
                    // The fraction string begins "0.****"
                    frac = ("" + frac).substr(2, decimals);
                    value += '.' + frac;
                } else { // if no fixed number of decimals is specified, we use them all
                    value += ("" + frac).substr(1);
                }

                word.update(value);
            }
            //
            let textual = word.text;
            let match;
            if (match = /^(\d+)\/(\d+)$/.exec(textual)) {
                let numerator = parseInt(match[1], 10);
                let denominator = parseInt(match[2], 10);
                if (this.#commonFractions[textual]) {
                    word.ssml = this.#commonFractions[textual];
                } else if (numerator < 10 || denominator < 101) {
                    word.ssml = this.#vui.lang.getNumberAsWord(numerator) + " " + this.#vui.lang.getNumberAsOrdinalWord(denominator);
                    if (!this.#vui.lang.isSingular(numerator)) {
                        word.ssml += "s";
                    }
                } else {
                    word.ssml = '<say-as interpret-as="spell-out">' + numerator + "/" + denominator + '</say-as>';
                }
                word.fix();
            }
        });
    }

    doWordOrientedNumbers(sentence) {
        this.doNumberFormatting(sentence);
        this.doNumberAsWords(sentence);
    }

    // TODO Use .map or similar to eliminate common stuff, like iteration and .isFixed
    // TODO: Have enumWords (only) enumWhitespace?!?!
    doGrammarBasics(sentence) {
        let wasLastPeriod = true;
        sentence.word_list.forEach((word) => {

            if (wasLastPeriod) {
                if (word.isFixed) {
                    // NOP
                } else if (word.isNumber) {
                    word.text = this.#vui.lang.getNumberAsWord(word.numberValue);
                }

                let ucf = this.#vui.lang.ucFirst(word.text);
                if (word.text != ucf) {
                    word.text = ucf;
                    sentence.teachme.push(`Start the sentence with a capital letter.`);
                }
            }
            // TODO: also caps on "..." or ":"?
            if (word.isWhitespace) {
                // NOP - maintain the previous 'last period' status/state
            } else {
                wasLastPeriod = word.isPunctuation && word.text === '.';
            }

        });

        // Does it end with a period?
        if (sentence.word_list[sentence.word_list.length - 1].isPunctuation) {
            // NOP
        } else if (defn.getSymbolType(sentence.word_list[sentence.word_list.length - 1].text.slice(-1)) !== defn.WordType.PUNCTUATION) {
            sentence.word_list.push(new Word('.'));
            sentence.teachme.push(`End the sentence with a full stop.`);
        }
    }

    parseFormatSpecifier(wordList, argList) {
        let fetchIndex = 0;
        let match;

        for (let i = 0; i < wordList.length; ++i) {
            if (wordList[i].isSpecifier) {
                let text = wordList[i].text;

                // fmt: %{s1} : the nth item
                match = /%{(,?)([dsi])(\d+)}/.exec(text);
                if (match) {
                    wordList[i].update(argList[parseInt(match[3], 10)]);
                    wordList[i].format = true;
                }

                // TODO: Squash this and the next one down. (And probably the previous one, also)
                // fmt: %{s} : the next item
                match = /%{(,?)([dsi])}/.exec(text);
                if (match) {
                    wordList[i].update(argList[fetchIndex]);
                    wordList[i].use_comma = match[1];
                    wordList[i].format = true;
                    ++fetchIndex;
                }

                // fmt: %{2.3d} : the next item, with format
                match = /%{(,)?(\d+)\.?(\d*)([dsi])}/.exec(text);
                if (match) {
                    wordList[i].update(argList[fetchIndex]);
                    wordList[i].use_comma = match[1];
                    wordList[i].format_pre = match[2];
                    wordList[i].format_post = match[3];
                    wordList[i].format = true;
                    ++fetchIndex;
                }

                // Command strings. e.g. +bold
                match = /%{as\:([+-])(.*?)}/.exec(text);
                if (match) {
                    wordList[i].format = true;
                    wordList[i].format_command = match[1];
                    wordList[i].format_style = match[2];
                    ++fetchIndex;
                }

            }
        }

        return wordList;
    }


    joinWordList(wl) {
        let result = {};
        result.text = '';
        result.plain = '';
        result.ssml = '';


        for (let i = 0; i < wl.length; ++i) {
            // TODO: Other types. Use methods.
            result.text += wl[i].text;
            result.plain += wl[i].plain || wl[i].text;
            result.ssml += wl[i].ssml || wl[i].text || wl[i].text;
        }

        return result;
    }

}


module.exports = GrammarService;

