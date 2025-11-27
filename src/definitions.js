// Tokens
WordType = {
    WHITESPACE: 1,
    TEXT: 2,
    PUNCTUATION: 3,
    SPECIFIER: 4,
    END_OF_TEXT: 100
}


function getSymbolType(c) {
    if (c.match(/^\s+$/)) {
        return WordType.WHITESPACE;
    } else if (c.match(/\d+\.\d+/)) { // handle decimals numbers, like 1.5, before PUNCTUATION sees the dot and takes over
        return WordType.TEXT;
    } else if (c.match(/\d+\/\d+/)) { // handle fractions, for the same reason
        return WordType.TEXT;
    } else if (c.match(/[\/.,<>\/?;#:@~!"£$%^&*\(\)\-\_\+\=[\[\]\{\}\']/)) {
        return WordType.PUNCTUATION;
    }
    return WordType.TEXT;
}

exports.module = { WordType, getSymbolType };
