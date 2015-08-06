"use strict";

var fs = require('fs');

var cronJob = require('./controllers/cronJob');
exports.container = null;

exports.init = function(container, callback) {

    exports.container = container;
    cronJob.container = container;

    setTimeout(function(){
        initAnayCronJob();
        startMainCronJob();
        startCronFileJob();
        startCronObserver();
    },4000);


    container.addListener('create', onCreate);
    container.addListener('delete', onDelete);
    container.addListener('stop', onStop);
    container.addListener('start', onStart);
    container.addListener('update', onUpdate);

    callback(null);
};

exports.close = function(callback) {

    callback(null);
};

function initAnayCronJob(){

    cronJob.runAnayCronJob();
}
function startMainCronJob(){

    cronJob.runMainCronJob();
}
function startCronFileJob(){

    fs.readdir('./crons', function(err,files){
        if(err) console.error(err);
        if( files.length ){
            cronJob.runCronFileJob(files);
        }
    });
}

function startCronObserver(){

    cronJob.runCronFileObserver();
}

exports.create = onCreate;
exports.delete = onDelete;
exports.stop = onStop;
exports.start = onStart;
exports.update = onUpdate;

function setCB(req, res, create){

    return function(){

        var bowl = {
            type : 'query',
            callback : function(){

                res.send('WD');
            }
        };
        if(create === true){
            bowl.cronInfo = {
                cronTime : new Function(req.data.data.cronTime),
                startRightaway :  new Function(req.data.data.startRightaway),
                cronFunction : new Function(req.data.data.cronFunction)
            };
        };
        return bowl;
    }
}

function onCreate(req, res){

    var queryCB = setCB(req , res, true);
    cronJob.cronJobSelector('create', req.data.data.cronJobName, queryCB);
}

function onDelete(req, res){

    var queryCB = setCB(req , res);
    cronJob.cronJobSelector('delete', req.data.data.cronJobName, queryCB);
}

function onStop(req, res){

    var queryCB = setCB(req , res);
    cronJob.cronJobSelector('stop', req.data.data.cronJobName, queryCB);
}

function onStart(req, res){

    var queryCB = setCB(req , res);
    cronJob.cronJobSelector('start', req.data.data.cronJobName, queryCB);
}

function onUpdate(req, res){

    var queryCB = setCB(req , res, true);
    cronJob.cronJobSelector('update', req.data.data.cronJobName, queryCB);
}

