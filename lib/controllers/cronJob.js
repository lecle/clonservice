"use strict";

var async = require('async');
var fs = require('fs');
var jobList = {};
var cronDirPath = process.cwd()+'/crons';

function getAppList(service, callback){

    service.send('find', {
        collectionName: 'apps',
        query : {
            where: {}
        }
    }, function ( err, docs ){

        if ( err || !docs ){
            return callback( null) ;
        }
        var appList = [];
        docs.data.forEach(function(value){
            appList.push(value.objectId);
        });
        callback(null, appList);
    });
}

function getMinCreateTime(applist, mongo, callback){

    var appCount = applist.length;
    var data = {};
    var promises = [];
    applist.forEach(function(value){

        var promise = new Promise( function(resolve, reject){

            mongo.send('find', {

                collectionName: value + '_Analytics',
                query : {
                    where : {},
                    limit : 1,
                    order : { 'createdAt' : 1 }
                }
            }, function (err, docs) {

                if ( err || !docs ){

                    exports.container.log.error('getMinCreateTime error', err);
                    reject();
                }
                if(!docs.data.length){
                    resolve();
                } else {
                    data[value] = docs.data[0].createdAt;
                    resolve();
                }
            });
        });
        promises.push(promise);
    });
    Promise.all(promises).then( function(values){
        callback(null, data);
    });
}

function getMaxCreateTime(applist, mongo, callback){

    var data = {};
    var promises = [];
    applist.forEach(function(value){

        var promise = new Promise( function(resolve, reject){

            mongo.send('find', {

                collectionName: value.objectId + '_Analytics',
                query : {
                    where : {},
                    limit : 1,
                    order : { 'createdAt' : -1 }
                }
            }, function(err, docs){

                if ( err || !docs ){

                    exports.container.log.error('getMaxCreateTime error', err);
                    reject();
                }
                if(!docs.data.length){
                    resolve();
                } else {

                    data[value.objectId] = docs.data[0].createdAt;
                    resolve();
                }
            });
        });
        promises.push(promise);
    });
    Promise.all(promises).then( function(values){
        callback(null, data);
    });
}

