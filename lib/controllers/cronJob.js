/**
 * Created by LecleNote1 on 2015-07-13.
 */

var async = require('async');


exports.run = function(container) {

    container.getService('MONGODB').then(function (service) {

        var data = {};

        async.waterfall([
            function( callback ){

                service.send('aggregate', {
                    collectionName: 'apps',
                    aggregate: [{
                        $project: { _id: 0, objectId: 1 }
                    }]
                }, function ( err, docs ){

                    if ( err || !docs )
                        return callback( null) ;

                    data.appList = docs;

                    callback(null);
                });
            },

            function(callback) {

                for (var appId in data.appList){

                    service.send('aggregate', {
                        collectionName: appId,
                        aggregate: [
                            {$match: {_className: '_Files'}},
                            {
                                $group: {
                                    _id: {_className: "$_className"},
                                    size: {$sum: "$size"},
                                    count: {$sum: 1}
                                }
                            }
                        ]
                    }, function (err, docs) {

                        if (err)
                            return callback(null);

                        if (!docs.data || docs.data.length !== 1)
                            return callback(null);

                        data[appId] = {};
                        data[appId].size = docs.data[0].size;
                        data[appId].count = docs.data[0].count;

                        callback(null);
                    });
                }
            },
            function( callback ) {

                var toDay = new Date();
                toDay.setHours(0, 0, 0, 0);
                var yesterDay = new Date(today);
                yesterDay.setDate(toDay.getDate() - 1);

                for ( var appId in data.appList ){
                    service.send('find', {
                        collectionName: appId + '_Analytics',
                        aggregate: [
                            {
                                $match: {
                                    createdAt: {$ld: toDay, $gd: yesterDay}
                                }
                            },
                            {
                                $project: {_id: 0, createdAt: 1, responseSize: 1}
                            },
                            {
                                $group: {
                                    _id: {month: {$month: '$createdAt'}, year: {$year: '$createdAt'}},
                                    size: {$sum: "$responseSize"},
                                    count: {$sum: 1}
                                }
                            }
                        ]
                    }, function (err, docs) {

                        if (err || !docs)
                            return callback(null);

                        data[appId].request = docs.data;

                        callback(null);
                    });
                }
            },
            function(callback) {

                delete data.appList;

                for (var apps in data) {

                    container.getService('ANALYTICSDB').then(function (analyticsDbService) {
                        analyticsDbService.send('insert', {collectionName: 'dayAnalytics', data : apps}, function(err, data){

                            if (err || !data)  return callback(null);

                            callback(null, 'done');
                        });
                    }).fail(function(err) {
                        console.log(err);
                    });
                }
            }
        ]); // async end
    }).fail(function(err) {
        console.log(err);
    });
};