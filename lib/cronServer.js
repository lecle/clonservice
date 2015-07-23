/**
 * Created by LecleNote1 on 2015-07-10.
 */
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
    },9000);


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


function setCB(res){

    var subQueryCB = function queryCBFunc(){

        res.send('WD')
    }
    subQueryCB.prototype.type = 'query';
    return subQueryCB;
};

function onCreate(req, res){ // (state, fileName, resCB){

    var queryCB = setCB(res);

    queryCB.prototype.cronInfo = {};
    queryCB.prototype.cronInfo.cronTime = new Function(req.data.data.cronTime);
    queryCB.prototype.cronInfo.startRightaway =  new Function(req.data.data.startRightaway);
    queryCB.prototype.cronInfo.cronFunction =  new Function(req.data.data.cronFunction);

    cronJob.cronJobSelector('create', req.data.data.cronJobName, queryCB);
}

function onDelete(req, res){

    var queryCB = setCB(res);
    cronJob.cronJobSelector('delete', req.data.data.cronJobName, queryCB);
}

function onStop(req, res){

    var queryCB = setCB(res);
    cronJob.cronJobSelector('stop', req.data.data.cronJobName, queryCB);
}

function onStart(req, res){

    var queryCB = setCB(res);
    cronJob.cronJobSelector('start', req.data.data.cronJobName, queryCB);
}

function onUpdate(req, res){

    var queryCB = setCB(res);

    queryCB.prototype.cronInfo = {};
    queryCB.prototype.cronInfo.cronTime = new Function(req.data.data.cronTime);
    queryCB.prototype.cronInfo.startRightaway =  new Function(req.data.data.startRightaway);
    queryCB.prototype.cronInfo.cronFunction =  new Function(exports.container, req.data.data.cronFunction);

    cronJob.cronJobSelector('start', req.data.data.cronJobName, queryCB);
}