function getCronResult(data, mongo, analyMongo, callback){

    function queries( standardTime, newCollectionName, objectId) {

        var today = new Date();
        today.setHours(0,0,0,0);
        for( ;today > standardTime ; ){

            var lasterDay = new Date(standardTime);
            standardTime.setDate(lasterDay.getDate() + 1);
            mongo.send( 'aggregate',
                {
                    collectionName: newCollectionName,
                    aggregate: [
                        {
                            $match: {
                                createdAt: {"$lt": {"$ISODate": standardTime}, "$gte": {"$ISODate": lasterDay}}
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    _appId: objectId,
                                    day: {$dayOfMonth: '$createdAt'},
                                    month: {$month: '$createdAt'},
                                    year: {$year: '$createdAt'}
                                },
                                size: {$sum: '$responseSize'},
                                count: {$sum: 1}
                            }
                        }
                    ]
                },
                function (err, docs){
                    if (err) {
                      return;
                    }
                    if (!docs.data.length) {
                        return;
                    }
                    docs.data[0]._appId = docs.data[0]._id._appId;
                    delete docs.data[0]._id._appId;
                    docs.data[0].time = docs.data[0]._id;

                    var dateString =  docs.data[0]._id.year+'.'
                        +docs.data[0]._id.month + '.'+docs.data[0]._id.day;
                    var standardTime = new Date(dateString);
                    var lasterDay = new Date(standardTime);
                    standardTime.setDate(lasterDay.getDate() + 1);
                    delete docs.data[0]._id;
                    var finalBowl = docs.data[0];
                    mongo.send( 'aggregate',
                        {
                            collectionName: newCollectionName,
                            aggregate: [
                                {
                                    $match: {
                                        createdAt: {"$lt": {"$ISODate":  standardTime}, "$gt": {"$ISODate" : lasterDay} }
                                    }
                                },
                                {
                                    $group: {
                                        _id: "$url",
                                        count: {$sum: 1}
                                    }
                                },
                                {
                                    $sort: {count: -1}
                                },
                                {
                                    $limit: 20
                                }
                            ]
                        },
                        function (err, docs){

                            var url = [];
                            if (err) {
                                return;
                            }
                            docs.data.forEach(function (value) {
                                url.push(value._id + ':' + value.count);
                            });


                            finalBowl.url = url;


                            mongo.send( 'aggregate',
                                {
                                    collectionName: newCollectionName,
                                    aggregate: [
                                        {
                                            $match: {
                                                createdAt: {"$lt": {"$ISODate":  standardTime}, "$gt": {"$ISODate" : lasterDay} }
                                            }
                                        },
                                        {
                                            $group: {
                                                _id: "$headers.x-forwarded-for",
                                                count: {$sum: 1}
                                            }
                                        },
                                        {
                                            $sort: {count: -1}
                                        },
                                        {
                                            $limit: 20
                                        }
                                    ]
                                },
                                function (err, docs){

                                    var ip = [];
                                    if (err) {
                                        return;
                                    }
                                    if(docs.data.length){
                                        docs.data.forEach(function (value) {
                                            ip.push(value._id);
                                        });
                                    }
                                    finalBowl.ip = ip;
                                    analyMongo.send( 'insert',
                                        {
                                            collectionName: 'dayAnalysis',
                                            data: finalBowl
                                        },
                                        function (err, doc) {

                                            if (err) {
                                                exports.container.log.error('getCronResult error ', err);
                                            }
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            )
        }
    };
    for(var objectId in data ){

        var standardTime = new Date(data[objectId]);
        standardTime.setHours(0, 0, 0, 0);
        var toDay = new Date();
        toDay.setHours(0, 0, 0, 0);
        var newCollectionName = objectId + '_Analytics';
        while( toDay >= standardTime ){
            queries(standardTime, newCollectionName, objectId);
        } // while loop
    } // for loop

    callback(null);
}

function initializationAnalysisDB(analyMongo){

    exports.container.getService('MONGODB').then(function (mongo) {

        async.waterfall([

            function(callback) {
                getAppList(mongo, callback);
            },
            function(applist, callback){
                getMinCreateTime(applist, mongo, callback);
            },
            function(data, callback) {
                getCronResult(data, mongo, analyMongo, callback)
            }
        ]);
    }).fail(function(err) {
        exports.container.log.error('initializationAnalysisDB error', err);
    });
}

function registCronJob(value, resCB){

    var CronJob = require('cron').CronJob;
    var cronInfo = {};
    var callbackBowl = resCB();
    if( callbackBowl.type === 'file'){

        var path = cronDirPath+'/'+value;
        cronInfo = require(path);
    } else if(callbackBowl.type === 'query'){  //type === query
        cronInfo = callbackBowl.cronInfo;
    } else{
        exports.container.log.error('Fail to registCronJob');
    }
    var cronTime = cronInfo.cronTime();
    var startRightaway = cronInfo.startRightaway();
    var cronFunction = cronInfo.cronFunction;

    var job = new CronJob({

        cronTime: cronTime,
        onTick: function(){
            cronFunction();
        },
        start : startRightaway,
        timeZone: "Japan"
    });
    var fileName = value.split('.'); //  change change name
    jobList[fileName[0]] = {
        job : job,
        state : 'on'
    };
    callbackBowl.callback();
}

function restartAnalysisDB(analyMongo){

    exports.container.getService('MONGODB').then(function (mongo) {

        async.waterfall([

            function(callback) {
                getAppList(mongo, callback);
            },
            function(applist, callback){
                getMaxCreateTime(applist, mongo, callback);
            },
            function(data, callback) {
                getCronResult(data, mongo, analyMongo, callback)
            }
        ]); // async end
    }).fail(function(err) {
        exports.container.log.error('restartAnalysisDB error', err);
    });
}

exports.container = null;

exports.cronJobSelector = function cronJobSelectorFunc(state, fileName, resCB){

    var callbackBowl = resCB();
    switch(state){
        case 'create':
            if(fileName in jobList){

                exports.container.log.error('There is a '+fileName+' job already');
                return;
            }
            registCronJob(fileName+'.js', resCB);
            break;
        case 'delete':
            if( !(fileName in jobList)){

                exports.container.log.error('There is no '+fileName+' job there');
                return;
            }
            if(jobList[fileName].state === 'on'){

                jobList[fileName].job.stop();
            }
            delete jobList[fileName];
            callbackBowl.callback();
            break;
        case 'start':
            if( !(fileName in jobList)){

                exports.container.log.error('There is no '+fileName+' job there');
                return;
            }
            jobList[fileName].job.start();
            jobList[fileName].state = 'on';
            callbackBowl.callback();
            break;
        case 'stop':
            if( !(fileName in jobList)){

                exports.container.log.error('There is no '+fileName+' job there');
                return;
            }
            jobList[fileName].job.stop();
            jobList[fileName].state = 'off';
            callbackBowl.callback();
            break;
        case 'update':
            if( !(fileName in jobList)){

                exports.container.log.error('There is no '+fileName+' job there');
                return;
            }
            jobList[fileName].job.stop();
            delete jobList[fileName];
            registCronJob(fileName+'.js', resCB);
            break;
        case 'stay':
            break;
        default :
            exports.container.log.error('There is a '+fileName+' state.');
    }
};

exports.runAnayCronJob = function() {

    exports.container.getService('ANALYTICSDB').then(function (analyMongo) {

        analyMongo.send('count', {
            collectionName: 'dayAnalysis',
            query : {   where: {} }
        }, function(err, docs){

            if ( err || !docs ){

                exports.container.log.error('runAnayCronJob error ', err);
                return;
            }
            if( docs ){
                initializationAnalysisDB(analyMongo);
            } else {
                restartAnalysisDB(analyMongo);
            }
        });
    });
};

exports.runMainCronJob = function(){

    var CronJob = require('cron').CronJob;
    var job = new CronJob({
        cronTime: '00 00 06 * * 0-6',
        onTick: function(){

            (function cronJob(container){

                container.getService('MONGODB').then(function (mongo) {
                    container.getService('ANALYTICSDB').then(function (analyMongo) {

                        async.waterfall([

                            function(callback) {
                                getAppList(mongo, callback);
                            },
                            function(applist, callback){

                                var appCount = applist.length;
                                var data  = {};
                                applist.forEach(function(value, index){

                                    var standardTime = new Date();
                                    standardTime.setHours(0, 0, 0, 6);
                                    data[value.objectId] = standardTime;
                                    if(appCount === index + 1){
                                        callback(null, data);
                                    }
                                })
                            },
                            function(data, callback) {
                                getCronResult(data, mongo, analyMongo, callback)
                            }
                        ]); // async end
                    }).fail(function(err) {
                        exports.container.log.error('runMainCronJob error ', err);
                    });
                }).fail(function(err) {
                    exports.container.log.error('runMainCronJob error ', err);
                });
            })(exports.container);
        },
        start : false,
        timeZone: "Japan"
    });
    job.start();
    jobList.mainJob = {
        job : job,
        state : 'on'
    };
};

exports.runCronFileJob = function(files){

    files.forEach(function(value){

        if(value !== 'config_cron.json'){

            var fileCB = function (){
                return {
                    type : 'file',
                    callback : function(){}
                }
            };
            registCronJob(value, fileCB);
        }
    });
};

exports.runCronFileObserver =function(){

    var ObservFile  = require('observ-fs/file');
    var configFile = '/config_cron.json';
    var observ  = ObservFile(cronDirPath + configFile, fs);

    observ(function(value){

        value = JSON.parse(value);
        for(var key in value){

            var fileCB = function (){
                return{
                    type : 'file',
                    callback : function(){}
                }
            };
            exports.cronJobSelector(value[key], key, fileCB);
        }
    });
};
