module.exports = {


    isNumber: function(text) {
        return text === '' || isNaN(+text) ? false : true;
    },

    isFraction: function(text) {
        return text.match(/^(\d+)\/(\d+)$/);
    }

}
