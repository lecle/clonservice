/**
 * Created by LecleNote1 on 2015-07-20.
 */
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

                cronJob.getAppListTest( myCallback , mongo);
            });
        });

        it('should run getMinCreateTime() without error', function(done){

            this.timeout(4000);

            container.getService('MONGODB').then(function (mongo){

                var myCallback = function a(asnc, data){
                    resultData = data;
                    if(asnc === null){  done(); }
                }
                cronJob.getMinCreateTimeTest( myCallback , applist, mongo);
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

                                    assert.equal( docs.data, 133, 'It should be 133 for now. ' +
                                    'If sample data changed, you should change the 133 number accordingly');
                                    done();
                                }
                            });

                        },7000);
                    }
                    cronJob.getCronResultTest( myCallback , resultData, mongo, analyMongo);
                });
            });
        });


        it('should runregistCronJob() without error when resCB.prototype.type is file ', function(done){

            container.getService('MONGODB').then(function (mongo){

                var myCallback = function a(job){

                    if(job){

                        assert.equal( job.running, true, 'it should be true');
                        done();
                    }
                }
                myCallback.prototype.type = 'file';

                console.log('/noserv-cron-server/crons/job1.js should exist');
                cronJob.registCronJobTest( 'job1.js' ,myCallback);
            });
        });

        it('should runregistCronJob() without error when resCB.prototype.type is query ', function(done){
            container.getService('MONGODB').then(function (mongo){

                var myCallback = function a(job){

                    if(job){

                        assert.strictEqual( job.running, true, 'it should be true');
                        done();
                    }
                }

                myCallback.prototype.type = 'query';
                myCallback.prototype.cronInfo = {};

                myCallback.prototype.cronInfo.cronTime = new Function("return '03 * * * * 0-6';");
                myCallback.prototype.cronInfo.startRightaway =  new Function('return true');
                myCallback.prototype.cronInfo.cronFunction =  new Function("console.log('!!!! job3 !!!!! ' + new Date());");

                cronJob.registCronJobTest('test2.js', myCallback);
            });
        });

        it('should runMainCronJob() without error when resCB.prototype.type is query ', function(done){

            cronJob.runMainCronJob();
            setTimeout(function(){

                done();
            }, 1000);
        });

        it('should runCronFileJob() without error when resCB.prototype.type is query ', function(done){
            fs.readdir('./crons', function(err,files){

                if( files.length ){

                    cronJob.runCronFileJob(files);
                    setTimeout(function(){
                        done();
                    }, 1000);
                }
            });
        });

        it('should runCronFileObserver() without error when resCB.prototype.type is query ', function(done){

            cronJob.runCronFileObserver();
            setTimeout(function(){
                done();
            }, 1000);

        });
    });
});