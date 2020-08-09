const axios = require('axios');

const axiosHelper = function(maximumAttempts) {
    this.maximumAttempts = maximumAttempts;
}

axiosHelper.prototype.get = function(url, config, attempt) {
    attempt = attempt === undefined ? 0 : attempt;
    return new Promise((resolve, reject) => (
        axios.get(url, config).then(resolve)
        .catch((error) => {
            if(++attempt < this.maximumAttempts)
                resolve(this.get(url, config, attempt));
            else
                reject(error);
        })
    ));
}

axiosHelper.prototype.post = function(url, data, config, attempt) {
    attempt = attempt === undefined ? 0 : attempt;
    return new Promise((resolve, reject) => (
        axios.post(url, data, config).then(resolve)
        .catch((error) => {
            if(++attempt < this.maximumAttempts)
                resolve(this.post(url, data, config, attempt));
            else
                reject(error);
        })
    ));
}

module.exports = { init: axiosHelper };