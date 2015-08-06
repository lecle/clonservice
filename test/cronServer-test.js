"use strict";
var cronService = require('../lib/cronServer');
var assert = require('assert');

var req = {
    data : {
        data : {
            cronJobName : "job3",
            cronTime: "return '03 * * * * 0-6';",
            startRightaway: 'return true',
            cronFunction: "console.log('!!!! job3 !!!!! ' + new Date());"
        }
    }
};

var res = function(done) {

    return {
        send : function(resultFromTestingTarget) {
            assert.equal(resultFromTestingTarget, 'WD');
            done();
        },
        error : function(err) {done(err);}
    };
};

describe('cronServer', function() {
    describe('#init()', function() {
        it('should initialize without error', function(done) {

            // manager service load
            var dummyContainer = {
                addListener:function(){},
                getConfig:function(){return null;},
                log : {
                    info : function(log) { console.log(log)},
                    error : function(log) { console.log(log)}
                },
                getService : function(name) {

                    return {
                        then : function(callback){ callback({
                            send : function(command, data, callback) {

                                callback(null, {data : {}});
                            }});

                            return {fail : function(){}};
                        }
                    };
                }
            };

            cronService.init(dummyContainer, function(err) {

                cronService.close(done);
            });
        });
    });

    describe('#create()', function() {
        it('should insert without error', function(done) {

            cronService.create(req, res(done));
        });
    });

    describe('#stop()', function() {
        it('should insert without error', function(done) {

            cronService.stop(req, res(done));
        });
    });

    describe('#start()', function() {
        it('should insert without error', function(done) {

            cronService.start(req, res(done));
        });
    });

    describe('#update()', function() {
        it('should insert without error', function(done) {

            cronService.update(req, res(done));
        });
    });

    describe('#delete()', function() {
        it('should insert without error', function(done) {

            cronService.delete(req, res(done));
        });
    });

});
