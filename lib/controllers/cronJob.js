/**
 * Created by LecleNote1 on 2015-07-13.
 */

var async = require('async');
var fs = require('fs');


var jobList = {};
var cronDirPath = process.cwd()+'/crons';
//tested
function getAppList(callback, service){

    service.send('aggregate', {
        collectionName: 'apps',
        aggregate: [{
            $project: { _id: 0, objectId: 1 }
        }]
    }, function ( err, docs ){
;
        if ( err || !docs )
            return callback( null) ;

        var appList = docs.data;

        callback(null, appList);
    });
}
//tested
function getMinCreateTime(callback, applist, mongo){

    var appCount = applist.length;
    var data = {};
    var promises = [];
    applist.forEach(function(value, index){

        var promise = new Promise( function(resolve, reject){

            mongo.send('aggregate', {

                collectionName: value.objectId + '_Analytics',
                aggregate:  [
                    {
                        $group:
                        {
                            _id : value.objectId,
                            minCreatedAtTime: { $min: "$createdAt" }
                        }
                    }
                ]
            }, function (err, docs) {

                if ( err || !docs )
                    console.error('error');

                if(!docs.data.length){
                    resolve();
                } else {
                    data[value.objectId] = docs.data[0].minCreatedAtTime;
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
//tested
function getCronResult(callback, data, mongo, analyMongo){

    for(var objectId in data ){

        var standardTime = new Date(data[objectId]);
        standardTime.setHours(0, 0, 0, 0);
        var lasterDay ;
        var toDay = new Date();
        toDay.setHours(0, 0, 0, 0);

        while( toDay >= standardTime ){

            lasterDay = new Date(standardTime);
            standardTime.setDate(lasterDay.getDate() + 1);
            mongo.send('aggregate', {

                collectionName: objectId + '_Analytics',
                aggregate: [
                    {
                        $match: {
                            createdAt: {"$lt": {"$ISODate":  standardTime}, "$gt": {"$ISODate" : lasterDay} }
                        }
                    },
                    {
                        $project: {_id: 0, createdAt: 1, responseSize: 1}
                    },
                    {
                        $group: {
                            _id: { day: {$dayOfMonth: '$createdAt' }, month: {$month:'$createdAt'}, year: {$year: '$createdAt'}},
                            size: {$sum: "$responseSize"},
                            count: {$sum: 1},
                            _appId : { $first :objectId }
                        }
                    }
                ]
            }, function (err, docs) {

                if(err){ return; }
                if(!docs || docs.data[0] === undefined ){ return; }

                docs.data[0].time = docs.data[0]._id;
                delete docs.data[0]._id;

                var insertData = docs.data[0];
                analyMongo.send('insert', {
                        collectionName: 'dayAnalysis',
                        data :insertData
                    }, function(err, doc){
                        if(err) {
                            console.error(err);
                            return;
                        }
                    }
                );
            });
        }
    }
    callback(null);
}
//no needed to be tested
function initializationAnayDB(analyMongo){// getAppList - getMinCreateTime - getCronResult

    exports.container.getService('MONGODB').then(function (mongo) {

        async.waterfall([
            function(callback) {

                getAppList(callback , mongo);
            },
            function(applist, callback){

                getMinCreateTime(callback, applist, mongo);
            },
            function(data, callback) {

                getCronResult(callback, data, mongo, analyMongo)
            }
        ]); // async end
    }).fail(function(err) {
        console.log(err);
    });
}
////tested
function registCronJob(value, resCB){

    var CronJob = require('cron').CronJob;
    var cronInfo = {};

    if( resCB.prototype.type === 'file'){

        var path = cronDirPath+'/'+value;
        cronInfo = require(path);
    } else if(resCB.prototype.type === 'query'){  //type === query

        cronInfo = resCB.prototype.cronInfo;
    } else{

        console.error('error!!!');
    }
    var cronTime = cronInfo.cronTime();
    var startRightaway = cronInfo.startRightaway();
    var cronFunction = cronInfo.cronFunction;

    var job = new CronJob({
        cronTime: cronTime,
        onTick: function(){
            cronFunction(exports.container);
        },
        start : startRightaway,
        timeZone: "Japan"
    });
    job.start();

    var fileName = value.split('.');
    jobList[fileName[0]] = {
        job : job,
        state : 'on'
    };
    resCB();
}

exports.container = null;
// no needed to be tested
exports.cronJobSelector = function cronJobSelectorFunc(state, fileName, resCB){

    switch(state){
        case 'create':
            if(fileName in jobList){

                console.error('There is a %s job already',fileName);
                return;
            }
            registCronJob(fileName+'.js', resCB);
            break;
        case 'delete':
            if( !(fileName in jobList)){

                console.error('There is no %s job',fileName);
                return;
            }
            if(jobList[fileName].state === 'on'){

                jobList[fileName].job.stop();
            }
            delete jobList[fileName];
            resCB();
            break;
        case 'start':
            if( !(fileName in jobList)){

                console.error('There is no %s job',fileName);
                return;
            }
            jobList[fileName].job.start();
            jobList[fileName].state = 'on';
            resCB();
            break;
        case 'stop':
            if( !(fileName in jobList)){

                console.error('There is no %s job',fileName);
                return;
            }
            jobList[fileName].job.stop();
            jobList[fileName].state = 'off';
            resCB();
            break;
        case 'update':
            if( !(fileName in jobList)){// ¼öÁ¤

                console.error('There is no %s job',fileName);
                return;
            }
            jobList[fileName].job.stop();
            delete jobList[fileName];
            registCronJob(fileName+'.js', resCB);
            break;
        case 'stay':
            break;
        default :
            console.error('There is no %s State',fileName);
    }
}

// no needed to be tested
exports.runAnayCronJob = function() {

    exports.container.getService('ANALYTICSDB').then(function (analyMongo) {
        analyMongo.send('count', {
            collectionName: 'dayAnalysis',
            query : { where : {} }
        }, function(err, docs){

            if ( err || !docs ){
                console.error( err );
                return;
            }
            if( !docs.data ){
                initializationAnayDB(analyMongo);
            }
        });
    });
};
//tested
exports.runMainCronJob = function() {

    var CronJob = require('cron').CronJob;
    var job = new CronJob({
        cronTime: '00 00 00 * * 0-6',
        onTick: function(){
            (function cronJob(container){
                container.getService('MONGODB').then(function (mongo) {
                    container.getService('ANALYTICSDB').then(function (analyMongo) {
                        async.waterfall([
                            function(callback) {
                                getAppList(callback , mongo);
                            },
                            function(applist, callback){

                                var appCount = applist.length;
                                var data  = {};
                                applist.forEach(function(value, index){
                                    var standardTime = new Date();
                                    standardTime.setHours(0, 0, 0, 0);
                                    data[value.objectId] = standardTime;
                                    if(appCount === index + 1){
                                        callback(null, data);
                                    }
                                })
                            },
                            function(data, callback) {
                                getCronResult(callback, data, mongo, analyMongo)
                            }
                        ]); // async end
                    }).fail(function(err) {
                        console.log(err);
                    });
                }).fail(function(err) {
                    console.log(err);
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
}
//tested
exports.runCronFileJob = function(files){

    var CronJob = require('cron').CronJob;

    files.forEach(function(value){

        if(value !== 'config_cron.json'){

            var fileCB = function (){};
            fileCB.prototype.type = 'file'
            registCronJob(value, fileCB);
        }
    });
}

exports.runCronFileObserver =function(){

    var ObservFile  = require('observ-fs/file');
    var configFile = '/config_cron.json'
    var observ  = ObservFile(cronDirPath + configFile, fs);

    observ(function(value){

       value = JSON.parse(value);
       for(var key in value){ //  jobName : state

           var fileCB = function (){ };
           fileCB.prototype.type = 'file'
           exports.cronJobSelector(value[key], key, fileCB); // state : fileName
       }
    });
}





exports.getAppListTest = function getAppList1(callback, service){

    service.send('aggregate', {
        collectionName: 'apps',
        aggregate: [{
            $project: { _id: 0, objectId: 1 }
        }]
    }, function ( err, docs ){

        if ( err || !docs )
            return callback( null) ;

        var appList = docs.data;

        callback(null, appList);
    });
}

exports.getMinCreateTimeTest = function getMinCreateTimeD(callback, applist, mongo){

    var appCount = applist.length;
    var data = {};
    var promises = [];
    applist.forEach(function(value, index){

        var promise = new Promise( function(resolve, reject){

            mongo.send('aggregate', {

                collectionName: value.objectId + '_Analytics',
                aggregate:  [
                    {
                        $group:
                        {
                            _id : value.objectId,
                            minCreatedAtTime: { $min: "$createdAt" }
                        }
                    }
                ]
            }, function (err, docs) {

                if ( err || !docs )
                    console.error('error');

                if(!docs.data.length){
                    resolve();
                } else {
                    data[value.objectId] = docs.data[0].minCreatedAtTime;
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

exports.getCronResultTest = function getCronResultD(callback, data, mongo, analyMongo){

    for(var objectId in data ){

        var standardTime = new Date(data[objectId]);
        standardTime.setHours(0, 0, 0, 0);
        var lasterDay ;
        var toDay = new Date();
        toDay.setHours(0, 0, 0, 0);

        while( toDay >= standardTime ){

            lasterDay = new Date(standardTime);
            standardTime.setDate(lasterDay.getDate() + 1);
            mongo.send('aggregate', {

                collectionName: objectId + '_Analytics',
                aggregate: [
                    {
                        $match: {
                            createdAt: {"$lt": {"$ISODate":  standardTime}, "$gt": {"$ISODate" : lasterDay} }
                        }
                    },
                    {
                        $project: {_id: 0, createdAt: 1, responseSize: 1}
                    },
                    {
                        $group: {
                            _id: { day: {$dayOfMonth: '$createdAt' }, month: {$month:'$createdAt'}, year: {$year: '$createdAt'}},
                            size: {$sum: "$responseSize"},
                            count: {$sum: 1},
                            _appId : { $first :objectId }
                        }
                    }
                ]
            }, function (err, docs) {

                if(err){ return; }
                if(!docs || docs.data[0] === undefined ){ return; }

                docs.data[0].time = docs.data[0]._id;
                delete docs.data[0]._id;

                var insertData = docs.data[0];
                analyMongo.send('insert', {
                        collectionName: 'dayAnalysis',
                        data :insertData
                    }, function(err, doc){
                        if(err) {
                            console.error(err);
                            return;
                        }
                    }
                );
            });
        }
    }
    callback(null);
}

exports.registCronJobTest = function registCronJobD(value, resCB){

    var CronJob = require('cron').CronJob;
    var cronInfo = {};

    if( resCB.prototype.type === 'file'){

        var path = cronDirPath+'/'+value;
        cronInfo = require(path);
    } else if(resCB.prototype.type === 'query'){  //type === query

        cronInfo = resCB.prototype.cronInfo;
    } else {

        console.error('error!!!');
    }
    var cronTime = cronInfo.cronTime();
    var startRightaway = cronInfo.startRightaway();
    var cronFunction = cronInfo.cronFunction;

    var job = new CronJob({
        cronTime: cronTime,
        onTick: function(){
            cronFunction(exports.container);
        },
        start : startRightaway,
        timeZone: "Japan"
    });
    job.start();

    var fileName = value.split('.');
    jobList[fileName[0]] = {
        job : job,
        state : 'on'
    };
    resCB(job);   // at real code: resCB()
}