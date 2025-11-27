const GrammarService = require("./src/gaas");
const gaas = new GrammarService();

gaas.fix('%{d} point', [3]).then((data) => {
    console.log(data);
});

gaas.fix('%{d} points', [1]).then((data) => {
    console.log(data);
});

gaas.fix('a FBI agent').then((data) => {
    console.log(data);
});

gaas.fix('it is %{d} hour away',[2]).then((data) => {
    console.log(data);
});
