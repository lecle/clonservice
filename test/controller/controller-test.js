"use strict";
var cronJob = require('../../lib/controllers/cronJob');
var container = require('../../../../lib/container').getInstance();
var assert = require('assert');
var fs = require('fs');

describe('controlller', function(){

    before(function(done) {

        container.init('', '', function (err) {

            console.log('!! You should manually drop dayAnalysis collection at ANALYTICSDB');
            console.log('!! You should manually comment out functions in init function');
            setTimeout(done, 1000);
        });
    });

    after(function(done) {

        container.close(function() {

            setTimeout(done, 2000);
        });
    });

    describe('#functions()', function(){
        var applist = {};
        var testData = {
            '554c69e0673c42e411ea533b' : '2015-05-09T07:40:27.236Z',
            '554c69a0673c42e411ea5339' : '2015-05-08T08:47:15.722Z,',
            '553075bedcf9d54c12424952' : '2015-04-17T02:55:27.027Z',
            '55936f353f49fb0c0cadf982' : '2015-07-01T04:41:01.458Z',
            '55754a5a61446e7c09bf0524' : '2015-06-08T07:55:13.842Z'
        };
        var resultData = {};

        it('should run getAppList() without error', function(done){

            container.getService('MONGODB').then(function (mongo){

                var myCallback = function a( asnc, appList){

                    applist = appList;
                    assert.equal(appList.length, 6, 'It should be 6 for now. ' +
                    'If sample data changed, you should change the 6 number accordingly');
                    if(asnc === null){  done(); }
                }

                cronJob.getAppListTest(mongo, myCallback);
            });
        });

        it('should run getMinCreateTime() without error', function(done){

            this.timeout(6000);

            container.getService('MONGODB').then(function (mongo){

                var myCallback = function a(asnc, data){

                    assert.equal(testData['554c69e0673c42e411ea533b'] , data['554c69e0673c42e411ea533b'], 'Both of them should be same');
                    resultData = data;
                    if(asnc === null){  done(); }
                };
                cronJob.getMinCreateTimeTest(applist, mongo, myCallback);
            });
        });

        it('should run getCronResult() without error', function(done){

            this.timeout(9000);

            container.getService('MONGODB').then(function (mongo){

                container.getService('ANALYTICSDB').then(function (analyMongo){

                    var myCallback = function a(asnc){

                        setTimeout(function(){

                            analyMongo.send('find', {
                                collectionName: 'dayAnalysis',
                                query: {where: {}}
                            }, function(err, docs){

                                if(asnc === null){

                                    assert.notEqual( docs.data.length, 0, 'It should not be 0 all the time.  ' +
                                    'If sample data changed, you should change the 133 number accordingly');
                                    done();
                                }
                            });
                        },7000);
                    };
                    cronJob.getCronResultTest(resultData, mongo, analyMongo, myCallback);
                });
            });
        });


        it('should runregistCronJob() without error when resCB.type is file ', function(done){

            var fileCB = function a(){

                return {
                    type : 'file',
                    callback: function(job){

                        if(job){

                            assert.equal( job.running, true, 'it should be true');
                            done();
                        }
                    }
                };
            };
            console.log('/noserv-cron-server/crons/job1.js should exist');
            cronJob.registCronJobTest('job1.js' ,fileCB);
        });

        it('should runregistCronJob() without error when resCB.type is query ', function(done){

            var quertyCB = function a(){

                return{
                    type : 'query',
                    cronInfo : {
                        cronTime : new Function("return '03 * * * * 0-6';"),
                        startRightaway : new Function('return true'),
                        cronFunction : new Function("console.log('!!!! job3 !!!!! ' + new Date());")
                    },
                    callback : function(job){

                        if(job){

                            assert.strictEqual( job.running, true, 'it should be true');
                            done();
                        }
                    }
                }
            };
            cronJob.registCronJobTest('test2.js', quertyCB);
        });

        it('should runMainCronJob() without error ', function(done){

            cronJob.runMainCronJob();
            setTimeout(function(){

                done();
            }, 1000);
        });

        it('should runCronFileJob() without error when resCB.type is query ', function(done){
            fs.readdir('./crons', function(err,files){

                if( files.length ){

                    cronJob.runCronFileJob(files);
                    setTimeout(function(){
                        done();
                    }, 1000);
                }
            });
        });

        it('should runCronFileObserver() without error ', function(done){

            cronJob.runCronFileObserver();
            setTimeout(function(){
                done();
            }, 1000);

        });
    });
});