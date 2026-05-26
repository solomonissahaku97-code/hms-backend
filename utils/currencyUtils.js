// utils/currencyUtils.js
function financialRound(number) {
    return Math.round(number * 100) / 100;
}

function financialAdd(a, b) {
    return financialRound(parseFloat(a) + parseFloat(b));
}

function financialSubtract(a, b) {
    return financialRound(parseFloat(a) - parseFloat(b));
}


export {    
    financialRound,
    financialAdd,
    financialSubtract
};