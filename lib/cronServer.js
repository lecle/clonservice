/**
 * Created by LecleNote1 on 2015-07-10.
 */
"use strict";

//var CronJob = require('cron').CronJob;

exports.container = null;

exports.init = function(container, callback) {

    exports.container = container;

    startCronJob();

    callback(null);
};

exports.close = function(callback) {

    callback(null);
};

function startCronJob() {

    require('./controllers/cronJob').run(exports.container);

}